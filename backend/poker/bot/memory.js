/**
 * poker/bot/memory.js — Opponent tendency tracking
 *
 * Tracks VPIP (Voluntarily Put $ In Pot) and PFR (Pre-Flop Raise)
 * to help bots make better decisions against specific opponents.
 */

const playerMemory = new Map();

function getMemory(playerId) {
  if (!playerMemory.has(playerId)) {
    playerMemory.set(playerId, {
      hands: 0,
      vpip: 0,
      pfr: 0,
      aggression: 0,
      folds: 0,
    });
  }
  return playerMemory.get(playerId);
}

function recordAction(playerId, action, phase) {
  const mem = getMemory(playerId);
  if (phase === "PREFLOP") {
    mem.hands++;
    if (action === "CALL" || action === "RAISE" || action === "ALL_IN") mem.vpip++;
    if (action === "RAISE" || action === "ALL_IN") mem.pfr++;
  }
  if (action === "RAISE" || action === "ALL_IN") mem.aggression++;
  if (action === "FOLD") mem.folds++;
}

function getPlayerProfile(playerId) {
  const mem = getMemory(playerId);
  if (mem.hands < 3) return { type: "unknown", vpipRate: 0.5, pfrRate: 0.2 };

  const vpipRate = mem.vpip / mem.hands;
  const pfrRate  = mem.pfr / mem.hands;

  let type = "unknown";
  if (vpipRate > 0.5 && pfrRate > 0.2) type = "loose-aggressive";
  else if (vpipRate > 0.5) type = "loose-passive";
  else if (pfrRate > 0.2) type = "tight-aggressive";
  else type = "tight-passive";

  return { type, vpipRate, pfrRate };
}

function clearMemory() {
  playerMemory.clear();
}

module.exports = { getMemory, recordAction, getPlayerProfile, clearMemory };
