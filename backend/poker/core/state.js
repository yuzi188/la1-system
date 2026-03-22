/**
 * Texas Hold'em Game State Machine
 * States: WAITING -> PREFLOP -> FLOP -> TURN -> RIVER -> SHOWDOWN -> SETTLE
 */

const PHASES = {
  WAITING: "WAITING",
  PREFLOP: "PREFLOP",
  FLOP: "FLOP",
  TURN: "TURN",
  RIVER: "RIVER",
  SHOWDOWN: "SHOWDOWN",
  SETTLE: "SETTLE",
};

const SUITS = ["h", "d", "c", "s"]; // hearts, diamonds, clubs, spades
const RANKS = "23456789TJQKA";

function createDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push(r + s);
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function createPlayer(id, name, chips, seatIndex, isBot = false, avatar = null) {
  return {
    id,
    name,
    chips,
    seatIndex,
    isBot,
    avatar,
    cards: [],
    bet: 0,
    totalBet: 0,
    folded: false,
    allIn: false,
    isActive: true,
    lastAction: null,
    connected: true,
  };
}

function createGameState(roomId, config = {}) {
  return {
    roomId,
    phase: PHASES.WAITING,
    deck: [],
    community: [],
    players: [],
    pot: 0,
    sidePots: [],
    currentPlayerIndex: -1,
    dealerIndex: 0,
    smallBlindIndex: -1,
    bigBlindIndex: -1,
    smallBlind: config.smallBlind || 5,
    bigBlind: config.bigBlind || 10,
    minBuyIn: config.minBuyIn || 200,
    maxBuyIn: config.maxBuyIn || 2000,
    maxPlayers: config.maxPlayers || 6,
    currentBet: 0,
    minRaise: 0,
    roundId: null,
    lastRaiseAmount: 0,
    turnTimer: null,
    turnTimeout: config.turnTimeout || 30,
    history: [],
    createdAt: Date.now(),
  };
}

function nextPhase(state) {
  const order = [PHASES.PREFLOP, PHASES.FLOP, PHASES.TURN, PHASES.RIVER, PHASES.SHOWDOWN];
  const idx = order.indexOf(state.phase);
  if (idx >= 0 && idx < order.length - 1) {
    state.phase = order[idx + 1];
  }
  return state;
}

/**
 * Get active (non-folded) players. Null-safe for sparse arrays.
 */
function getActivePlayers(state) {
  return state.players.filter(p => p && p.isActive && !p.folded);
}

function getNonAllInPlayers(state) {
  return getActivePlayers(state).filter(p => !p.allIn);
}

/**
 * Reset per-street state. Null-safe for sparse arrays.
 */
function resetRound(state) {
  state.players.forEach(p => {
    if (!p) return;
    p.bet = 0;
    p.lastAction = null;
  });
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.lastRaiseAmount = 0;
}

module.exports = {
  PHASES,
  SUITS,
  createDeck,
  createPlayer,
  createGameState,
  nextPhase,
  getActivePlayers,
  getNonAllInPlayers,
  resetRound,
};
