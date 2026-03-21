/**
 * models/db.js — Unified SQLite database instance
 *
 * All modules MUST require this file instead of creating their own
 * sqlite3.Database instances. This ensures a single connection is
 * shared across server.js, bot.js, services, and jobs.
 *
 * Persistent Volume support:
 *   - On Railway (production), the /data directory is a mounted Persistent Volume.
 *   - If /data exists and is writable, the database is stored at /data/la1.db.
 *   - Otherwise (local development), the database falls back to ./db.sqlite.
 */

const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// ── Determine DB path ────────────────────────────────────────────────────────

function resolveDbPath() {
  const persistentDir = "/data";
  try {
    // Check if /data directory exists and is writable (Railway Persistent Volume)
    if (fs.existsSync(persistentDir)) {
      fs.accessSync(persistentDir, fs.constants.W_OK);
      const dbPath = path.join(persistentDir, "la1.db");
      console.log("[DB] Persistent Volume detected — using:", dbPath);
      return dbPath;
    }
  } catch (e) {
    console.warn("[DB] /data not writable, falling back to local path:", e.message);
  }
  const localPath = process.env.DB_PATH || path.join(__dirname, "..", "db.sqlite");
  console.log("[DB] Using local DB path:", localPath);
  return localPath;
}

const DB_PATH = resolveDbPath();
console.log("[DB] Unified DB instance — path:", DB_PATH);

const db = new sqlite3.Database(DB_PATH);

// ── Promise wrappers ────────────────────────────────────────────────────────

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    });
  });
}

// ── Feature #2: getAllUsers & incrementPushCount ─────────────────────────────

/**
 * Return every user row (optionally filtered by opt_out = 0).
 * @param {boolean} activeOnly – if true, exclude opted-out users
 */
async function getAllUsers(activeOnly = true) {
  const sql = activeOnly
    ? "SELECT * FROM users WHERE opt_out = 0 AND banned = 0"
    : "SELECT * FROM users";
  return dbAll(sql);
}

/**
 * Increment daily_push_count for a user and update last_push_at.
 * @param {number} userId
 */
async function incrementPushCount(userId) {
  return dbRun(
    "UPDATE users SET daily_push_count = daily_push_count + 1, last_push_at = datetime('now') WHERE id = ?",
    [userId]
  );
}

/**
 * Reset daily_push_count for all users whose last_push_date is not today.
 * Uses the last_push_date column so the reset is idempotent.
 */
async function resetDailyPushCounts() {
  const today = new Date().toISOString().split("T")[0];
  await dbRun(
    "UPDATE users SET daily_push_count = 0 WHERE last_push_date IS NULL OR last_push_date <> ?",
    [today]
  );
  await dbRun("UPDATE users SET last_push_date = ? WHERE last_push_date IS NULL OR last_push_date <> ?", [
    today,
    today,
  ]);
  console.log(`[DB] Daily push counts reset for date: ${today}`);
}

// ── Schema bootstrap (new columns + tables) ─────────────────────────────────

function initSchema() {
  // New columns on users table (safe to run multiple times — ALTER fails silently)
  const newUserCols = [
    "daily_push_count INTEGER DEFAULT 0",
    "last_push_at DATETIME",
    "last_push_date TEXT",
    "last_trigger TEXT",
    "opt_out INTEGER DEFAULT 0",
    "last_login DATETIME",
    "last_deposit_at DATETIME",
    "total_bet REAL DEFAULT 0",
    "is_agent INTEGER DEFAULT 0",
    "referral_code TEXT",
    "nickname TEXT DEFAULT ''",
    "nickname_changed INTEGER DEFAULT 0",
    "avatar TEXT DEFAULT ''",
    "backup_username TEXT DEFAULT ''",
    "backup_password TEXT DEFAULT ''",
  ];
  newUserCols.forEach((col) => {
    const colName = col.split(" ")[0];
    db.run(`ALTER TABLE users ADD COLUMN ${col}`, () => {});
  });

  // Feature #13: admins table
  db.run(
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'operator', -- super_admin, operator, support
      status TEXT DEFAULT 'active', -- active, disabled
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      created_by TEXT
    )`,
    () => {
      // Seed default super admin: LA188YU / 585858
      const bcrypt = require("bcryptjs");
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync("585858", salt);
      // Use INSERT OR REPLACE to ensure the password is updated even if the user already exists
      db.run(
        "INSERT OR REPLACE INTO admins (id, username, password_hash, role, created_by) VALUES ((SELECT id FROM admins WHERE username = ?), ?, ?, ?, ?)",
        ["LA188YU", "LA188YU", hash, "super_admin", "system"]
      );
    }
  );

  // Feature #14: admin_logs table
  db.run(
    `CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      action TEXT,
      target TEXT,
      details TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // Feature #6: message_templates table
  db.run(
    `CREATE TABLE IF NOT EXISTS message_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger TEXT NOT NULL,
      content TEXT NOT NULL,
      lang TEXT DEFAULT 'zh',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    () => {
      // Seed default templates (INSERT OR IGNORE based on unique trigger+lang)
      db.run(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_tpl_trigger_lang ON message_templates(trigger, lang)`,
        () => {
          const seeds = [
            // Chinese templates
            ["register_no_deposit", "zh", "🎉 歡迎加入 LA1！\n\n您已成功註冊，現在完成首充即可領取豐厚獎勵 💰\n\n👉 立即儲值：{{site_url}}/deposit"],
            ["deposit_no_bet", "zh", "💰 您的帳戶已有餘額！\n\n還沒開始遊戲嗎？試試我們的熱門遊戲，贏取更多獎勵 🎰\n\n👉 開始遊戲：{{site_url}}"],
            ["inactive_3d", "zh", "👋 好久不見！\n\n我們想念您了～回來簽到領獎金，每天都有驚喜！\n\n👉 立即簽到：發送 /sign"],
            ["inactive_7d", "zh", "🔔 專屬回歸禮等你拿！\n\n已經 7 天沒上線了，回來看看有什麼新活動吧！\n\n👉 查看獎勵：{{site_url}}/activity"],
            ["high_value", "zh", "👑 尊貴的 VIP 玩家您好！\n\n感謝您的支持，專屬返水和週末加碼活動已為您開啟 🎁\n\n👉 查看 VIP 福利：發送 /vip"],
            // English templates
            ["register_no_deposit", "en", "🎉 Welcome to LA1!\n\nYou've registered successfully. Make your first deposit now to claim bonus rewards 💰\n\n👉 Deposit: {{site_url}}/deposit"],
            ["deposit_no_bet", "en", "💰 Your account has balance!\n\nHaven't started playing yet? Try our popular games and win more 🎰\n\n👉 Play now: {{site_url}}"],
            ["inactive_3d", "en", "👋 We miss you!\n\nCome back and check in daily for free rewards!\n\n👉 Check in: send /sign"],
            ["inactive_7d", "en", "🔔 Welcome-back bonus waiting!\n\nIt's been 7 days. Come see what's new!\n\n👉 Activities: {{site_url}}/activity"],
            ["high_value", "en", "👑 Dear VIP player!\n\nThank you for your support. Exclusive rebates and weekend bonuses are ready for you 🎁\n\n👉 VIP perks: send /vip"],
          ];
          seeds.forEach(([trigger, lang, content]) => {
            db.run(
              "INSERT OR IGNORE INTO message_templates (trigger, content, lang) VALUES (?, ?, ?)",
              [trigger, content, lang]
            );
          });
        }
      );
    }
  );
}

// ── Data recovery: seed users if DB is newly created ─────────────────────────
/**
 * Restore user data on fresh database (new Persistent Volume or first boot).
 * Uses INSERT OR IGNORE so existing data is never overwritten.
 */
async function seedUsersIfEmpty() {
  try {
    const count = await dbGet("SELECT COUNT(*) as cnt FROM users");
    if (count && count.cnt > 0) {
      console.log(`[DB] Users table already has ${count.cnt} record(s) — skipping seed.`);
      return;
    }

    console.log("[DB] Users table is empty — seeding backup user data...");

    const usersToRestore = [
      {
        id: 1,
        username: "BXB_8889",
        tg_id: "7959351635",
        tg_first_name: "FDC",
        tg_last_name: "",
        tg_username: "BXB_8889",
        balance: 10000299.5,
        level: "normal",
        vip_level: 0,
        total_bet: 300,
        total_deposit: 0,
        first_deposit_claimed: 0,
        invite_code: "LA144525D5A",
        invited_by: 0,
        invite_count: 0,
        invite_earnings: 0,
        wager_requirement: 0,
        risk_flag: 0,
        banned: 0,
        ban_reason: "",
        created_at: "2026-03-21 13:02:15",
        daily_push_count: 0,
        opt_out: 0,
        is_agent: 0,
        nickname: "",
        nickname_changed: 0,
        avatar: "",
        backup_username: "",
        backup_password: "",
      },
      {
        id: 2,
        username: "yu_888yu",
        tg_id: "1401489682",
        tg_first_name: "悟",
        tg_last_name: "",
        tg_username: "yu_888yu",
        balance: 999999.5,
        level: "normal",
        vip_level: 0,
        total_bet: 0,
        total_deposit: 0,
        first_deposit_claimed: 0,
        invite_code: "LA1BD7F8D8E",
        invited_by: 0,
        invite_count: 0,
        invite_earnings: 0,
        wager_requirement: 1,
        risk_flag: 0,
        banned: 0,
        ban_reason: "",
        created_at: "2026-03-21 13:09:34",
        daily_push_count: 0,
        opt_out: 0,
        is_agent: 0,
        nickname: "",
        nickname_changed: 0,
        avatar: "",
        backup_username: "",
        backup_password: "",
      },
    ];

    for (const u of usersToRestore) {
      await dbRun(
        `INSERT OR IGNORE INTO users (
          id, username, password, tg_id, tg_first_name, tg_last_name, tg_username,
          balance, level, vip_level, total_bet, total_deposit, first_deposit_claimed,
          invite_code, invited_by, invite_count, invite_earnings, wager_requirement,
          risk_flag, banned, ban_reason, created_at, daily_push_count, opt_out,
          is_agent, nickname, nickname_changed, avatar, backup_username, backup_password
        ) VALUES (
          ?, ?, NULL, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )`,
        [
          u.id, u.username, u.tg_id, u.tg_first_name, u.tg_last_name, u.tg_username,
          u.balance, u.level, u.vip_level, u.total_bet, u.total_deposit, u.first_deposit_claimed,
          u.invite_code, u.invited_by, u.invite_count, u.invite_earnings, u.wager_requirement,
          u.risk_flag, u.banned, u.ban_reason, u.created_at, u.daily_push_count, u.opt_out,
          u.is_agent, u.nickname, u.nickname_changed, u.avatar, u.backup_username, u.backup_password,
        ]
      );
      console.log(`[DB] Restored user: ${u.username} (id=${u.id}, balance=${u.balance})`);
    }

    console.log("[DB] User data seed complete.");
  } catch (err) {
    console.error("[DB] seedUsersIfEmpty error:", err.message);
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  db,
  dbGet,
  dbAll,
  dbRun,
  getAllUsers,
  incrementPushCount,
  resetDailyPushCounts,
  initSchema,
  seedUsersIfEmpty,
  DB_PATH,
};
