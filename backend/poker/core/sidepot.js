/**
 * Side-pot calculator
 * Handles all-in scenarios with multiple side pots.
 */

function sidePots(players) {
  const pots = [];
  // Only include players who have put chips in
  const active = players.filter(p => p.totalBet > 0);
  let sorted = [...active].sort((a, b) => a.totalBet - b.totalBet);
  let prev = 0;

  sorted.forEach((p, i) => {
    const diff = p.totalBet - prev;
    if (diff > 0) {
      // All players from this index onward are eligible for this pot slice
      const eligible = sorted.slice(i);
      pots.push({
        amount:  diff * eligible.length,
        players: eligible.map(x => x.id),
      });
      prev = p.totalBet;
    }
  });

  return pots;
}

/**
 * Distribute winnings across side pots.
 * Returns a map of { playerId: winAmount }.
 *
 * @param {object[]} pots     - Array from sidePots()
 * @param {object[]} players  - Active (non-folded) players with .id
 * @param {Function} compare  - compare(eligiblePlayers, community) → winner[]
 * @param {number[]} community - Community cards
 */
function distributePots(pots, players, compare, community) {
  const winnings = {};
  players.forEach(p => { winnings[p.id] = 0; });

  for (const pot of pots) {
    const eligible = players.filter(p => pot.players.includes(p.id) && !p.folded);
    if (eligible.length === 0) continue;

    const winners = compare(eligible, community);
    const share = Math.floor((pot.amount / winners.length) * 100) / 100;
    const remainder = Math.round((pot.amount - share * winners.length) * 100) / 100;

    winners.forEach((w, idx) => {
      winnings[w.id] = (winnings[w.id] || 0) + share + (idx === 0 ? remainder : 0);
    });
  }

  return winnings;
}

module.exports = { sidePots, distributePots };
