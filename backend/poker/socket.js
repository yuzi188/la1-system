/**
 * poker/socket.js — Socket.IO /poker namespace handler
 *
 * This is the main integration point. It creates a /poker namespace on the
 * shared Socket.IO server and handles all poker events.
 *
 * Events (client → server):
 *   GET_ROOMS, JOIN_ROOM, ACTION, LEAVE_ROOM
 *
 * Events (server → client):
 *   JOIN_SUCCESS, JOIN_ERROR, MATCH_UPDATE, START_GAME, DEAL, TURN,
 *   TURN_WARNING, ACTION, FLOP, TURN_CARD, RIVER, SHOWDOWN, SETTLE,
 *   BALANCE_UPDATE
 */

const { createGameState } = require("./core/state");
const { startRound, handleAction, advancePhase } = require("./core/dealer");
const { fillBots, canStartRound } = require("./core/matchmaking");
const { decide } = require("./bot/brain");
const { recordAction } = require("./bot/memory");
const pokerDb = require("./db");

// ── In-memory room store ─────────────────────────────────────────────────────
const rooms = new Map();

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
    roundInProgress: false,
  };

  // Create initial game state
  room.state = createGameState(maxPlayers);
  room.state.roomId = roomId;
  room.state.smallBlind = roomConfig.small_blind || 1;
  room.state.bigBlind = roomConfig.big_blind || 2;
  room.state.roomConfig = roomConfig;
  room.state.config = sysConfig;
  room.state.players = room.players;

  rooms.set(roomId, room);
  return room;
}

function sanitizeState(state, forPlayerId) {
  if (!state) return null;
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
    players: (state.players || []).map((p, idx) => {
      if (!p) return null;
      const isMe = p.id === forPlayerId;
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
        cards: (isMe || isShowdown) ? (p.cards || []) : (p.cards ? ["??", "??"] : []),
      };
    }),
  };
}

// ── Turn timer management ────────────────────────────────────────────────────

function clearTurnTimer(room) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
  if (room._warningTimer) {
    clearTimeout(room._warningTimer);
    room._warningTimer = null;
  }
}

function startTurnTimer(room, nsp) {
  clearTurnTimer(room);

  const state = room.state;
  const sysConfig = room.sysConfig || {};
  const timeoutMs = parseInt(sysConfig.turn_timeout_ms || "30000", 10);
  const warningMs = parseInt(sysConfig.turn_warning_ms || "10000", 10);

  // Find current player — currentPlayerIndex is an index into the FULL players array
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || !currentPlayer.isActive || currentPlayer.folded || currentPlayer.allIn) return;

  // Emit TURN event
  nsp.to(room.id).emit("TURN", {
    playerId: currentPlayer.id,
    timeoutMs,
  });

  // If it's a bot, auto-decide after random delay
  if (currentPlayer.isBot) {
    const thinkTime = 1500 + Math.floor(Math.random() * 2500);
    room.turnTimer = setTimeout(() => {
      executeBotAction(room, currentPlayer, nsp);
    }, thinkTime);
    return;
  }

  // Warning timer for human
  room._warningTimer = setTimeout(() => {
    nsp.to(room.id).emit("TURN_WARNING", { playerId: currentPlayer.id, remainingMs: warningMs });
  }, timeoutMs - warningMs);

  // Timeout → auto fold
  room.turnTimer = setTimeout(() => {
    processAction(room, currentPlayer.id, "FOLD", 0, nsp);
  }, timeoutMs);
}

// ── Bot action execution ─────────────────────────────────────────────────────

function executeBotAction(room, bot, nsp) {
  const decision = decide(bot, room.state, room.sysConfig || {});
  processAction(room, bot.id, decision.action, decision.amount, nsp);
}

// ── Process player/bot action ────────────────────────────────────────────────

function processAction(room, playerId, action, amount, nsp) {
  const state = room.state;
  const result = handleAction(state, playerId, action, amount);

  if (!result.success) {
    // Find socket for this player and send error
    return;
  }

  // Record for memory
  recordAction(playerId, action, state.phase);

  // Broadcast action
  nsp.to(room.id).emit("ACTION", {
    playerId,
    action,
    amount: result.amount || 0,
    pot: state.pot,
  });

  // Send updated state to each player (with private card masking)
  broadcastState(room, nsp);

  // Check if phase should advance
  const advResult = advancePhase(state);

  if (advResult.advance) {
    clearTurnTimer(room);

    if (advResult.phase === "SHOWDOWN") {
      // Showdown
      nsp.to(room.id).emit("SHOWDOWN", {
        community: advResult.community || state.community,
        showdown: advResult.showdown,
        winners: advResult.winners,
      });

      nsp.to(room.id).emit("SETTLE", {
        winners: advResult.winners,
        rake: advResult.rake,
      });

      // Send balance updates
      state.players.forEach(p => {
        if (!p || p.isBot) return;
        if (p.socketId) {
          nsp.to(p.socketId).emit("BALANCE_UPDATE", { chips: p.chips });
        }
      });

      room.roundInProgress = false;

      // Start next round after delay
      setTimeout(() => {
        tryStartRound(room, nsp);
      }, 8000);

    } else if (advResult.phase === "FLOP") {
      nsp.to(room.id).emit("FLOP", { cards: advResult.cards });
      if (advResult.autoRun) {
        // All-in runout: auto-advance after delay
        setTimeout(() => processAutoRun(room, nsp), 1500);
      } else {
        startTurnTimer(room, nsp);
      }

    } else if (advResult.phase === "TURN") {
      nsp.to(room.id).emit("TURN_CARD", { card: advResult.cards[0] });
      if (advResult.autoRun) {
        setTimeout(() => processAutoRun(room, nsp), 1500);
      } else {
        startTurnTimer(room, nsp);
      }

    } else if (advResult.phase === "RIVER") {
      nsp.to(room.id).emit("RIVER", { card: advResult.cards[0] });
      if (advResult.autoRun) {
        setTimeout(() => processAutoRun(room, nsp), 1500);
      } else {
        startTurnTimer(room, nsp);
      }
    }
  } else {
    // Move to next player
    moveToNextPlayer(state);
    startTurnTimer(room, nsp);
  }
}

function processAutoRun(room, nsp) {
  const advResult = advancePhase(room.state);
  if (advResult.advance) {
    if (advResult.phase === "SHOWDOWN") {
      nsp.to(room.id).emit("SHOWDOWN", {
        community: advResult.community || room.state.community,
        showdown: advResult.showdown,
        winners: advResult.winners,
      });
      nsp.to(room.id).emit("SETTLE", { winners: advResult.winners, rake: advResult.rake });
      room.roundInProgress = false;
      setTimeout(() => tryStartRound(room, nsp), 8000);
    } else {
      const eventMap = { FLOP: "FLOP", TURN: "TURN_CARD", RIVER: "RIVER" };
      const event = eventMap[advResult.phase];
      if (event === "FLOP") {
        nsp.to(room.id).emit(event, { cards: advResult.cards });
      } else {
        nsp.to(room.id).emit(event, { card: advResult.cards[0] });
      }
      setTimeout(() => processAutoRun(room, nsp), 1500);
    }
  }
}

function moveToNextPlayer(state) {
  // currentPlayerIndex is an index into the FULL players array.
  // We must iterate the full array to find the next active, non-folded, non-allIn player.
  const len = state.players.length;
  if (len === 0) return;

  let nextIdx = (state.currentPlayerIndex + 1) % len;
  let count = 0;
  while (count < len) {
    const p = state.players[nextIdx];
    if (p && p.isActive && !p.folded && !p.allIn) break;
    nextIdx = (nextIdx + 1) % len;
    count++;
  }
  state.currentPlayerIndex = nextIdx;
}

function broadcastState(room, nsp) {
  room.state.players.forEach(p => {
    if (!p || p.isBot || !p.socketId) return;
    const sanitized = sanitizeState(room.state, p.id);
    nsp.to(p.socketId).emit("MATCH_UPDATE", sanitized);
  });
}

// ── Try to start a round ─────────────────────────────────────────────────────

async function tryStartRound(room, nsp) {
  console.log(`[Poker] tryStartRound room=${room.id} inProgress=${room.roundInProgress} players=${room.players.filter(p=>p).length}`);
  if (room.roundInProgress) return;

  // Reload configs
  room.sysConfig = await pokerDb.loadSystemConfigs();
  room.config = await pokerDb.loadRoomConfig(room.id);
  room.state.roomConfig = room.config;
  room.state.config = room.sysConfig;

  // Fill bots
  const botsAdded = fillBots(room, room.sysConfig);
  if (botsAdded.length > 0) {
    // Sync room.players to state.players
    room.state.players = room.players;
    broadcastState(room, nsp);
  }

  // Check if we can start
  if (!canStartRound(room, room.sysConfig)) return;

  room.roundInProgress = true;
  const state = startRound(room.state);
  if (!state) {
    room.roundInProgress = false;
    return;
  }

  // Emit start
  room.state.players.forEach(p => {
    if (!p || p.isBot || !p.socketId) return;
    const sanitized = sanitizeState(room.state, p.id);
    nsp.to(p.socketId).emit("START_GAME", sanitized);
    nsp.to(p.socketId).emit("DEAL", sanitized);
  });

  // Start first turn timer
  startTurnTimer(room, nsp);
}

// ── Get room list for lobby ──────────────────────────────────────────────────

async function getRoomList() {
  const configs = await pokerDb.loadRoomConfigs();
  return configs.map(cfg => {
    const room = rooms.get(cfg.id);
    const playerCount = room
      ? room.players.filter(p => p && p.isActive && !p.isBot).length
      : 0;
    return {
      id: cfg.id,
      name: cfg.name,
      smallBlind: cfg.small_blind,
      bigBlind: cfg.big_blind,
      minBuyIn: cfg.min_buyin,
      maxBuyIn: cfg.max_buyin,
      maxPlayers: cfg.max_players,
      playerCount,
      phase: room?.state?.phase || "WAITING",
    };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN INIT: Attach /poker namespace to Socket.IO server
// ══════════════════════════════════════════════════════════════════════════════

function initPokerSocket(io) {
  const nsp = io.of("/poker");

  nsp.on("connection", (socket) => {
    console.log(`[Poker] Client connected: ${socket.id}`);

    // ── GET_ROOMS ──
    socket.on("GET_ROOMS", async () => {
      try {
        const list = await getRoomList();
        socket.emit("ROOM_LIST", list);
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

        const room = await getOrCreateRoom(roomId);
        const config = room.config;

        // Validate buy-in
        const minBuyin = config.min_buyin || 100;
        const maxBuyin = config.max_buyin || 300;
        if (buyIn < minBuyin || buyIn > maxBuyin) {
          socket.emit("JOIN_ERROR", { error: `買入金額需在 ${minBuyin}–${maxBuyin} U 之間` });
          return;
        }

        // Check if already in room
        const existing = room.players.find(p => p && p.id === userId);
        if (existing) {
          existing.socketId = socket.id;
          socket.join(room.id);
          socket.data = { roomId, userId };
          socket.emit("JOIN_SUCCESS", { state: sanitizeState(room.state, userId) });
          return;
        }

        // Find empty seat
        const emptySeat = room.players.findIndex(p => p === null);
        if (emptySeat === -1) {
          socket.emit("JOIN_ERROR", { error: "房間已滿" });
          return;
        }

        // Create player
        const player = {
          id: userId,
          name: userName || "玩家",
          chips: buyIn,
          buyIn,
          bet: 0,
          totalBet: 0,
          folded: false,
          allIn: false,
          isActive: true,
          isBot: false,
          cards: [],
          lastAction: null,
          hasActed: false,
          seatIndex: emptySeat,
          socketId: socket.id,
        };

        room.players[emptySeat] = player;
        room.state.players = room.players;

        socket.join(room.id);
        socket.data = { roomId, userId };

        socket.emit("JOIN_SUCCESS", { state: sanitizeState(room.state, userId) });

        // Broadcast update to others
        broadcastState(room, nsp);

        // Try to start round (will fill bots if needed)
        console.log(`[Poker] Player ${userId} joined room ${roomId}, triggering tryStartRound in 2s`);
        setTimeout(() => tryStartRound(room, nsp), 2000);

      } catch (e) {
        console.error("[Poker] JOIN_ROOM error:", e.message);
        socket.emit("JOIN_ERROR", { error: "加入房間失敗" });
      }
    });

    // ── ACTION ──
    socket.on("ACTION", ({ roomId, action, amount }) => {
      try {
        const userId = socket.data?.userId;
        if (!userId || !roomId) return;

        const room = rooms.get(roomId);
        if (!room) return;

        clearTurnTimer(room);
        processAction(room, userId, action, amount || 0, nsp);
      } catch (e) {
        console.error("[Poker] ACTION error:", e.message);
      }
    });

    // ── LEAVE_ROOM ──
    socket.on("LEAVE_ROOM", ({ roomId }) => {
      handleLeave(socket, nsp);
    });

    // ── disconnect ──
    socket.on("disconnect", () => {
      console.log(`[Poker] Client disconnected: ${socket.id}`);
      handleLeave(socket, nsp);
    });
  });

  // REST API for room list (used by lobby page)
  return {
    getRoomList,
    rooms,
  };
}

function handleLeave(socket, nsp) {
  const { roomId, userId } = socket.data || {};
  if (!roomId || !userId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const playerIdx = room.players.findIndex(p => p && p.id === userId);
  if (playerIdx !== -1) {
    room.players[playerIdx] = null;
    room.state.players = room.players;
  }

  socket.leave(roomId);
  broadcastState(room, nsp);

  // Clean up empty rooms
  const hasHumans = room.players.some(p => p && p.isActive && !p.isBot);
  if (!hasHumans) {
    clearTurnTimer(room);
    // Remove all bots
    room.players.fill(null);
    room.state.players = room.players;
    room.roundInProgress = false;
  }
}

module.exports = { initPokerSocket };
