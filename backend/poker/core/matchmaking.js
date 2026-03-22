/**
 * poker/core/matchmaking.js — Bot auto-fill strategy
 *
 * Dynamically reads room config to decide how many bots to add.
 * Strategy:
 *   - <2 humans → don't start
 *   - 2 humans → fill to bot_fill_target (default 4)
 *   - 3 humans → fill to bot_fill_target or 5
 *   - 4+ humans → no bots needed
 *   - enable_bot = false → never add bots
 */

const BOT_NAMES = [
  "機器鯊", "AI Pro", "算牌王", "撲克達人", "幸運星",
  "金手指", "大贏家", "冷面殺手", "賭神", "籌碼王",
  "夜行者", "閃電手", "深水魚", "鐵面人", "風暴眼",
];

function getBotFillCount(room, sysConfig) {
  const roomConfig = room.config || {};
  const enableBot = roomConfig.enable_bot !== undefined ? roomConfig.enable_bot : (sysConfig.bot_enabled !== "0");
  console.log(`[Matchmaking] room=${room.id} enableBot=${enableBot} rc.enable_bot=${roomConfig.enable_bot} sys.bot_enabled=${sysConfig.bot_enabled}`);
  if (!enableBot) return 0;

  const humanCount = room.players.filter(p => p && p.isActive && !p.isBot).length;
  const totalActive = room.players.filter(p => p && p.isActive).length;
  const maxPlayers = roomConfig.max_players || 6;
  const fillTarget = roomConfig.bot_fill_target || parseInt(sysConfig.bot_fill_target || "4", 10);

  console.log(`[Matchmaking] humans=${humanCount} active=${totalActive} max=${maxPlayers} target=${fillTarget}`);
  if (humanCount < 1) return 0; // No humans, no bots

  // 1 human is enough — fill bots to reach fillTarget
  const targetTotal = Math.min(fillTarget, maxPlayers);
  const botsNeeded = Math.max(0, targetTotal - totalActive);
  console.log(`[Matchmaking] botsNeeded=${botsNeeded}`);
  return botsNeeded;
}

function createBot(roomConfig, sysConfig) {
  const id = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];

  const minBuyin = roomConfig.min_buyin || 100;
  const maxBuyin = roomConfig.max_buyin || 300;
  const buyIn = minBuyin + Math.floor(Math.random() * (maxBuyin - minBuyin) * 0.5);

  return {
    id,
    name,
    chips: buyIn,
    buyIn,
    bet: 0,
    totalBet: 0,
    folded: false,
    allIn: false,
    isActive: true,
    isBot: true,
    cards: [],
    lastAction: null,
    hasActed: false,
    seatIndex: -1, // assigned by room
  };
}

function fillBots(room, sysConfig) {
  const count = getBotFillCount(room, sysConfig);
  const roomConfig = room.config || {};
  const added = [];

  for (let i = 0; i < count; i++) {
    const bot = createBot(roomConfig, sysConfig);

    // Find empty seat
    const emptySeat = room.players.findIndex(p => p === null);
    if (emptySeat === -1) break; // No seats available

    bot.seatIndex = emptySeat;
    room.players[emptySeat] = bot;
    added.push(bot);
    console.log(`[Matchmaking] Added bot "${bot.name}" seat=${emptySeat} chips=${bot.chips}`);
  }

  return added;
}

function canStartRound(room, sysConfig) {
  const minPlayers = parseInt(sysConfig.mm_min_players || "2", 10);
  const activePlayers = room.players.filter(p => p && p.isActive && p.chips > 0);
  console.log(`[Matchmaking] canStart: active=${activePlayers.length} min=${minPlayers}`);
  return activePlayers.length >= minPlayers;
}

module.exports = { getBotFillCount, fillBots, canStartRound, createBot };
