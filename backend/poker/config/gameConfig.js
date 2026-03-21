/**
 * poker/config/gameConfig.js — Unified dynamic game configuration
 *
 * All parameters can be overridden at runtime via DB (system_configs table)
 * or environment variables. Nothing is hard-coded.
 */

module.exports = {
  rake: {
    percent: parseFloat(process.env.POKER_RAKE_PERCENT || "0.05"),
    cap:     parseFloat(process.env.POKER_RAKE_CAP     || "10"),
  },
  matchmaking: {
    minPlayers: parseInt(process.env.POKER_MIN_PLAYERS || "2", 10),
    maxPlayers: parseInt(process.env.POKER_MAX_PLAYERS || "6", 10),
  },
  bot: {
    enabled:   (process.env.POKER_BOT_ENABLED || "true") === "true",
    fillTarget: parseInt(process.env.POKER_BOT_FILL_TARGET || "4", 10),
    thinkMin:   parseInt(process.env.POKER_BOT_THINK_MIN   || "1500", 10),
    thinkMax:   parseInt(process.env.POKER_BOT_THINK_MAX   || "4000", 10),
  },
  turn: {
    timeoutMs:  parseInt(process.env.POKER_TURN_TIMEOUT || "30000", 10),
    warningMs:  parseInt(process.env.POKER_TURN_WARNING || "10000", 10),
  },
  rooms: {
    defaults: [
      { name: "初級桌", small_blind: 1,  big_blind: 2,  min_buyin: 100,  max_buyin: 300,   max_players: 6, enable_bot: true,  bot_fill_target: 4 },
      { name: "中級桌", small_blind: 5,  big_blind: 10, min_buyin: 500,  max_buyin: 2000,  max_players: 6, enable_bot: true,  bot_fill_target: 4 },
      { name: "高級桌", small_blind: 10, big_blind: 20, min_buyin: 2000, max_buyin: 20000, max_players: 6, enable_bot: false, bot_fill_target: 3 },
    ],
  },
};
