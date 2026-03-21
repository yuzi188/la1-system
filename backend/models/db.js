/**
 * models/db.js — Unified SQLite database instance
 *
 * All modules MUST require this file instead of creating their own
 * sqlite3.Database instances. This ensures a single connection is
 * shared across server.js, bot.js, services, and jobs.
 */

const sqlite3 = require("sqlite3").verbose();

const DB_PATH = process.env.DB_PATH || "./db.sqlite";
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
      // Seed default super admin: LA188YU / LA1admin888
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
  DB_PATH,
};
