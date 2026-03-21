const RANKS = "23456789TJQKA";

function getCounts(cards) {
  const map = {};
  cards.forEach(c => {
    const v = c[0];
    map[v] = (map[v] || 0) + 1;
  });
  return map;
}

function isFlush(cards) {
  const suits = cards.map(c => c[1]);
  return suits.every(s => s === suits[0]);
}

function isStraight(values) {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  if (sorted.length < 5) return false;
  // Check for A-2-3-4-5 (wheel)
  if (sorted.includes(12) && sorted.includes(0) && sorted.includes(1) && sorted.includes(2) && sorted.includes(3)) {
    return true;
  }
  for (let i = 0; i <= sorted.length - 5; i++) {
    if (sorted[i + 4] - sorted[i] === 4) return true;
  }
  return false;
}

function getBestFive(cards) {
  // Generate all 5-card combinations from 7 cards
  const combos = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        for (let l = k + 1; l < cards.length; l++) {
          for (let m = l + 1; m < cards.length; m++) {
            combos.push([cards[i], cards[j], cards[k], cards[l], cards[m]]);
          }
        }
      }
    }
  }
  let bestScore = -1;
  let bestHand = null;
  let bestHighCards = [];
  combos.forEach(hand => {
    const score = evaluateHand(hand);
    const highCards = getHighCards(hand, score);
    if (score > bestScore || (score === bestScore && compareHighCards(highCards, bestHighCards) > 0)) {
      bestScore = score;
      bestHand = hand;
      bestHighCards = highCards;
    }
  });
  return { score: bestScore, hand: bestHand, highCards: bestHighCards };
}

function getHighCards(cards, rank) {
  const values = cards.map(c => RANKS.indexOf(c[0])).sort((a, b) => b - a);
  const counts = getCounts(cards);
  const groups = Object.entries(counts)
    .map(([k, v]) => ({ rank: RANKS.indexOf(k), count: v }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
  return groups.map(g => g.rank);
}

function compareHighCards(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}

function evaluateHand(cards) {
  const values = cards.map(c => RANKS.indexOf(c[0]));
  const counts = Object.values(getCounts(cards)).sort((a, b) => b - a);
  const flush = isFlush(cards);
  const straight = isStraight(values);
  if (straight && flush) return 8; // Straight Flush
  if (counts[0] === 4) return 7;   // Four of a Kind
  if (counts[0] === 3 && counts[1] === 2) return 6; // Full House
  if (flush) return 5;              // Flush
  if (straight) return 4;           // Straight
  if (counts[0] === 3) return 3;   // Three of a Kind
  if (counts[0] === 2 && counts[1] === 2) return 2; // Two Pair
  if (counts[0] === 2) return 1;   // One Pair
  return 0;                         // High Card
}

function compare(players, community) {
  const results = players.map(p => {
    const allCards = [...p.cards, ...community];
    const best = getBestFive(allCards);
    return { player: p, ...best };
  });

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return compareHighCards(b.highCards, a.highCards);
  });

  // Handle ties
  const winners = [results[0]];
  for (let i = 1; i < results.length; i++) {
    if (results[i].score === results[0].score &&
        compareHighCards(results[i].highCards, results[0].highCards) === 0) {
      winners.push(results[i]);
    } else {
      break;
    }
  }

  return winners.map(w => w.player);
}

const HAND_NAMES = [
  "High Card", "One Pair", "Two Pair", "Three of a Kind",
  "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush"
];

function getHandName(score) {
  return HAND_NAMES[score] || "Unknown";
}

module.exports = { evaluateHand, compare, getBestFive, getHandName, RANKS };
