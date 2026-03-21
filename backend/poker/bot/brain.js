/**
 * poker/bot/brain.js — Bot decision model
 *
 * Simple but effective AI that evaluates hand strength and makes decisions.
 * Includes occasional bluffing (12%) for realism.
 */

const { evaluateHand } = require("../core/engine");

const RANKS = "23456789TJQKA";

function getHandStrength(cards, community) {
  if (!cards || cards.length < 2) return 0.3;

  const allCards = [...cards, ...(community || [])];
  if (allCards.length < 2) return 0.3;

  const eval_ = evaluateHand(allCards);
  // Normalize rank to 0-1 scale (rank 0=high card to 8=straight flush)
  const baseStrength = (eval_.rank || 0) / 8;

  // Pre-flop: evaluate hole cards
  if (!community || community.length === 0) {
    return evaluatePreflop(cards);
  }

  return Math.min(1, baseStrength + 0.15); // Slight boost for having community cards
}

function evaluatePreflop(cards) {
  const r1 = RANKS.indexOf(cards[0][0]);
  const r2 = RANKS.indexOf(cards[1][0]);
  const suited = cards[0][1] === cards[1][1];
  const isPair = r1 === r2;

  if (isPair) {
    if (r1 >= 10) return 0.9;  // AA, KK, QQ
    if (r1 >= 7)  return 0.75; // JJ, TT, 99
    return 0.55;                // Low pairs
  }

  const high = Math.max(r1, r2);
  const low  = Math.min(r1, r2);
  const gap  = high - low;

  let strength = (high + low) / 24; // Base from card ranks
  if (suited) strength += 0.08;
  if (gap <= 2) strength += 0.05;
  if (high >= 11 && low >= 9) strength += 0.15; // AK, AQ, KQ etc.

  return Math.min(0.95, Math.max(0.1, strength));
}

function decide(bot, state, sysConfig) {
  const strength = getHandStrength(bot.cards, state.community);
  const potOdds = state.pot > 0 ? (state.currentBet - (bot.bet || 0)) / (state.pot + state.currentBet) : 0;
  const callAmount = (state.currentBet || 0) - (bot.bet || 0);
  const canCheck = callAmount <= 0;
  const chipRatio = bot.chips / (state.pot || 1);

  // Random factor for unpredictability
  const rand = Math.random();
  const bluffChance = 0.12;

  // Strong hand (>0.7)
  if (strength > 0.7) {
    if (rand < 0.4) {
      // Raise
      const raiseAmount = Math.min(
        bot.chips,
        (state.currentBet || 0) + (state.bigBlind || 2) * (2 + Math.floor(Math.random() * 3))
      );
      return { action: "RAISE", amount: raiseAmount };
    }
    if (rand < 0.7 && !canCheck) {
      return { action: "CALL", amount: 0 };
    }
    if (canCheck) return { action: "CHECK", amount: 0 };
    return { action: "CALL", amount: 0 };
  }

  // Medium hand (0.4-0.7)
  if (strength > 0.4) {
    if (canCheck) {
      if (rand < 0.2) {
        const raiseAmount = Math.min(bot.chips, (state.currentBet || 0) + (state.bigBlind || 2) * 2);
        return { action: "RAISE", amount: raiseAmount };
      }
      return { action: "CHECK", amount: 0 };
    }
    if (callAmount <= bot.chips * 0.3) {
      return { action: "CALL", amount: 0 };
    }
    if (rand < 0.3) return { action: "CALL", amount: 0 };
    return { action: "FOLD", amount: 0 };
  }

  // Weak hand (<0.4)
  if (canCheck) return { action: "CHECK", amount: 0 };

  // Bluff
  if (rand < bluffChance && chipRatio > 1.5) {
    const raiseAmount = Math.min(bot.chips, (state.currentBet || 0) + (state.bigBlind || 2) * 3);
    return { action: "RAISE", amount: raiseAmount };
  }

  // Small bet → sometimes call
  if (callAmount <= (state.bigBlind || 2) * 2 && rand < 0.3) {
    return { action: "CALL", amount: 0 };
  }

  return { action: "FOLD", amount: 0 };
}

module.exports = { decide, getHandStrength };
