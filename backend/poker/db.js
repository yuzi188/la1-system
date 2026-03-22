/**
 * poker/db.js — Database layer for poker (uses la1-system's shared sqlite3 instance)
 *
 * All queries use the async dbGet/dbAll/dbRun helpers from models/db.js.
 * Tables are created via initPokerSchema() called once at startup.
 */

const { db, dbGet, dbAll, dbRun } = require("../models/db");
const gameConfig = require("./config/gameConfig");

// ── Schema bootstrap ─────────────────────────────────────────────────────────

function initPokerSchema() {
  return new Promise((resolve) => {
    db.serialize(() => {
      // Room configs (dynamic, admin-editable)
      db.run(`CREATE TABLE IF NOT EXISTS poker_room_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        small_blind REAL NOT NULL DEFAULT 1,
        big_blind REAL NOT NULL DEFAULT 2,
        min_buyin REAL NOT NULL DEFAULT 100,
        max_buyin REAL NOT NULL DEFAULT 300,
        max_players INTEGER NOT NULL DEFAULT 6,
        enable_bot INTEGER NOT NULL DEFAULT 1,
        bot_fill_target INTEGER NOT NULL DEFAULT 4,
        rake_percent REAL,
        rake_cap REAL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // System-wide poker configs (key-value, hot-reloadable)
      db.run(`CREATE TABLE IF NOT EXISTS poker_system_configs (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Game session history
      db.run(`CREATE TABLE IF NOT EXISTS poker_game_sessions (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        phase TEXT,
        pot REAL DEFAULT 0,
        rake REAL DEFAULT 0,
        community TEXT,
        winner_ids TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME
      )`);

      // Round player records
      db.run(`CREATE TABLE IF NOT EXISTS poker_round_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        seat_index INTEGER,
        buy_in REAL,
        chips_start REAL,
        chips_end REAL,
        cards TEXT,
        is_bot INTEGER DEFAULT 0
      )`);

      // Action log
      db.run(`CREATE TABLE IF NOT EXISTS poker_round_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        action TEXT NOT NULL,
        amount REAL DEFAULT 0,
        phase TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_poker_sessions_room ON poker_game_sessions(room_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_poker_rp_session ON poker_round_players(session_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_poker_ra_session ON poker_round_actions(session_id)`);

      // Seed default rooms if empty
      db.get("SELECT COUNT(*) as cnt FROM poker_room_configs", (err, row) => {
        if (!err && row && row.cnt === 0) {
          const defaults = gameConfig.rooms.defaults;
          defaults.forEach((r, i) => {
            const id = `room-${r.name === "初級桌" ? "beginner" : r.name === "中級桌" ? "intermediate" : "advanced"}`;
            db.run(
              `INSERT OR IGNORE INTO poker_room_configs (id, name, small_blind, big_blind, min_buyin, max_buyin, max_players, enable_bot, bot_fill_target) VALUES (?,?,?,?,?,?,?,?,?)`,
              [id, r.name, r.small_blind, r.big_blind, r.min_buyin, r.max_buyin, r.max_players, r.enable_bot ? 1 : 0, r.bot_fill_target]
            );
          });
          console.log("[Poker DB] Seeded default room configs");
        }
      });

      // Seed default system configs
      db.get("SELECT COUNT(*) as cnt FROM poker_system_configs", (err, row) => {
        if (!err && row && row.cnt === 0) {
          const seeds = [
            ["rake_percent",    String(gameConfig.rake.percent),          "Rake percentage (0.05 = 5%)"],
            ["rake_cap",        String(gameConfig.rake.cap),             "Max rake per pot"],
            ["mm_min_players",  String(gameConfig.matchmaking.minPlayers),"Min players to start round"],
            ["bot_enabled",     gameConfig.bot.enabled ? "1" : "0",      "Global bot enable flag"],
            ["bot_fill_target", String(gameConfig.bot.fillTarget),       "Default bot fill target"],
            ["turn_timeout_ms", String(gameConfig.turn.timeoutMs),       "Turn timeout in ms"],
            ["turn_warning_ms", String(gameConfig.turn.warningMs),       "Turn warning in ms"],
          ];
          seeds.forEach(([k, v, d]) => {
            db.run("INSERT OR IGNORE INTO poker_system_configs (key, value, description) VALUES (?,?,?)", [k, v, d]);
          });
          console.log("[Poker DB] Seeded default system configs");
        }
        resolve();
      });
    });
  });
}

// ── Config loaders (with caching) ────────────────────────────────────────────

let _sysConfigCache = null;
let _sysConfigCacheTime = 0;
const SYS_CONFIG_TTL = 60000; // 60 seconds

async function loadSystemConfigs() {
  const now = Date.now();
  if (_sysConfigCache && (now - _sysConfigCacheTime) < SYS_CONFIG_TTL) {
    return _sysConfigCache;
  }
  try {
    const rows = await dbAll("SELECT key, value FROM poker_system_configs");
    const cfg = {};
    rows.forEach(r => { cfg[r.key] = r.value; });
    _sysConfigCache = cfg;
    _sysConfigCacheTime = now;
    return cfg;
  } catch (e) {
    console.error("[Poker DB] loadSystemConfigs error:", e.message);
    return _sysConfigCache || {};
  }
}

function invalidateSystemConfigCache() {
  _sysConfigCache = null;
  _sysConfigCacheTime = 0;
}

async function loadRoomConfigs() {
  try {
    const rows = await dbAll("SELECT * FROM poker_room_configs WHERE status = 'active' ORDER BY small_blind ASC");
    return rows.map(r => ({
      ...r,
      enable_bot: !!r.enable_bot,
    }));
  } catch (e) {
    console.error("[Poker DB] loadRoomConfigs error:", e.message);
    return gameConfig.rooms.defaults.map((r, i) => ({
      id: `room-${i}`,
      ...r,
    }));
  }
}

async function loadRoomConfig(roomId) {
  try {
    const row = await dbGet("SELECT * FROM poker_room_configs WHERE id = ?", [roomId]);
    if (row) {
      row.enable_bot = !!row.enable_bot;
      return row;
    }
  } catch (e) {
    console.error("[Poker DB] loadRoomConfig error:", e.message);
  }
  // Fallback to defaults
  const defaults = gameConfig.rooms.defaults;
  const idx = roomId.includes("beginner") ? 0 : roomId.includes("intermediate") ? 1 : 2;
  const d = defaults[idx] || defaults[0];
  return { id: roomId, ...d };
}

// ── Game session persistence ─────────────────────────────────────────────────

async function saveRound(sessionId, roomId, state) {
  try {
    await dbRun(
      `INSERT OR REPLACE INTO poker_game_sessions (id, room_id, phase, pot, community, started_at) VALUES (?,?,?,?,?,datetime('now'))`,
      [sessionId, roomId, state.phase, state.pot, JSON.stringify(state.community || [])]
    );
    // Save player records
    for (const p of (state.players || [])) {
      if (!p) continue;
      await dbRun(
        `INSERT OR REPLACE INTO poker_round_players (session_id, player_id, seat_index, buy_in, chips_start, cards, is_bot) VALUES (?,?,?,?,?,?,?)`,
        [sessionId, p.id, p.seatIndex, p.buyIn || 0, p.chips, JSON.stringify(p.cards || []), p.isBot ? 1 : 0]
      );
    }
  } catch (e) {
    console.error("[Poker DB] saveRound error:", e.message);
  }
}

async function finalizeRound(sessionId, winners, rake) {
  try {
    await dbRun(
      `UPDATE poker_game_sessions SET phase='SETTLE', rake=?, winner_ids=?, ended_at=datetime('now') WHERE id=?`,
      [rake, JSON.stringify((winners || []).map(w => w.playerId)), sessionId]
    );
  } catch (e) {
    console.error("[Poker DB] finalizeRound error:", e.message);
  }
}

async function logAction(sessionId, playerId, action, amount, phase) {
  try {
    await dbRun(
      `INSERT INTO poker_round_actions (session_id, player_id, action, amount, phase) VALUES (?,?,?,?,?)`,
      [sessionId, playerId, action, amount || 0, phase]
    );
  } catch (e) {
    console.error("[Poker DB] logAction error:", e.message);
  }
}

// ── Wallet operations ────────────────────────────────────────────────────────

async function deductBuyIn(userId, amount) {
  try {
    const user = await dbGet("SELECT balance FROM users WHERE tg_id = ? OR id = ?", [userId, userId]);
    if (!user) {
      return { success: false, error: "用戶不存在" };
    }
    const balance = parseFloat(user.balance) || 0;
    if (balance < amount) {
      return { success: false, error: `餘額不足 (餘額: ${balance}, 需要: ${amount})` };
    }
    const newBalance = balance - amount;
    await dbRun("UPDATE users SET balance = ? WHERE tg_id = ? OR id = ?", [newBalance, userId, userId]);
    console.log(`[Poker DB] deductBuyIn: userId=${userId}, amount=${amount}, newBalance=${newBalance}`);
    return { success: true, newBalance };
  } catch (e) {
    console.error("[Poker DB] deductBuyIn error:", e.message);
    return { success: false, error: e.message };
  }
}

async function creditWinnings(userId, amount) {
  try {
    const user = await dbGet("SELECT balance FROM users WHERE tg_id = ? OR id = ?", [userId, userId]);
    if (!user) {
      console.warn(`[Poker DB] creditWinnings: user ${userId} not found`);
      return { success: false, error: "用戶不存在" };
    }
    const balance = parseFloat(user.balance) || 0;
    const newBalance = balance + amount;
    await dbRun("UPDATE users SET balance = ? WHERE tg_id = ? OR id = ?", [newBalance, userId, userId]);
    console.log(`[Poker DB] creditWinnings: userId=${userId}, amount=${amount}, newBalance=${newBalance}`);
    return { success: true, newBalance };
  } catch (e) {
    console.error("[Poker DB] creditWinnings error:", e.message);
    return { success: false, error: e.message };
  }
}

async function deductRebuy(userId, amount) {
  return deductBuyIn(userId, amount);
}

async function refundChips(userId, chips) {
  return creditWinnings(userId, chips);
}

async function getUserBalance(userId) {
  try {
    const user = await dbGet("SELECT balance FROM users WHERE tg_id = ? OR id = ?", [userId, userId]);
    return user ? (parseFloat(user.balance) || 0) : 0;
  } catch (e) {
    console.error("[Poker DB] getUserBalance error:", e.message);
    return 0;
  }
}

module.exports = {
  initPokerSchema,
  loadSystemConfigs,
  invalidateSystemConfigCache,
  loadRoomConfigs,
  loadRoomConfig,
  saveRound,
  finalizeRound,
  logAction,
  deductBuyIn,
  deductRebuy,
  creditWinnings,
  refundChips,
  getUserBalance,
};
