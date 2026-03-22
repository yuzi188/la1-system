/**
 * poker/socket.js — Socket.IO /poker namespace handler
 *
 * Events (client → server):
 *   GET_ROOMS, JOIN_ROOM, ACTION, LEAVE_ROOM, REBUY
 *
 * Events (server → client):
 *   JOIN_SUCCESS, JOIN_ERROR, MATCH_UPDATE, START_GAME, DEAL, TURN,
 *   TURN_WARNING, ACTION, ACTION_ERROR, FLOP, TURN_CARD, RIVER,
 *   SHOWDOWN, SETTLE, BALANCE_UPDATE, REBUY_SUCCESS, REBUY_ERROR
 *
 * Wallet sync:
 *   - JOIN_ROOM (new):   deductBuyIn(userId, buyIn)
 *   - JOIN_ROOM (reconnect): NO deduction — restore existing state
 *   - SHOWDOWN:          creditWinnings(userId, finalChips) for each human player
 *   - LEAVE_ROOM:        refundChips(userId, remainingChips) if not already settled
 *   - disconnect:        mark disconnected but keep seat for reconnect grace period
 *   - REBUY:             deductRebuy(userId, amount) + add to player.chips
 *
 * Key fixes:
 *   1. Reconnect: JOIN_ROOM checks if player already in room → restore state, no re-deduction
 *   2. All-in autorun: advancePhase returns autoRun=true → processAutoRun runs all remaining streets
 *   3. Stuck state: roundInProgress reset on all error paths; stale-round watchdog
 *   4. Wallet sync: deductBuyIn on join, creditWinnings on settle, refundChips on leave
 *   5. Rebuy: REBUY event deducts from wallet and adds chips in-game
 */

const { createGameState } = require("./core/state");
const { startRound, handleAction, advancePhase } = require("./core/dealer");
const { fillBots, canStartRound } = require("./core/matchmaking");
const { decide } = require("./bot/brain");
const { recordAction } = require("./bot/memory");
const pokerDb = require("./db");

// ── In-memory room store ─────────────────────────────────────────────────────
const rooms = new Map();

// Grace period (ms) before a disconnected player's seat is freed
const RECONNECT_GRACE_MS = 60000; // 60 seconds

// ── Room management ──────────────────────────────────────────────────────────

async function getOrCreateRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);

  const roomConfig = await pokerDb.loadRoomConfig(roomId);
  const sysConfig  = await pokerDb.loadSystemConfigs();
  const maxPlayers = roomConfig.max_players || 6;

  const room = {
    id: roomId,
    config: roomConfig,
    sysConfig,
    players: new Array(maxPlayers).fill(null),
    state: null,
    turnTimer: null,
    _warningTimer: null,
    roundInProgress: false,
    _roundStartedAt: null,
  };

  room.state = createGameState(roomId, {
    smallBlind: roomConfig.small_blind || 1,
    bigBlind:   roomConfig.big_blind || 2,
    maxPlayers,
  });
  room.state.roomId    = roomId;
  room.state.smallBlind = roomConfig.small_blind || 1;
  room.state.bigBlind   = roomConfig.big_blind || 2;
  room.state.roomConfig = roomConfig;
  room.state.config     = sysConfig;
  room.state.players    = room.players;

  rooms.set(roomId, room);
  return room;
}

// ── State sanitizer ──────────────────────────────────────────────────────────

function sanitizeState(state, forPlayerId) {
  if (!state) return null;

  const currentPlayer = state.players[state.currentPlayerIndex];
  const currentPlayerId = currentPlayer ? currentPlayer.id : null;

  return {
    roomId: state.roomId,
    phase: state.phase || "WAITING",
    pot: state.pot || 0,
    community: state.community || [],
    currentBet: state.currentBet || 0,
    minRaise: state.minRaise || (state.bigBlind || 2),
    bigBlind: state.bigBlind || 2,
    dealerIndex: state.dealerIndex || 0,
    currentPlayerIndex: state.currentPlayerIndex || 0,
    currentPlayerId,
    players: (state.players || []).map((p, idx) => {
      if (!p) return null;
      const isMe       = String(p.id) === String(forPlayerId);
      const isShowdown = state.phase === "SHOWDOWN" || state.phase === "SETTLE";
      return {
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet || 0,
        folded: !!p.folded,
        allIn: !!p.allIn,
        isActive: !!p.isActive,
        isBot: !!p.isBot,
        seatIndex: idx,
        lastAction: p.lastAction,
        connected: p.connected !== false,
        cards: (isMe || isShowdown)
          ? (p.cards || [])
          : (p.cards && p.cards.length ? ["??", "??"] : []),
      };
    }),
  };
}

// ── Turn timer ───────────────────────────────────────────────────────────────

function clearTurnTimer(room) {
  if (room.turnTimer)    { clearTimeout(room.turnTimer);    room.turnTimer    = null; }
  if (room._warningTimer){ clearTimeout(room._warningTimer); room._warningTimer = null; }
}

function startTurnTimer(room, nsp) {
  clearTurnTimer(room);

  const state    = room.state;
  const sysConfig = room.sysConfig || {};
  const timeoutMs = parseInt(sysConfig.turn_timeout_ms || "30000", 10);
  const warningMs = parseInt(sysConfig.turn_warning_ms || "10000", 10);

  // Validate currentPlayerIndex points to a valid, actionable player
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || !currentPlayer.isActive || currentPlayer.folded || currentPlayer.allIn) {
    // Attempt to find the next valid player
    const found = moveToNextPlayer(state);
    if (!found) {
      // No actionable player — phase should advance; trigger advancePhase
      console.log("[Poker] startTurnTimer: no actionable player, forcing advancePhase");
      const advResult = advancePhase(state);
      if (advResult.advance) {
        handlePhaseAdvance(room, advResult, nsp);
      }
      return;
    }
    startTurnTimer(room, nsp);
    return;
  }

  // Emit TURN
  nsp.to(room.id).emit("TURN", { playerId: currentPlayer.id, timeoutMs });

  if (currentPlayer.isBot) {
    const thinkTime = 1500 + Math.floor(Math.random() * 2500);
    room.turnTimer = setTimeout(() => executeBotAction(room, currentPlayer, nsp), thinkTime);
    return;
  }

  // Human: warning then auto-fold on timeout
  if (timeoutMs > warningMs) {
    room._warningTimer = setTimeout(() => {
      nsp.to(room.id).emit("TURN_WARNING", { playerId: currentPlayer.id, remainingMs: warningMs });
    }, timeoutMs - warningMs);
  }

  room.turnTimer = setTimeout(() => {
    console.log(`[Poker] Turn timeout for player ${currentPlayer.id} — auto FOLD`);
    processAction(room, currentPlayer.id, "FOLD", 0, nsp);
  }, timeoutMs);
}

// ── Bot execution ────────────────────────────────────────────────────────────

function executeBotAction(room, bot, nsp) {
  const decision = decide(bot, room.state, room.sysConfig || {});
  processAction(room, bot.id, decision.action, decision.amount, nsp);
}

// ── Process action ───────────────────────────────────────────────────────────

function processAction(room, playerId, action, amount, nsp) {
  const state = room.state;

  console.log(`[Poker] processAction: player=${playerId} action=${action} amount=${amount} phase=${state.phase} currentIdx=${state.currentPlayerIndex} currentId=${state.players[state.currentPlayerIndex]?.id}`);

  const result = handleAction(state, playerId, action, amount);

  if (!result.success) {
    console.log(`[Poker] Action failed: ${result.error}`);
    const player = state.players.find(p => p && String(p.id) === String(playerId));
    if (player && player.socketId) {
      nsp.to(player.socketId).emit("ACTION_ERROR", { error: result.error });
    }
    // Restart timer so the player can retry
    startTurnTimer(room, nsp);
    return;
  }

  recordAction(playerId, action, state.phase);

  // Broadcast action event
  nsp.to(room.id).emit("ACTION", {
    playerId,
    action,
    amount: result.amount || amount || 0,
    pot: state.pot,
  });

  broadcastState(room, nsp);

  // Check if phase should advance
  const advResult = advancePhase(state);

  if (advResult.advance) {
    clearTurnTimer(room);
    handlePhaseAdvance(room, advResult, nsp);
  } else {
    // Move to next player and continue
    moveToNextPlayer(state);
    broadcastState(room, nsp);
    startTurnTimer(room, nsp);
  }
}

// ── Phase advance handler (shared by processAction and processAutoRun) ───────

function handlePhaseAdvance(room, advResult, nsp) {
  const state = room.state;

  if (advResult.phase === "SHOWDOWN") {
    // ── Showdown ──
    console.log(`[Poker] SHOWDOWN: winners=${JSON.stringify(advResult.winners?.map(w=>({id:w.playerId,amount:w.amount})))}`);

    nsp.to(room.id).emit("SHOWDOWN", {
      community: state.community,
      showdown:  advResult.showdown,
      winners:   advResult.winners,
    });

    nsp.to(room.id).emit("SETTLE", {
      winners: advResult.winners,
      rake:    advResult.rake,
    });

    broadcastState(room, nsp);

    // Credit wallets asynchronously
    settleWallets(state, nsp).catch(e => console.error("[Poker] settleWallets error:", e));

    room.roundInProgress = false;
    room._roundStartedAt = null;

    // Next round after delay
    setTimeout(() => tryStartRound(room, nsp), 8000);

  } else {
    // ── Intermediate phase (FLOP / TURN / RIVER) ──
    const phase = advResult.phase;
    console.log(`[Poker] Phase advance to ${phase}, autoRun=${advResult.autoRun}`);

    if (phase === "FLOP") {
      nsp.to(room.id).emit("FLOP", { cards: advResult.cards });
    } else if (phase === "TURN") {
      nsp.to(room.id).emit("TURN_CARD", { card: advResult.cards[0] });
    } else if (phase === "RIVER") {
      nsp.to(room.id).emit("RIVER", { card: advResult.cards[0] });
    }

    broadcastState(room, nsp);

    if (advResult.autoRun) {
      // All players are all-in — auto-run remaining streets with delay
      setTimeout(() => processAutoRun(room, nsp), 1800);
    } else {
      startTurnTimer(room, nsp);
    }
  }
}

/**
 * Auto-run remaining streets when all active players are all-in.
 * Keeps calling advancePhase until SHOWDOWN.
 */
function processAutoRun(room, nsp) {
  const state = room.state;

  // Safety: if already at SHOWDOWN or SETTLE, don't re-run
  if (state.phase === "SHOWDOWN" || state.phase === "SETTLE") return;

  console.log(`[Poker] processAutoRun: current phase=${state.phase}`);

  const advResult = advancePhase(state);

  if (!advResult.advance) {
    // advancePhase returned false — this shouldn't happen in autoRun but handle it
    // Force all players to hasActed=true and retry
    console.log("[Poker] processAutoRun: advancePhase returned advance=false, forcing hasActed");
    state.players.forEach(p => { if (p && p.isActive && !p.folded) p.hasActed = true; });
    const retry = advancePhase(state);
    if (retry.advance) {
      handlePhaseAdvance(room, retry, nsp);
    } else {
      // Last resort: go directly to showdown
      console.log("[Poker] processAutoRun: forcing settleRound");
      const { settleRound } = require("./core/dealer");
      const settleResult = settleRound(state);
      handlePhaseAdvance(room, settleResult, nsp);
    }
    return;
  }

  handlePhaseAdvance(room, advResult, nsp);
}

// ── Wallet settlement ────────────────────────────────────────────────────────

async function settleWallets(state, nsp) {
  for (const p of (state.players || [])) {
    if (!p || p.isBot) continue;
    if (p._settled) {
      console.log(`[Poker] settleWallets: userId=${p.id} already settled, skipping`);
      continue;
    }

    const finalChips = parseFloat(p.chips) || 0;
    console.log(`[Poker] settleWallets: userId=${p.id}, finalChips=${finalChips}`);

    const result = await pokerDb.creditWinnings(p.id, finalChips);
    if (result.success) {
      console.log(`[Poker] settleWallets: credited ${finalChips} to userId=${p.id}, newBalance=${result.newBalance}`);
      p._settled = true;
      if (p.socketId) {
        nsp.to(p.socketId).emit("BALANCE_UPDATE", {
          chips:         finalChips,
          walletBalance: result.newBalance,
        });
      }
    } else {
      console.error(`[Poker] settleWallets failed for userId=${p.id}: ${result.error}`);
    }
  }
}

// ── Move to next player ──────────────────────────────────────────────────────

/**
 * Advance currentPlayerIndex to the next actionable player in the FULL array.
 * Returns true if a valid player was found, false if none exist.
 */
function moveToNextPlayer(state) {
  const len = state.players.length;
  if (len === 0) return false;

  const start = state.currentPlayerIndex;
  let nextIdx = (start + 1) % len;
  let count = 0;

  while (count < len) {
    const p = state.players[nextIdx];
    if (p && p.isActive && !p.folded && !p.allIn) {
      state.currentPlayerIndex = nextIdx;
      return true;
    }
    nextIdx = (nextIdx + 1) % len;
    count++;
  }

  // No actionable player found
  return false;
}

// ── Broadcast state ──────────────────────────────────────────────────────────

function broadcastState(room, nsp) {
  (room.state.players || []).forEach(p => {
    if (!p || p.isBot || !p.socketId) return;
    const sanitized = sanitizeState(room.state, p.id);
    nsp.to(p.socketId).emit("MATCH_UPDATE", sanitized);
  });
}

// ── Try to start a round ─────────────────────────────────────────────────────

async function tryStartRound(room, nsp) {
  console.log(`[Poker] tryStartRound room=${room.id} inProgress=${room.roundInProgress}`);

  // Stale-round watchdog: if a round has been "in progress" for >5 minutes, reset it
  if (room.roundInProgress && room._roundStartedAt) {
    const elapsed = Date.now() - room._roundStartedAt;
    if (elapsed > 5 * 60 * 1000) {
      console.warn(`[Poker] Stale round detected in room ${room.id} (${Math.round(elapsed/1000)}s) — resetting`);
      clearTurnTimer(room);
      room.roundInProgress = false;
      room._roundStartedAt = null;
      room.state.phase = "WAITING";
    }
  }

  if (room.roundInProgress) return;

  // Reload configs
  try {
    room.sysConfig = await pokerDb.loadSystemConfigs();
    room.config    = await pokerDb.loadRoomConfig(room.id);
    room.state.roomConfig = room.config;
    room.state.config     = room.sysConfig;
  } catch (e) {
    console.error("[Poker] tryStartRound: config reload failed:", e.message);
  }

  // Remove bots from previous round (chips reset)
  room.players.forEach((p, i) => {
    if (p && p.isBot) room.players[i] = null;
  });
  room.state.players = room.players;

  // Fill bots
  const botsAdded = fillBots(room, room.sysConfig);
  if (botsAdded.length > 0) {
    room.state.players = room.players;
    broadcastState(room, nsp);
  }

  if (!canStartRound(room, room.sysConfig)) {
    console.log(`[Poker] tryStartRound: not enough players to start`);
    return;
  }

  room.roundInProgress = true;
  room._roundStartedAt = Date.now();

  // Reset _settled flag for all human players before new round
  room.players.forEach(p => {
    if (p && !p.isBot) p._settled = false;
  });

  const state = startRound(room.state);
  if (!state) {
    console.warn("[Poker] startRound returned null — resetting");
    room.roundInProgress = false;
    room._roundStartedAt = null;
    return;
  }

  console.log(`[Poker] Round started in room ${room.id}, phase=${state.phase}, players=${state.players.filter(p=>p).length}`);

  // Emit START_GAME + DEAL to each human player
  room.state.players.forEach(p => {
    if (!p || p.isBot || !p.socketId) return;
    const sanitized = sanitizeState(room.state, p.id);
    nsp.to(p.socketId).emit("START_GAME", sanitized);
    nsp.to(p.socketId).emit("DEAL", sanitized);
  });

  startTurnTimer(room, nsp);
}

// ── Room list (for lobby) ────────────────────────────────────────────────────

async function getRoomList() {
  const configs = await pokerDb.loadRoomConfigs();
  return configs.map(cfg => {
    const room = rooms.get(cfg.id);
    const playerCount = room
      ? room.players.filter(p => p && p.isActive && !p.isBot).length
      : 0;
    return {
      id:          cfg.id,
      name:        cfg.name,
      smallBlind:  cfg.small_blind,
      bigBlind:    cfg.big_blind,
      minBuyIn:    cfg.min_buyin,
      maxBuyIn:    cfg.max_buyin,
      maxPlayers:  cfg.max_players,
      playerCount,
      phase:       room?.state?.phase || "WAITING",
    };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN INIT
// ══════════════════════════════════════════════════════════════════════════════

function initPokerSocket(io) {
  const nsp = io.of("/poker");

  nsp.on("connection", (socket) => {
    console.log(`[Poker] Client connected: ${socket.id}`);

    // ── GET_ROOMS ──
    socket.on("GET_ROOMS", async () => {
      try {
        socket.emit("ROOM_LIST", await getRoomList());
      } catch (e) {
        console.error("[Poker] GET_ROOMS error:", e.message);
      }
    });

    // ── JOIN_ROOM ──
    socket.on("JOIN_ROOM", async ({ roomId, userId, userName, buyIn }) => {
      try {
        if (!roomId || !userId) {
          socket.emit("JOIN_ERROR", { error: "Missing roomId or userId" });
          return;
        }

        const strUserId = String(userId);
        const room = await getOrCreateRoom(roomId);
        const config = room.config;

        // ── RECONNECT CHECK ──
        // If the player is already seated (by userId), restore their state.
        // Do NOT deduct buy-in again, do NOT reset chips.
        const existingIdx = room.players.findIndex(p => p && String(p.id) === strUserId);
        if (existingIdx !== -1) {
          const existing = room.players[existingIdx];
          const wasDisconnected = !existing.connected;

          // Update socket binding
          existing.socketId  = socket.id;
          existing.connected = true;

          // Clear any pending disconnect-eviction timer
          if (existing._disconnectTimer) {
            clearTimeout(existing._disconnectTimer);
            existing._disconnectTimer = null;
          }

          socket.join(room.id);
          socket.data = { roomId, userId: strUserId };

          console.log(`[Poker] RECONNECT: userId=${strUserId} rejoined room ${roomId}, chips=${existing.chips}, wasDisconnected=${wasDisconnected}`);

          socket.emit("JOIN_SUCCESS", {
            state:         sanitizeState(room.state, strUserId),
            reconnected:   true,
            walletBalance: existing._walletBalance || null,
          });

          // If it's their turn, re-emit TURN so they see the action buttons
          const currentPlayer = room.state.players[room.state.currentPlayerIndex];
          if (currentPlayer && String(currentPlayer.id) === strUserId && room.roundInProgress) {
            const sysConfig = room.sysConfig || {};
            const timeoutMs = parseInt(sysConfig.turn_timeout_ms || "30000", 10);
            socket.emit("TURN", { playerId: strUserId, timeoutMs });
          }

          broadcastState(room, nsp);
          return;
        }

        // ── NEW JOIN ──
        const minBuyin = config.min_buyin || 100;
        const maxBuyin = config.max_buyin || 300;
        const numBuyIn = parseFloat(buyIn) || minBuyin;

        if (numBuyIn < minBuyin || numBuyIn > maxBuyin) {
          socket.emit("JOIN_ERROR", { error: `買入金額需在 ${minBuyin}–${maxBuyin} U 之間` });
          return;
        }

        // Find empty seat
        const emptySeat = room.players.findIndex(p => p === null);
        if (emptySeat === -1) {
          socket.emit("JOIN_ERROR", { error: "房間已滿" });
          return;
        }

        // Deduct buy-in from wallet
        const deductResult = await pokerDb.deductBuyIn(strUserId, numBuyIn);
        if (!deductResult.success) {
          if (deductResult.error && deductResult.error.includes("餘額不足")) {
            socket.emit("JOIN_ERROR", { error: deductResult.error });
            return;
          }
          // User not in DB (guest/test mode) — allow join without deduction
          console.warn(`[Poker] JOIN_ROOM: deductBuyIn failed (${deductResult.error}), allowing guest join`);
        } else {
          console.log(`[Poker] JOIN_ROOM: deducted ${numBuyIn} from userId=${strUserId}, newBalance=${deductResult.newBalance}`);
        }

        const player = {
          id:              strUserId,
          name:            userName || "玩家",
          chips:           numBuyIn,
          buyIn:           numBuyIn,
          totalBuyIn:      numBuyIn,
          bet:             0,
          totalBet:        0,
          folded:          false,
          allIn:           false,
          isActive:        true,
          isBot:           false,
          cards:           [],
          lastAction:      null,
          hasActed:        false,
          seatIndex:       emptySeat,
          socketId:        socket.id,
          connected:       true,
          _settled:        false,
          _walletBalance:  deductResult.newBalance || null,
        };

        room.players[emptySeat] = player;
        room.state.players = room.players;

        socket.join(room.id);
        socket.data = { roomId, userId: strUserId };

        socket.emit("JOIN_SUCCESS", {
          state:         sanitizeState(room.state, strUserId),
          reconnected:   false,
          walletBalance: deductResult.newBalance || null,
        });

        broadcastState(room, nsp);

        console.log(`[Poker] Player ${strUserId} joined room ${roomId} at seat ${emptySeat}`);
        setTimeout(() => tryStartRound(room, nsp), 2000);

      } catch (e) {
        console.error("[Poker] JOIN_ROOM error:", e.message, e.stack);
        socket.emit("JOIN_ERROR", { error: "加入房間失敗" });
      }
    });

    // ── ACTION ──
    socket.on("ACTION", ({ roomId, action, amount }) => {
      try {
        const userId = socket.data?.userId;
        if (!userId || !roomId) {
          console.log(`[Poker] ACTION rejected: missing userId or roomId`);
          return;
        }

        const room = rooms.get(roomId);
        if (!room) {
          console.log(`[Poker] ACTION rejected: room ${roomId} not found`);
          return;
        }

        console.log(`[Poker] ACTION: userId=${userId} action=${action} amount=${amount}`);
        clearTurnTimer(room);
        processAction(room, userId, action, amount || 0, nsp);
      } catch (e) {
        console.error("[Poker] ACTION error:", e.message);
        socket.emit("ACTION_ERROR", { error: e.message });
      }
    });

    // ── REBUY ──
    socket.on("REBUY", async ({ roomId, amount }) => {
      try {
        const userId = socket.data?.userId;
        if (!userId || !roomId) {
          socket.emit("REBUY_ERROR", { error: "Missing userId or roomId" });
          return;
        }

        const room = rooms.get(roomId);
        if (!room) {
          socket.emit("REBUY_ERROR", { error: "房間不存在" });
          return;
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
          socket.emit("REBUY_ERROR", { error: "加購金額無效" });
          return;
        }

        const maxBuyin = room.config.max_buyin || 300;
        if (numAmount > maxBuyin) {
          socket.emit("REBUY_ERROR", { error: `加購金額不能超過 ${maxBuyin} U` });
          return;
        }

        const player = room.players.find(p => p && String(p.id) === String(userId));
        if (!player) {
          socket.emit("REBUY_ERROR", { error: "您不在此房間" });
          return;
        }

        const deductResult = await pokerDb.deductRebuy(String(userId), numAmount);
        if (!deductResult.success) {
          socket.emit("REBUY_ERROR", { error: deductResult.error });
          return;
        }

        player.chips      += numAmount;
        player.totalBuyIn  = (player.totalBuyIn || player.buyIn || 0) + numAmount;
        player._walletBalance = deductResult.newBalance;

        console.log(`[Poker] REBUY: userId=${userId} +${numAmount} chips → ${player.chips}, newBalance=${deductResult.newBalance}`);

        socket.emit("REBUY_SUCCESS", {
          chips:         player.chips,
          amount:        numAmount,
          walletBalance: deductResult.newBalance,
        });

        broadcastState(room, nsp);

      } catch (e) {
        console.error("[Poker] REBUY error:", e.message);
        socket.emit("REBUY_ERROR", { error: "加購失敗，請稍後再試" });
      }
    });

    // ── LEAVE_ROOM ──
    socket.on("LEAVE_ROOM", ({ roomId }) => {
      handleLeave(socket, nsp, true /* intentional leave */);
    });

    // ── disconnect ──
    socket.on("disconnect", (reason) => {
      console.log(`[Poker] Client disconnected: ${socket.id}, reason: ${reason}`);
      // On disconnect, mark as disconnected but keep seat for reconnect grace period
      handleDisconnect(socket, nsp);
    });
  });

  return { getRoomList, rooms };
}

// ── Handle disconnect (keep seat, allow reconnect) ───────────────────────────

function handleDisconnect(socket, nsp) {
  const { roomId, userId } = socket.data || {};
  if (!roomId || !userId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const player = room.players.find(p => p && String(p.id) === String(userId));
  if (!player || player.isBot) return;

  player.connected = false;
  player.socketId  = null;

  console.log(`[Poker] Player ${userId} disconnected from room ${roomId}, keeping seat for ${RECONNECT_GRACE_MS/1000}s`);

  // Broadcast disconnected state to others
  broadcastState(room, nsp);

  // If it's their turn, auto-fold after a short delay so game doesn't freeze
  const currentPlayer = room.state.players[room.state.currentPlayerIndex];
  if (currentPlayer && String(currentPlayer.id) === String(userId) && room.roundInProgress) {
    console.log(`[Poker] Disconnected player ${userId} is current player — auto-folding in 5s`);
    clearTurnTimer(room);
    room.turnTimer = setTimeout(() => {
      // Check if they've reconnected in the meantime
      const p = room.players.find(p => p && String(p.id) === String(userId));
      if (p && p.connected) {
        console.log(`[Poker] Player ${userId} reconnected before auto-fold`);
        return;
      }
      processAction(room, String(userId), "FOLD", 0, nsp);
    }, 5000);
  }

  // Schedule seat eviction after grace period
  player._disconnectTimer = setTimeout(async () => {
    const p = room.players.find(p => p && String(p.id) === String(userId));
    if (!p || p.connected) return; // Reconnected — don't evict

    console.log(`[Poker] Grace period expired for userId=${userId} — evicting from room ${roomId}`);
    await evictPlayer(room, userId, nsp);
  }, RECONNECT_GRACE_MS);
}

// ── Handle intentional leave ─────────────────────────────────────────────────

async function handleLeave(socket, nsp, intentional = false) {
  const { roomId, userId } = socket.data || {};
  if (!roomId || !userId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  socket.leave(roomId);
  await evictPlayer(room, userId, nsp);
}

// ── Evict player from room (refund chips) ────────────────────────────────────

async function evictPlayer(room, userId, nsp) {
  const strUserId = String(userId);
  const playerIdx = room.players.findIndex(p => p && String(p.id) === strUserId);
  if (playerIdx === -1) return;

  const player = room.players[playerIdx];
  if (!player) return;

  // Clear any pending disconnect timer
  if (player._disconnectTimer) {
    clearTimeout(player._disconnectTimer);
    player._disconnectTimer = null;
  }

  // Refund remaining chips if not already settled by showdown
  if (!player.isBot && !player._settled) {
    const remainingChips = parseFloat(player.chips) || 0;
    if (remainingChips > 0) {
      const refundResult = await pokerDb.refundChips(strUserId, remainingChips);
      if (refundResult.success && refundResult.refunded > 0) {
        console.log(`[Poker] evictPlayer: refunded ${refundResult.refunded} to userId=${strUserId}, newBalance=${refundResult.newBalance}`);
        // Try to notify the player if they have a socket
        if (player.socketId) {
          nsp.to(player.socketId).emit("BALANCE_UPDATE", {
            chips:         0,
            walletBalance: refundResult.newBalance,
          });
        }
      }
    }
  } else if (!player.isBot && player._settled) {
    console.log(`[Poker] evictPlayer: userId=${strUserId} already settled, no refund`);
  }

  room.players[playerIdx] = null;
  room.state.players = room.players;

  broadcastState(room, nsp);

  // Clean up room if no humans remain
  const hasHumans = room.players.some(p => p && p.isActive && !p.isBot);
  if (!hasHumans) {
    clearTurnTimer(room);
    room.players.fill(null);
    room.state.players = room.players;
    room.roundInProgress = false;
    room._roundStartedAt = null;
    console.log(`[Poker] Room ${room.id} cleared — no humans remaining`);
  }
}

module.exports = { initPokerSocket };
