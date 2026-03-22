/**
 * Betting Actions — Texas Hold'em
 * All bet limits derived from room config (no hard-coded values).
 */

const { getActivePlayers } = require("./state");

/**
 * Apply a player action to the game state.
 *
 * @param {object} state   - Current game state
 * @param {string} playerId
 * @param {string} action  - FOLD | CHECK | CALL | RAISE | ALL_IN
 * @param {number} amount  - Raise amount (only for RAISE)
 * @returns {{ success: boolean, error?: string }}
 */
function applyAction(state, playerId, action, amount = 0) {
  const player = state.players.find(p => p && String(p.id) === String(playerId));
  if (!player) return { success: false, error: "Player not found" };
  if (player.folded || player.allIn) return { success: false, error: "Player already out of action" };

  const currentIdx = state.currentPlayerIndex;
  // currentPlayerIndex is an index into the FULL players array (set by dealer.js),
  // NOT into the filtered active-only array.
  const currentPlayer = state.players[currentIdx];
  if (!currentPlayer || String(currentPlayer.id) !== String(playerId)) {
    return { success: false, error: "Not your turn" };
  }

  const callAmount = state.currentBet - player.bet;

  switch (action.toUpperCase()) {
    case "FOLD":
      return applyFold(state, player);

    case "CHECK":
      if (callAmount > 0) return { success: false, error: "Cannot check, must call or fold" };
      return applyCheck(state, player);

    case "CALL":
      return applyCall(state, player, callAmount);

    case "RAISE":
      return applyRaise(state, player, amount);

    case "ALL_IN":
      return applyAllIn(state, player);

    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

function applyFold(state, player) {
  player.folded = true;
  player.lastAction = "FOLD";
  recordHistory(state, player, "FOLD", 0);
  return { success: true };
}

function applyCheck(state, player) {
  player.lastAction = "CHECK";
  recordHistory(state, player, "CHECK", 0);
  return { success: true };
}

function applyCall(state, player, callAmount) {
  const actual = Math.min(callAmount, player.chips);
  player.chips    -= actual;
  player.bet      += actual;
  player.totalBet += actual;
  state.pot       += actual;

  if (player.chips === 0) {
    player.allIn = true;
    player.lastAction = "ALL_IN";
    recordHistory(state, player, "ALL_IN", actual);
  } else {
    player.lastAction = "CALL";
    recordHistory(state, player, "CALL", actual);
  }
  return { success: true };
}

function applyRaise(state, player, raiseToAmount) {
  // raiseToAmount = total bet this street (not the increment)
  const minRaiseTo = state.currentBet + state.minRaise;
  if (raiseToAmount < minRaiseTo) {
    return { success: false, error: `Minimum raise to ${minRaiseTo}` };
  }
  if (raiseToAmount > player.chips + player.bet) {
    return { success: false, error: "Raise exceeds chip stack" };
  }

  const toAdd = raiseToAmount - player.bet;
  player.chips    -= toAdd;
  player.bet       = raiseToAmount;
  player.totalBet += toAdd;
  state.pot       += toAdd;

  state.lastRaiseAmount = raiseToAmount - state.currentBet;
  state.minRaise        = state.lastRaiseAmount;
  state.currentBet      = raiseToAmount;

  if (player.chips === 0) {
    player.allIn = true;
    player.lastAction = "ALL_IN";
    recordHistory(state, player, "ALL_IN", toAdd);
  } else {
    player.lastAction = "RAISE";
    recordHistory(state, player, "RAISE", raiseToAmount);
  }
  return { success: true };
}

function applyAllIn(state, player) {
  const allInAmount = player.chips + player.bet;
  const toAdd = player.chips;

  if (allInAmount > state.currentBet) {
    state.lastRaiseAmount = allInAmount - state.currentBet;
    state.minRaise        = state.lastRaiseAmount;
    state.currentBet      = allInAmount;
  }

  player.totalBet += toAdd;
  player.bet       = allInAmount;
  state.pot       += toAdd;
  player.chips     = 0;
  player.allIn     = true;
  player.lastAction = "ALL_IN";
  recordHistory(state, player, "ALL_IN", toAdd);
  return { success: true };
}

/**
 * Check if the current betting round is complete.
 * Round is over when all active non-all-in players have acted
 * and their bets equal the current bet.
 */
function isBettingRoundOver(state) {
  const active = getActivePlayers(state).filter(p => !p.allIn);
  if (active.length === 0) return true; // everyone all-in or folded

  return active.every(p => {
    // Must have acted (lastAction set) AND matched the current bet
    return p.lastAction !== null && p.bet === state.currentBet;
  });
}

function recordHistory(state, player, action, amount) {
  if (!state.history) state.history = [];
  state.history.push({
    phase:    state.phase,
    playerId: player.id,
    name:     player.name,
    action,
    amount,
    ts:       Date.now(),
  });
}

module.exports = { applyAction, isBettingRoundOver };
