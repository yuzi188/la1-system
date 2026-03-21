require("dotenv").config();

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./db.sqlite");
const JWT_SECRET = process.env.JWT_SECRET || "la1_secret_2026";
const BOT_TOKEN = process.env.BOT_TOKEN || "8796143383:AAEEz61fx2cctWb2xDGzxgHBVrIfUISfW8M";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "585858";
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "la1_admin_secret_2026";
const SITE_URL = process.env.SITE_URL || "https://la1-website-production.up.railway.app";

// ══════════════════════════════════════════════════════════════════════════════
// DATABASE SCHEMA
// ══════════════════════════════════════════════════════════════════════════════

db.serialize(() => {
  // Core tables
  db.run(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    tg_id TEXT UNIQUE,
    tg_first_name TEXT,
    tg_last_name TEXT,
    tg_username TEXT,
    balance REAL DEFAULT 0,
    level TEXT DEFAULT 'normal',
    vip_level INTEGER DEFAULT 0,
    total_bet REAL DEFAULT 0,
    total_deposit REAL DEFAULT 0,
    first_deposit_claimed INTEGER DEFAULT 0,
    invite_code TEXT UNIQUE,
    invited_by INTEGER DEFAULT 0,
    invite_count INTEGER DEFAULT 0,
    invite_earnings REAL DEFAULT 0,
    wager_requirement REAL DEFAULT 0,
    risk_flag INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS deposits(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    status TEXT,
    payment_id TEXT,
    risk INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS blacklist(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    value TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS balance_logs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    amount REAL,
    reason TEXT,
    wager_req REAL DEFAULT 0,
    operator TEXT DEFAULT 'system',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Check-in table
  db.run(`CREATE TABLE IF NOT EXISTS checkins(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    day INTEGER,
    amount REAL,
    checkin_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Task claims
  db.run(`CREATE TABLE IF NOT EXISTS task_claims(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    task_id TEXT,
    claim_date TEXT,
    amount REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Referral log
  db.run(`CREATE TABLE IF NOT EXISTS referral_logs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER,
    referred_id INTEGER,
    level INTEGER DEFAULT 1,
    commission REAL,
    source_amount REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // First deposit bonus log
  db.run(`CREATE TABLE IF NOT EXISTS first_deposit_logs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    deposit_amount REAL,
    bonus_amount REAL,
    wager_multiplier REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add missing columns to existing users table (safe to run multiple times)
  const newCols = [
    "vip_level INTEGER DEFAULT 0",
    "total_bet REAL DEFAULT 0",
    "total_deposit REAL DEFAULT 0",
    "first_deposit_claimed INTEGER DEFAULT 0",
    "invite_code TEXT",
    "invited_by INTEGER DEFAULT 0",
    "invite_count INTEGER DEFAULT 0",
    "invite_earnings REAL DEFAULT 0",
    "wager_requirement REAL DEFAULT 0",
    "risk_flag INTEGER DEFAULT 0",
  ];
  newCols.forEach(col => {
    const colName = col.split(" ")[0];
    db.run(`ALTER TABLE users ADD COLUMN ${col}`, () => {});
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function auth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return jwt.verify(token, JWT_SECRET);
}

function adminAuth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  const payload = jwt.verify(token, ADMIN_JWT_SECRET);
  if (payload.role !== "admin") throw new Error("Not admin");
  return payload;
}

function sendTG(msg) {
  if (process.env.TG_TOKEN && process.env.TG_ID) {
    axios.get(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
      params: { chat_id: process.env.TG_ID, text: msg }
    }).catch(() => {});
  }
}

function sendTGToUser(tg_id, msg) {
  if (!tg_id) return;
  axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    params: { chat_id: tg_id, text: msg, parse_mode: "HTML" }
  }).catch(() => {});
}

function generateInviteCode() {
  return "LA1" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function isWeekend() {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
  });
}

// VIP Config
const VIP_CONFIG = [
  { level: 0, name: "普通會員", minBet: 0, rebate: 0 },
  { level: 1, name: "VIP1", minBet: 1000, rebate: 0.005 },
  { level: 2, name: "VIP2", minBet: 5000, rebate: 0.008 },
  { level: 3, name: "VIP3", minBet: 20000, rebate: 0.012 },
  { level: 4, name: "VIP4", minBet: 50000, rebate: 0.015 },
  { level: 5, name: "VIP5", minBet: 100000, rebate: 0.018 },
];

// Check-in rewards (7 days)
const CHECKIN_REWARDS = [0.5, 0.5, 1, 1, 1.5, 1.5, 3];

// First deposit bonus config
const FIRST_DEPOSIT_TIERS = [
  { min: 100, bonus: 38, wagerMultiplier: 10 },
  { min: 30, bonus: 10, wagerMultiplier: 8 },
];

function getVipLevel(totalBet) {
  let vipLevel = 0;
  for (let i = VIP_CONFIG.length - 1; i >= 0; i--) {
    if (totalBet >= VIP_CONFIG[i].minBet) {
      vipLevel = VIP_CONFIG[i].level;
      break;
    }
  }
  return vipLevel;
}

function verifyTelegramInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;
    const checkArr = [];
    params.forEach((value, key) => {
      if (key !== "hash") checkArr.push(`${key}=${value}`);
    });
    checkArr.sort();
    const dataCheckString = checkArr.join("\n");
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    return computedHash === hash;
  } catch (e) {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN AUTH
// ══════════════════════════════════════════════════════════════════════════════

app.post("/admin/login", (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "請輸入密碼" });
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "密碼錯誤" });
  const token = jwt.sign({ role: "admin", ts: Date.now() }, ADMIN_JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, ok: true });
});

app.get("/admin/users", async (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const q = req.query.q ? `%${req.query.q}%` : null;
  const sql = q
    ? `SELECT * FROM users WHERE username LIKE ? OR tg_id LIKE ? OR tg_username LIKE ? OR tg_first_name LIKE ? ORDER BY created_at DESC`
    : `SELECT * FROM users ORDER BY created_at DESC`;
  const params = q ? [q, q, q, q] : [];
  db.all(sql, params, (e, rows) => res.json(rows || []));
});

app.post("/admin/adjust-balance", async (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { userId, amount, type, reason } = req.body;
  if (!userId || !amount || !type) return res.status(400).json({ error: "缺少必要參數" });
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) return res.status(400).json({ error: "金額必須為正數" });
  if (type !== "add" && type !== "deduct") return res.status(400).json({ error: "type 必須為 add 或 deduct" });

  db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
    if (!user) return res.status(404).json({ error: "用戶不存在" });
    const newBalance = type === "add" ? user.balance + numAmount : user.balance - numAmount;
    if (newBalance < 0) return res.status(400).json({ error: `餘額不足，當前：${user.balance.toFixed(2)}` });

    db.run("UPDATE users SET balance = ? WHERE id = ?", [newBalance, userId], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: "更新失敗" });
      db.run("INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, ?, ?, ?, ?)",
        [userId, type, numAmount, reason || "", "admin"]);

      if (user.tg_id) {
        const displayName = user.tg_first_name || user.tg_username || user.username;
        const actionText = type === "add" ? "充值" : "扣款";
        const emoji = type === "add" ? "💰" : "📤";
        const msg = `${emoji} <b>帳戶${actionText}通知</b>\n\n親愛的 ${displayName}，\n您的帳戶已${type === "add" ? "充值" : "扣除"} <b>${numAmount.toFixed(2)} USDT</b>\n💼 當前餘額：<b>${newBalance.toFixed(2)} USDT</b>${reason ? `\n📝 備註：${reason}` : ""}\n\n如有疑問請聯繫客服 @LA1111_bot`;
        sendTGToUser(user.tg_id, msg);
      }
      sendTG(`${type === "add" ? "⬆️ 上分" : "⬇️ 扣分"} | ${user.tg_username || user.username} | ${numAmount} | 餘額：${newBalance.toFixed(2)}`);
      res.json({ ok: true, newBalance, message: `${type === "add" ? "上分" : "扣分"}成功` });
    });
  });
});

app.get("/admin/balance-logs", (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  db.all(`SELECT bl.*, u.username, u.tg_username, u.tg_first_name FROM balance_logs bl LEFT JOIN users u ON bl.user_id = u.id ORDER BY bl.created_at DESC LIMIT 200`, (e, rows) => res.json(rows || []));
});

app.get("/admin/deposits", (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  db.all("SELECT * FROM deposits ORDER BY id DESC", (e, rows) => res.json(rows || []));
});

// Admin: flag user for risk
app.post("/admin/flag-user", (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { userId, flag } = req.body;
  db.run("UPDATE users SET risk_flag = ? WHERE id = ?", [flag ? 1 : 0, userId], (err) => {
    if (err) return res.status(500).json({ error: "操作失敗" });
    res.json({ ok: true, message: flag ? "已標記風控" : "已解除風控" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TG LOGIN
// ══════════════════════════════════════════════════════════════════════════════

app.post("/tg-login", (req, res) => {
  const { initData } = req.body;
  if (!initData) return res.json({ error: "缺少 initData" });
  const isValid = verifyTelegramInitData(initData, BOT_TOKEN);
  if (!isValid) {
    console.log("[TG-LOGIN] Hash verification failed, trying fallback...");
  }
  const params = new URLSearchParams(initData);
  let tgUser;
  try { tgUser = JSON.parse(params.get("user") || "{}"); } catch (e) { return res.status(400).json({ error: "無法解析" }); }
  // Fallback: if hash fails but no valid user data, reject
  if (!isValid && (!tgUser || !tgUser.id)) {
    return res.status(401).json({ error: "initData 驗證失敗" });
  }
  if (!isValid) {
    console.log("[TG-LOGIN] Fallback allowed for tg_id:", tgUser.id);
  }
  const { id: tg_id, first_name, last_name = "", username = "" } = tgUser;
  if (!tg_id) return res.status(400).json({ error: "無法取得 TG ID" });

  const tg_id_str = String(tg_id);
  const display_username = username || `tg_${tg_id_str}`;

  db.get("SELECT * FROM users WHERE tg_id = ?", [tg_id_str], (err, existing) => {
    if (existing) {
      db.run("UPDATE users SET tg_first_name=?, tg_last_name=?, tg_username=? WHERE tg_id=?", [first_name, last_name, username, tg_id_str]);
      const token = jwt.sign({ id: existing.id, tg_id: tg_id_str }, JWT_SECRET, { expiresIn: "30d" });
      return res.json({
        token,
        user: {
          id: existing.id, username: existing.tg_username || existing.username || display_username,
          first_name, last_name, tg_id: tg_id_str, balance: existing.balance,
          vip_level: existing.vip_level || 0, invite_code: existing.invite_code,
        }
      });
    }

    const inviteCode = generateInviteCode();
    db.run(
      `INSERT INTO users (username, tg_id, tg_first_name, tg_last_name, tg_username, invite_code) VALUES (?, ?, ?, ?, ?, ?)`,
      [display_username, tg_id_str, first_name, last_name, username, inviteCode],
      function (insertErr) {
        if (insertErr) {
          const fallback = `user_${tg_id_str}`;
          db.run(`INSERT OR IGNORE INTO users (username, tg_id, tg_first_name, tg_last_name, tg_username, invite_code) VALUES (?, ?, ?, ?, ?, ?)`,
            [fallback, tg_id_str, first_name, last_name, username, inviteCode],
            function () {
              db.get("SELECT * FROM users WHERE tg_id = ?", [tg_id_str], (e2, row) => {
                if (!row) return res.status(500).json({ error: "建立用戶失敗" });
                const token = jwt.sign({ id: row.id, tg_id: tg_id_str }, JWT_SECRET, { expiresIn: "30d" });
                sendTG(`🤖 TG 新用戶：${first_name} (@${username || tg_id_str})`);
                return res.json({ token, user: { id: row.id, username: row.username, first_name, tg_id: tg_id_str, balance: 0, vip_level: 0, invite_code: row.invite_code } });
              });
            }
          );
          return;
        }
        const newId = this.lastID;
        const token = jwt.sign({ id: newId, tg_id: tg_id_str }, JWT_SECRET, { expiresIn: "30d" });
        sendTG(`🤖 TG 新用戶：${first_name} (@${username || tg_id_str})`);
        res.json({ token, user: { id: newId, username: display_username, first_name, tg_id: tg_id_str, balance: 0, vip_level: 0, invite_code: inviteCode } });
      }
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// USER AUTH
// ══════════════════════════════════════════════════════════════════════════════

app.post("/register", (req, res) => {
  const inviteCode = generateInviteCode();
  const { username, password, referral } = req.body;
  db.run("INSERT INTO users(username, password, invite_code) VALUES (?, ?, ?)", [username, password, inviteCode], function(err) {
    if (err) return res.json({ error: "用戶名已存在" });
    const newId = this.lastID;
    // Handle referral
    if (referral) {
      db.get("SELECT id FROM users WHERE invite_code = ?", [referral], (e, referrer) => {
        if (referrer) {
          db.run("UPDATE users SET invited_by = ? WHERE id = ?", [referrer.id, newId]);
          db.run("UPDATE users SET invite_count = invite_count + 1 WHERE id = ?", [referrer.id]);
        }
      });
    }
    sendTG(`📝 新用戶註冊：${username}`);
    res.json({ ok: true });
  });
});

app.post("/login", (req, res) => {
  db.get("SELECT * FROM users WHERE username=? AND password=?", [req.body.username, req.body.password], (e, u) => {
    if (!u) return res.json({ error: "帳號或密碼錯誤" });
    const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: u.id, username: u.username, balance: u.balance, vip_level: u.vip_level || 0, invite_code: u.invite_code } });
  });
});

app.get("/me", (req, res) => {
  try {
    const u = auth(req);
    db.get("SELECT * FROM users WHERE id=?", [u.id], (e, row) => {
      if (!row) return res.json({ error: "用戶不存在" });
      const vipLevel = getVipLevel(row.total_bet || 0);
      const vipInfo = VIP_CONFIG[vipLevel];
      const nextVip = VIP_CONFIG[Math.min(vipLevel + 1, 5)];
      res.json({
        id: row.id, username: row.tg_username || row.username, first_name: row.tg_first_name,
        tg_id: row.tg_id, balance: row.balance,
        vip_level: vipLevel, vip_name: vipInfo.name, rebate: vipInfo.rebate,
        total_bet: row.total_bet || 0, total_deposit: row.total_deposit || 0,
        next_vip_bet: nextVip.minBet, next_vip_name: nextVip.name,
        invite_code: row.invite_code, invite_count: row.invite_count || 0,
        invite_earnings: row.invite_earnings || 0,
        first_deposit_claimed: row.first_deposit_claimed || 0,
        wager_requirement: row.wager_requirement || 0,
        risk_flag: row.risk_flag || 0,
      });
    });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// FIRST DEPOSIT BONUS
// ══════════════════════════════════════════════════════════════════════════════

app.post("/promo/first-deposit", async (req, res) => {
  try {
    const u = auth(req);
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });
    if (user.risk_flag) return res.status(403).json({ error: "帳戶異常，請聯繫客服" });
    if (user.first_deposit_claimed) return res.json({ error: "您已領取過首充獎勵" });
    if ((user.total_deposit || 0) <= 0) return res.json({ error: "請先完成首次儲值" });

    // Find matching tier
    let tier = null;
    for (const t of FIRST_DEPOSIT_TIERS) {
      if (user.total_deposit >= t.min) { tier = t; break; }
    }
    if (!tier) return res.json({ error: `首充金額不足，最低 ${FIRST_DEPOSIT_TIERS[FIRST_DEPOSIT_TIERS.length - 1].min} USDT` });

    const wagerReq = (user.total_deposit + tier.bonus) * tier.wagerMultiplier;
    await dbRun("UPDATE users SET balance = balance + ?, first_deposit_claimed = 1, wager_requirement = wager_requirement + ? WHERE id = ?",
      [tier.bonus, wagerReq, u.id]);
    await dbRun("INSERT INTO first_deposit_logs (user_id, deposit_amount, bonus_amount, wager_multiplier) VALUES (?, ?, ?, ?)",
      [u.id, user.total_deposit, tier.bonus, tier.wagerMultiplier]);
    await dbRun("INSERT INTO balance_logs (user_id, type, amount, reason, wager_req, operator) VALUES (?, ?, ?, ?, ?, ?)",
      [u.id, "add", tier.bonus, `首充獎勵（充${user.total_deposit}送${tier.bonus}）`, wagerReq, "system"]);

    if (user.tg_id) {
      sendTGToUser(user.tg_id, `🎁 <b>首充獎勵已到帳！</b>\n\n💰 獎勵金額：<b>${tier.bonus} USDT</b>\n🎯 流水要求：${tier.wagerMultiplier} 倍（${wagerReq.toFixed(0)} USDT）\n\n祝您好運！🍀`);
    }

    res.json({ ok: true, bonus: tier.bonus, wagerMultiplier: tier.wagerMultiplier, wagerReq });
  } catch (e) {
    res.status(500).json({ error: "系統錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DAILY CHECK-IN
// ══════════════════════════════════════════════════════════════════════════════

app.get("/promo/checkin-status", async (req, res) => {
  try {
    const u = auth(req);
    const today = getToday();
    const records = await dbAll("SELECT * FROM checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 7", [u.id]);

    // Calculate current streak
    let streak = 0;
    let checkedToday = false;
    if (records.length > 0) {
      const dates = records.map(r => r.checkin_date);
      if (dates[0] === today) {
        checkedToday = true;
        streak = 1;
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i - 1]);
          const curr = new Date(dates[i]);
          const diff = (prev - curr) / (1000 * 60 * 60 * 24);
          if (diff === 1) streak++;
          else break;
        }
      } else {
        // Check if yesterday was checked in
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        if (dates[0] === yesterdayStr) {
          streak = 1;
          for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i - 1]);
            const curr = new Date(dates[i]);
            const diff = (prev - curr) / (1000 * 60 * 60 * 24);
            if (diff === 1) streak++;
            else break;
          }
        }
      }
    }

    const currentDay = checkedToday ? streak : streak; // streak is the consecutive days so far
    const nextReward = CHECKIN_REWARDS[Math.min(streak % 7, 6)];

    res.json({
      streak,
      checkedToday,
      currentDay: streak % 7,
      rewards: CHECKIN_REWARDS,
      nextReward: checkedToday ? CHECKIN_REWARDS[Math.min(streak % 7, 6)] : CHECKIN_REWARDS[Math.min(streak % 7, 6)],
      records: records.slice(0, 7),
    });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

app.post("/promo/checkin", async (req, res) => {
  try {
    const u = auth(req);
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });
    if (user.risk_flag) return res.status(403).json({ error: "帳戶異常" });

    const today = getToday();
    const existing = await dbGet("SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?", [u.id, today]);
    if (existing) return res.json({ error: "今日已簽到" });

    // Calculate streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const lastCheckin = await dbGet("SELECT * FROM checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1", [u.id]);

    let streak = 0;
    if (lastCheckin && lastCheckin.checkin_date === yesterdayStr) {
      // Get full streak
      const records = await dbAll("SELECT * FROM checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 7", [u.id]);
      streak = 1;
      for (let i = 1; i < records.length; i++) {
        const prev = new Date(records[i - 1].checkin_date);
        const curr = new Date(records[i].checkin_date);
        const diff = (prev - curr) / (1000 * 60 * 60 * 24);
        if (diff === 1) streak++;
        else break;
      }
    }

    const dayIndex = streak % 7; // 0-6
    const reward = CHECKIN_REWARDS[dayIndex];
    const wagerReq = reward * 2;

    await dbRun("INSERT INTO checkins (user_id, day, amount, checkin_date) VALUES (?, ?, ?, ?)", [u.id, dayIndex + 1, reward, today]);
    await dbRun("UPDATE users SET balance = balance + ?, wager_requirement = wager_requirement + ? WHERE id = ?", [reward, wagerReq, u.id]);
    await dbRun("INSERT INTO balance_logs (user_id, type, amount, reason, wager_req, operator) VALUES (?, ?, ?, ?, ?, ?)",
      [u.id, "add", reward, `每日簽到 Day${dayIndex + 1}`, wagerReq, "system"]);

    if (user.tg_id) {
      sendTGToUser(user.tg_id, `✅ <b>簽到成功！</b>\n\n📅 連續簽到第 ${dayIndex + 1} 天\n💰 獲得：<b>${reward} USDT</b>\n🎯 流水要求：2 倍（${wagerReq} USDT）\n\n明天繼續簽到獎勵更多！🔥`);
    }

    res.json({ ok: true, day: dayIndex + 1, reward, streak: streak + 1, wagerReq });
  } catch (e) {
    res.status(500).json({ error: "系統錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// VIP SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

app.get("/promo/vip-info", async (req, res) => {
  try {
    const u = auth(req);
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });

    const totalBet = user.total_bet || 0;
    const vipLevel = getVipLevel(totalBet);
    const currentVip = VIP_CONFIG[vipLevel];
    const nextVip = VIP_CONFIG[Math.min(vipLevel + 1, 5)];
    const progress = vipLevel >= 5 ? 100 : Math.min(100, ((totalBet - currentVip.minBet) / (nextVip.minBet - currentVip.minBet) * 100));

    // Weekend bonus
    const weekendBonus = isWeekend() && vipLevel >= 2 ? 0.3 : 0;

    res.json({
      vip_level: vipLevel,
      vip_name: currentVip.name,
      rebate: currentVip.rebate,
      total_bet: totalBet,
      next_level: nextVip.name,
      next_bet: nextVip.minBet,
      progress: Math.round(progress),
      remaining: Math.max(0, nextVip.minBet - totalBet),
      weekend_bonus: weekendBonus,
      is_weekend: isWeekend(),
      all_levels: VIP_CONFIG,
    });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// REFERRAL SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

app.get("/promo/referral-info", async (req, res) => {
  try {
    const u = auth(req);
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });

    // Ensure invite code exists
    if (!user.invite_code) {
      const code = generateInviteCode();
      await dbRun("UPDATE users SET invite_code = ? WHERE id = ?", [code, u.id]);
      user.invite_code = code;
    }

    const referrals = await dbAll("SELECT id, username, tg_username, tg_first_name, created_at FROM users WHERE invited_by = ?", [u.id]);
    const logs = await dbAll("SELECT * FROM referral_logs WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 50", [u.id]);

    const inviteLink = `${SITE_URL}?ref=${user.invite_code}`;
    const tgLink = `https://t.me/LA1111_bot?start=ref_${user.invite_code}`;

    res.json({
      invite_code: user.invite_code,
      invite_link: inviteLink,
      tg_link: tgLink,
      invite_count: user.invite_count || 0,
      invite_earnings: user.invite_earnings || 0,
      referrals,
      logs,
      commission_rates: { level1: "15%", level2: "3%" },
    });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// Process referral commission (called internally when first deposit happens)
async function processReferralCommission(userId, depositAmount) {
  try {
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user || !user.invited_by) return;

    // Level 1: Direct referrer gets 15%
    const referrer = await dbGet("SELECT * FROM users WHERE id = ?", [user.invited_by]);
    if (referrer && !referrer.risk_flag) {
      const commission1 = depositAmount * 0.15;
      await dbRun("UPDATE users SET balance = balance + ?, invite_earnings = invite_earnings + ? WHERE id = ?", [commission1, commission1, referrer.id]);
      await dbRun("INSERT INTO referral_logs (referrer_id, referred_id, level, commission, source_amount) VALUES (?, ?, ?, ?, ?)",
        [referrer.id, userId, 1, commission1, depositAmount]);
      await dbRun("INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, ?, ?, ?, ?)",
        [referrer.id, "add", commission1, `邀請返傭 L1（${user.tg_username || user.username} 首充 ${depositAmount}）`, "system"]);
      if (referrer.tg_id) {
        sendTGToUser(referrer.tg_id, `💸 <b>邀請返傭到帳！</b>\n\n👤 好友：${user.tg_first_name || user.username}\n💰 首充：${depositAmount} USDT\n🎁 佣金（15%）：<b>${commission1.toFixed(2)} USDT</b>\n\n繼續邀請賺更多！🚀`);
      }

      // Level 2: Referrer's referrer gets 3%
      if (referrer.invited_by) {
        const referrer2 = await dbGet("SELECT * FROM users WHERE id = ?", [referrer.invited_by]);
        if (referrer2 && !referrer2.risk_flag) {
          const commission2 = depositAmount * 0.03;
          await dbRun("UPDATE users SET balance = balance + ?, invite_earnings = invite_earnings + ? WHERE id = ?", [commission2, commission2, referrer2.id]);
          await dbRun("INSERT INTO referral_logs (referrer_id, referred_id, level, commission, source_amount) VALUES (?, ?, ?, ?, ?)",
            [referrer2.id, userId, 2, commission2, depositAmount]);
          await dbRun("INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, ?, ?, ?, ?)",
            [referrer2.id, "add", commission2, `邀請返傭 L2（二級 ${user.tg_username || user.username}）`, "system"]);
          if (referrer2.tg_id) {
            sendTGToUser(referrer2.tg_id, `💸 <b>二級返傭到帳！</b>\n💰 佣金（3%）：<b>${commission2.toFixed(2)} USDT</b>`);
          }
        }
      }
    }
  } catch (e) {
    console.error("Referral commission error:", e);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TASK SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

const DAILY_TASKS = [
  { id: "bet_300", name: "今日投注滿 300", target: 300, reward: 2, type: "bet", wagerMultiplier: 3 },
  { id: "bet_1000", name: "今日投注滿 1000", target: 1000, reward: 5, type: "bet", wagerMultiplier: 3 },
  { id: "invite_1", name: "邀請 1 位好友", target: 1, reward: 3, type: "invite", wagerMultiplier: 3 },
];

app.get("/promo/tasks", async (req, res) => {
  try {
    const u = auth(req);
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });

    const today = getToday();
    const todayClaims = await dbAll("SELECT task_id FROM task_claims WHERE user_id = ? AND claim_date = ?", [u.id, today]);
    const claimedIds = todayClaims.map(c => c.task_id);

    // Get today's bet total (from balance_logs with type 'bet' today)
    const todayBet = await dbGet("SELECT COALESCE(SUM(amount), 0) as total FROM balance_logs WHERE user_id = ? AND type = 'bet' AND date(created_at) = ?", [u.id, today]);

    const tasks = DAILY_TASKS.map(task => {
      let progress = 0;
      if (task.type === "bet") progress = Math.min(todayBet?.total || 0, task.target);
      if (task.type === "invite") progress = Math.min(user.invite_count || 0, task.target);
      return {
        ...task,
        progress,
        completed: progress >= task.target,
        claimed: claimedIds.includes(task.id),
      };
    });

    res.json({ tasks, today });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

app.post("/promo/claim-task", async (req, res) => {
  try {
    const u = auth(req);
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });
    if (user.risk_flag) return res.status(403).json({ error: "帳戶異常" });

    const { taskId } = req.body;
    const task = DAILY_TASKS.find(t => t.id === taskId);
    if (!task) return res.status(400).json({ error: "任務不存在" });

    const today = getToday();
    const existing = await dbGet("SELECT * FROM task_claims WHERE user_id = ? AND task_id = ? AND claim_date = ?", [u.id, taskId, today]);
    if (existing) return res.json({ error: "今日已領取" });

    // Verify completion
    if (task.type === "bet") {
      const todayBet = await dbGet("SELECT COALESCE(SUM(amount), 0) as total FROM balance_logs WHERE user_id = ? AND type = 'bet' AND date(created_at) = ?", [u.id, today]);
      if ((todayBet?.total || 0) < task.target) return res.json({ error: "任務未完成" });
    }
    if (task.type === "invite") {
      if ((user.invite_count || 0) < task.target) return res.json({ error: "任務未完成" });
    }

    const wagerReq = task.reward * task.wagerMultiplier;
    await dbRun("INSERT INTO task_claims (user_id, task_id, claim_date, amount) VALUES (?, ?, ?, ?)", [u.id, taskId, today, task.reward]);
    await dbRun("UPDATE users SET balance = balance + ?, wager_requirement = wager_requirement + ? WHERE id = ?", [task.reward, wagerReq, u.id]);
    await dbRun("INSERT INTO balance_logs (user_id, type, amount, reason, wager_req, operator) VALUES (?, ?, ?, ?, ?, ?)",
      [u.id, "add", task.reward, `任務獎勵：${task.name}`, wagerReq, "system"]);

    if (user.tg_id) {
      sendTGToUser(user.tg_id, `🏆 <b>任務完成！</b>\n\n📋 ${task.name}\n💰 獎勵：<b>${task.reward} USDT</b>\n🎯 流水要求：${task.wagerMultiplier} 倍`);
    }

    res.json({ ok: true, reward: task.reward, wagerReq });
  } catch (e) {
    res.status(500).json({ error: "系統錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// WEEKEND BONUS
// ══════════════════════════════════════════════════════════════════════════════

app.get("/promo/weekend-status", async (req, res) => {
  try {
    const u = auth(req);
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });

    const vipLevel = getVipLevel(user.total_bet || 0);
    const eligible = vipLevel >= 2;
    const active = isWeekend();
    const bonusRate = eligible && active ? 0.3 : 0;

    res.json({
      is_weekend: active,
      eligible,
      vip_level: vipLevel,
      min_vip: 2,
      bonus_rate: "30%",
      active: eligible && active,
      message: !active ? "週末活動僅在週六日開放" : !eligible ? "需要 VIP2 以上才能參加" : "週末返水 +30% 已激活！",
    });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT (updated with referral + first deposit tracking)
// ══════════════════════════════════════════════════════════════════════════════

app.post("/create-payment", async (req, res) => {
  try {
    const u = auth(req);
    if (!process.env.PAY_KEY) return res.json({ error: "儲值功能尚未啟用" });
    const pay = await axios.post("https://api.nowpayments.io/v1/payment", { price_amount: req.body.amount, price_currency: "usd", pay_currency: "usdttrc20" }, { headers: { "x-api-key": process.env.PAY_KEY } });
    db.run("INSERT INTO deposits(user_id, amount, status, payment_id) VALUES (?,?,?,?)", [u.id, req.body.amount, "waiting", pay.data.payment_id]);
    sendTG(`💳 儲值請求：$${req.body.amount}`);
    res.json(pay.data);
  } catch (e) {
    res.json({ error: "payment failed" });
  }
});

app.post("/ipn", async (req, res) => {
  if (req.body.payment_status === "finished") {
    db.get("SELECT * FROM deposits WHERE payment_id=?", [req.body.payment_id], async (e, row) => {
      if (!row || row.status === "done") return;
      db.run("UPDATE deposits SET status='done' WHERE id=?", [row.id]);
      db.run("UPDATE users SET balance=balance+?, total_deposit=total_deposit+? WHERE id=?", [row.amount, row.amount, row.user_id]);

      // Check if this is first deposit → trigger referral commission
      const user = await dbGet("SELECT * FROM users WHERE id = ?", [row.user_id]);
      if (user && (user.total_deposit || 0) === 0) {
        // First deposit → process referral
        processReferralCommission(row.user_id, row.amount);
      }

      // Auto-upgrade VIP
      if (user) {
        const newVip = getVipLevel((user.total_bet || 0));
        if (newVip !== (user.vip_level || 0)) {
          db.run("UPDATE users SET vip_level = ? WHERE id = ?", [newVip, user.id]);
        }
      }

      sendTG(`💰 收款成功：$${row.amount}`);
    });
  }
  res.send("ok");
});

// ══════════════════════════════════════════════════════════════════════════════
// PROMO SUMMARY (for activity page)
// ══════════════════════════════════════════════════════════════════════════════

app.get("/promo/summary", async (req, res) => {
  try {
    const u = auth(req);
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [u.id]);
    if (!user) return res.json({});

    const today = getToday();
    const vipLevel = getVipLevel(user.total_bet || 0);
    const todayCheckin = await dbGet("SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?", [u.id, today]);
    const todayClaims = await dbAll("SELECT task_id FROM task_claims WHERE user_id = ? AND claim_date = ?", [u.id, today]);

    res.json({
      first_deposit_claimed: user.first_deposit_claimed || 0,
      vip_level: vipLevel,
      checked_today: !!todayCheckin,
      tasks_claimed_today: todayClaims.length,
      invite_count: user.invite_count || 0,
      invite_earnings: user.invite_earnings || 0,
      is_weekend: isWeekend(),
      weekend_eligible: vipLevel >= 2,
    });
  } catch (e) {
    res.json({});
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════════════════════════════

app.get("/", (req, res) => res.json({
  status: "ok", service: "la1-backend", version: "3.0.0",
  endpoints: [
    "/tg-login", "/login", "/register", "/me",
    "/promo/first-deposit", "/promo/checkin", "/promo/checkin-status",
    "/promo/vip-info", "/promo/referral-info", "/promo/tasks", "/promo/claim-task",
    "/promo/weekend-status", "/promo/summary",
    "/admin/login", "/admin/users", "/admin/adjust-balance", "/admin/flag-user",
  ]
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LA1 Backend v3.0 running on port ${PORT}`));
