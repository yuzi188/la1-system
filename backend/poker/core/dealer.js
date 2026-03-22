/**
 * poker/core/dealer.js — Game flow controller
 *
 * Manages round lifecycle: deal, blinds, advance phases, showdown, settle.
 *
 * IMPORTANT: currentPlayerIndex is always an index into the FULL state.players
 * array (which may contain nulls for empty seats), NOT a filtered active array.
 */

const { createGameState, createDeck } = require("./state");
const { handleBet }    = require("./actions");
const { evaluateHand } = require("./engine");
const { buildSidePots, distributePots } = require("./sidepot");
const { calculateRake } = require("./rake");
const pokerDb = require("../db");

// ── Start a new round ────────────────────────────────────────────────────────

function startRound(state) {
  const activePlayers = state.players.filter(p => p && p.isActive && p.chips > 0);
  if (activePlayers.length < 2) return null;

  // Generate session ID
  state.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Rotate dealer (full array index)
  state.dealerIndex = findNextActive(state, state.dealerIndex);

  // Reset round state
  state.phase = "PREFLOP";
  state.pot = 0;
  state.community = [];
  state.currentBet = 0;
  state.minRaise = state.bigBlind || 2;
  state.sidePots = [];

  // Reset players
  state.players.forEach(p => {
    if (!p) return;
    p.bet = 0;
    p.totalBet = 0;
    p.folded = false;
    p.allIn = false;
    p.lastAction = null;
    p.cards = [];
    p.hasActed = false;
  });

  // Shuffle and deal
  state.deck = createDeck();
  activePlayers.forEach(p => {
    p.cards = [state.deck.pop(), state.deck.pop()];
  });

  // Post blinds (full array indices)
  const sbIndex = findNextActive(state, state.dealerIndex);
  const bbIndex = findNextActive(state, sbIndex);

  const sbPlayer = state.players[sbIndex];
  const bbPlayer = state.players[bbIndex];

  const sbAmount = Math.min(state.smallBlind || 1, sbPlayer.chips);
  const bbAmount = Math.min(state.bigBlind || 2, bbPlayer.chips);

  sbPlayer.chips -= sbAmount;
  sbPlayer.bet = sbAmount;
  sbPlayer.totalBet = sbAmount;
  if (sbPlayer.chips <= 0) sbPlayer.allIn = true;

  bbPlayer.chips -= bbAmount;
  bbPlayer.bet = bbAmount;
  bbPlayer.totalBet = bbAmount;
  if (bbPlayer.chips <= 0) bbPlayer.allIn = true;

  state.pot = sbAmount + bbAmount;
  state.currentBet = bbAmount;

  // First to act is after BB (full array index, skip folded/all-in)
  state.currentPlayerIndex = findNextActiveIndex(state, bbIndex);

  console.log(`[Dealer] startRound: dealer=${state.dealerIndex}, sb=${sbIndex}, bb=${bbIndex}, firstToAct=${state.currentPlayerIndex}, player=${state.players[state.currentPlayerIndex]?.id}`);

  // Persist
  pokerDb.saveRound(state.sessionId, state.roomId, state).catch(() => {});

  return state;
}

// ── Handle player action ─────────────────────────────────────────────────────

function handleAction(state, playerId, action, amount) {
  // Use String() for safe comparison
  const player = state.players.find(p => p && String(p.id) === String(playerId));
  if (!player || player.folded || !player.isActive) return { success: false, error: "Invalid player" };

  const result = handleBet(state, player, action, amount);
  if (!result.success) return result;

  // Log action
  pokerDb.logAction(state.sessionId, playerId, action, result.amount || 0, state.phase).catch(() => {});

  player.hasActed = true;
  // lastAction is already set by handleBet/applyAction

  return result;
}

// ── Advance to next phase ────────────────────────────────────────────────────

function advancePhase(state) {
  const activePlayers = state.players.filter(p => p && p.isActive && !p.folded);

  // Only one player left → auto-win
  if (activePlayers.length <= 1) {
    return settleRound(state);
  }

  // Check if all active non-allin players have acted and bets are equal
  const nonAllIn = activePlayers.filter(p => !p.allIn);
  const allActed = nonAllIn.every(p => p.hasActed);
  const betsEqual = nonAllIn.every(p => p.bet === state.currentBet) || nonAllIn.length === 0;

  if (!allActed || !betsEqual) return { advance: false };

  // Move to next phase
  const phases = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"];
  const currentIdx = phases.indexOf(state.phase);

  if (currentIdx >= 3) {
    // After RIVER → SHOWDOWN
    return settleRound(state);
  }

  const nextPhase = phases[currentIdx + 1];
  state.phase = nextPhase;

  // Reset bets for new street
  state.players.forEach(p => {
    if (!p) return;
    p.bet = 0;
    p.hasActed = false;
    p.lastAction = null;
  });
  state.currentBet = 0;
  state.minRaise = state.bigBlind || 2;

  // Deal community cards
  let newCards = [];
  if (nextPhase === "FLOP") {
    state.deck.pop(); // burn
    newCards = [state.deck.pop(), state.deck.pop(), state.deck.pop()];
    state.community = newCards;
  } else if (nextPhase === "TURN" || nextPhase === "RIVER") {
    state.deck.pop(); // burn
    const card = state.deck.pop();
    newCards = [card];
    state.community.push(card);
  }

  // If all remaining players are all-in, auto-run to showdown
  if (nonAllIn.length === 0 && activePlayers.length > 1) {
    return { advance: true, phase: nextPhase, cards: newCards, autoRun: true };
  }

  // Set first to act (after dealer, full array index)
  state.currentPlayerIndex = findNextActiveNonFoldIndex(state, state.dealerIndex);

  console.log(`[Dealer] advancePhase to ${nextPhase}: firstToAct=${state.currentPlayerIndex}, player=${state.players[state.currentPlayerIndex]?.id}`);

  return { advance: true, phase: nextPhase, cards: newCards, autoRun: false };
}

// ── Settle round (showdown or last-man-standing) ─────────────────────────────

function settleRound(state) {
  const activePlayers = state.players.filter(p => p && p.isActive && !p.folded);
  state.phase = "SHOWDOWN";

  // Calculate rake
  const sysConfig = state.config || {};
  const roomConfig = state.roomConfig || {};
  const rakePercent = parseFloat(roomConfig.rake_percent || sysConfig.rake_percent || "0.05");
  const rakeCap = parseFloat(roomConfig.rake_cap || sysConfig.rake_cap || "10");
  const rake = calculateRake(state.pot, { rake_percent: rakePercent, rake_cap: rakeCap });
  const distributablePot = state.pot - rake;

  let winners = [];
  let showdown = [];

  if (activePlayers.length === 1) {
    // Last man standing
    const winner = activePlayers[0];
    winner.chips += distributablePot;
    winners = [{ playerId: winner.id, name: winner.name, amount: distributablePot, handName: "其他玩家棄牌" }];
    showdown = [{ playerId: winner.id, name: winner.name, cards: winner.cards, handName: "Winner", won: distributablePot }];
  } else {
    // Evaluate hands
    const results = activePlayers.map(p => {
      const allCards = [...(p.cards || []), ...(state.community || [])];
      const eval_ = evaluateHand(allCards);
      return { player: p, ...eval_ };
    });

    // Sort by hand rank (higher is better)
    results.sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      // Compare kickers
      for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
        if (b.kickers[i] !== a.kickers[i]) return b.kickers[i] - a.kickers[i];
      }
      return 0;
    });

    // Build side pots and distribute
    const sidePots = buildSidePots(state);
    if (sidePots.length > 0) {
      const distributions = distributePots(sidePots, results);
      distributions.forEach(d => {
        const player = state.players.find(p => p && String(p.id) === String(d.playerId));
        if (player) player.chips += d.amount;
        winners.push({ playerId: d.playerId, name: player?.name, amount: d.amount, handName: d.handName || "" });
      });
    } else {
      // Simple pot distribution to best hand(s)
      const bestRank = results[0].rank;
      const bestKickers = results[0].kickers;
      const tiedWinners = results.filter(r => {
        if (r.rank !== bestRank) return false;
        for (let i = 0; i < Math.min(r.kickers.length, bestKickers.length); i++) {
          if (r.kickers[i] !== bestKickers[i]) return false;
        }
        return true;
      });

      const share = distributablePot / tiedWinners.length;
      tiedWinners.forEach(r => {
        r.player.chips += share;
        winners.push({ playerId: r.player.id, name: r.player.name, amount: share, handName: r.name || "" });
      });
    }

    // Build showdown data
    showdown = results.map(r => ({
      playerId: r.player.id,
      name: r.player.name,
      cards: r.player.cards,
      handName: r.name || "",
      won: winners.find(w => String(w.playerId) === String(r.player.id))?.amount || 0,
    }));
  }

  // Persist
  pokerDb.finalizeRound(state.sessionId, winners, rake).catch(() => {});

  return {
    advance: true,
    phase: "SHOWDOWN",
    showdown,
    winners,
    community: state.community,
    rake,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find next active (non-folded) player index in the FULL players array.
 */
function findNextActive(state, fromIndex) {
  let idx = (fromIndex + 1) % state.players.length;
  let count = 0;
  while (count < state.players.length) {
    const p = state.players[idx];
    if (p && p.isActive && !p.folded) return idx;
    idx = (idx + 1) % state.players.length;
    count++;
  }
  return fromIndex;
}

/**
 * Find next active, non-folded, non-all-in player index in the FULL players array.
 */
function findNextActiveIndex(state, fromIndex) {
  let idx = (fromIndex + 1) % state.players.length;
  let count = 0;
  while (count < state.players.length) {
    const p = state.players[idx];
    if (p && p.isActive && !p.folded && !p.allIn) return idx;
    idx = (idx + 1) % state.players.length;
    count++;
  }
  return fromIndex;
}

function findNextActiveNonFoldIndex(state, fromIndex) {
  return findNextActiveIndex(state, fromIndex);
}

module.exports = { startRound, handleAction, advancePhase, settleRound };
