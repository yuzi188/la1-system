require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");

// ── Poker module ───────────────────────────────────────────────────────────
const { initPokerSocket } = require("./poker/socket");
const { initPokerSchema } = require("./poker/db");

// ── Feature #1: Unified DB instance ─────────────────────────────────────────
const { db, dbGet, dbAll, dbRun, initSchema, seedUsersIfEmpty } = require("./models/db");

// ── Push job & services ─────────────────────────────────────────────────────
const { startPushJob } = require("./jobs/pushJob");

// ── Agent/Partner system (Production Safe Patch) ───────────────────────────
const initAgentTables = require("./initAgentTables");
const agentRoutes = require("./routes/agent");
const adminAgentRoutes = require("./routes/adminAgent");
const { startSettlementScheduler } = require("./jobs/settlementJob");
// ── Withdrawal & Security System ───────────────────────────────────────────
const { router: withdrawalRoutes, initWithdrawalTables } = require("./routes/withdrawal");

// ── Referral Commission System (Production Safe Patch) ─────────────────────
const initReferralTables = require("./initReferralTables");
const { startReferralCommissionScheduler, runReferralCommissionJob } = require("./jobs/referralCommissionJob");

const app = express();
app.use(cors());
app.use(express.json());

// Trust Railway's reverse proxy for correct client IP detection
app.set("trust proxy", 1);

// ══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING (Feature #5)
// ══════════════════════════════════════════════════════════════════════════════

// General API: 60 requests per IP per minute
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: "請求過於頻繁，請稍後再試" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// Login API: 10 requests per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "登入嘗試過多，請 15 分鐘後再試" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Register API: 5 requests per IP per hour
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "註冊請求過多，請 1 小時後再試" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin API: 20 requests per IP per 15 minutes
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "後台請求過多，請稍後再試" },
  standardHeaders: true,
  legacyHeaders: false,
});

const JWT_SECRET = process.env.JWT_SECRET || "la1_secret_2026";
const BOT_TOKEN = process.env.BOT_TOKEN || "8796143383:AAHkbw_msst7ps7lt__cRlBwn7yhp82mv1U";
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
    banned INTEGER DEFAULT 0,
    ban_reason TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS deposits(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    payment_id TEXT,
    tx_id TEXT,
    screenshot_url TEXT,
    risk INTEGER DEFAULT 0,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, () => {
    // Add missing columns if table already exists
    const cols = [
      "tx_id TEXT",
      "screenshot_url TEXT",
      "reviewed_by TEXT",
      "reviewed_at DATETIME"
    ];
    cols.forEach(col => {
      db.run(`ALTER TABLE deposits ADD COLUMN ${col}`, () => {});
    });
  });

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

  // Feature #3: Withdrawals table
  db.run(`CREATE TABLE IF NOT EXISTS withdrawals(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    status TEXT DEFAULT 'pending',
    wallet_address TEXT,
    reviewed_by TEXT DEFAULT '',
    reject_reason TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME
  )`);

  // Feature #12: Rebate logs table
  db.run(`CREATE TABLE IF NOT EXISTS rebate_logs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    vip_level INTEGER,
    bet_amount REAL,
    period TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Announcements table
  db.run(`CREATE TABLE IF NOT EXISTS announcements(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    type TEXT DEFAULT 'info',
    pinned INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Game records
  db.run(`CREATE TABLE IF NOT EXISTS game_records(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    game_type TEXT,
    bet_amount REAL,
    result TEXT,
    win_amount REAL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Blackjack active sessions
  db.run(`CREATE TABLE IF NOT EXISTS blackjack_sessions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    session_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tickets table
  db.run(`CREATE TABLE IF NOT EXISTS tickets(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject TEXT,
    message TEXT,
    status TEXT DEFAULT 'open',
    admin_reply TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    replied_at DATETIME
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
    "banned INTEGER DEFAULT 0",
    "ban_reason TEXT DEFAULT ''",
    // ── New columns for push system ──
    "daily_push_count INTEGER DEFAULT 0",
    "last_push_at DATETIME",
    "last_push_date TEXT",
    "last_trigger TEXT",
    "opt_out INTEGER DEFAULT 0",
    "last_login DATETIME",
    "last_deposit_at DATETIME",
    "is_agent INTEGER DEFAULT 0",
  ];
  newCols.forEach(col => {
    const colName = col.split(" ")[0];
    db.run(`ALTER TABLE users ADD COLUMN ${col}`, () => {});
  });

  // Feature #6: Initialize message_templates table + seed data (from models/db.js)
  initSchema();
});

// ── Agent tables init (IF NOT EXISTS — non-destructive) ────────────────────
initAgentTables().catch(err => console.error("[AgentTables] Init error:", err.message));

// ── Referral commission tables init (IF NOT EXISTS — non-destructive) ──────────
initReferralTables().catch(err => console.error("[ReferralTables] Init error:", err.message));
initWithdrawalTables().catch(err => console.error("[WithdrawalTables] Init error:", err.message));

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
  // payload should contain { id, username, role }
  if (!payload.role) throw new Error("Not admin");
  return payload;
}

// Role-based access control middleware
const checkRole = (roles) => (req, res, next) => {
  try {
    const admin = adminAuth(req);
    if (!roles.includes(admin.role)) {
      return res.status(403).json({ error: "權限不足" });
    }
    req.admin = admin;
    next();
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
};

// Helper to log admin actions
async function logAdminAction(adminId, action, target, details, req) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  await dbRun("INSERT INTO admin_logs (admin_id, action, target, details, ip) VALUES (?, ?, ?, ?, ?)",
    [adminId, action, target, JSON.stringify(details), ip]);
}

// Feature #4: TG helpers wrapped in try/catch (never throw)
function sendTG(msg) {
  if (process.env.TG_TOKEN && process.env.TG_ID) {
    try {
      axios.get(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
        params: { chat_id: process.env.TG_ID, text: msg }
      }).catch(() => {});
    } catch (e) { console.error("[sendTG] error:", e.message); }
  }
}

function sendTGToUser(tg_id, msg) {
  if (!tg_id) return;
  try {
    axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      params: { chat_id: tg_id, text: msg, parse_mode: "HTML" }
    }).catch(() => {});
  } catch (e) { console.error("[sendTGToUser] error:", e.message); }
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

// dbGet, dbAll, dbRun are now imported from models/db.js (Feature #1)

// Feature #8: Check if user is banned (middleware helper)
async function checkBanned(userId) {
  const user = await dbGet("SELECT banned, ban_reason FROM users WHERE id = ?", [userId]);
  if (user && user.banned) {
    return { banned: true, reason: user.ban_reason || "帳戶已被封禁" };
  }
  return { banned: false };
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
  { min: 500, bonusRate: 0.33, wagerMultiplier: 10 },
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

app.post("/admin/login", adminLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "請輸入帳號和密碼" });

  try {
    const admin = await dbGet("SELECT * FROM admins WHERE username = ?", [username]);
    if (!admin) return res.status(401).json({ error: "帳號或密碼錯誤" });
    if (admin.status === "disabled") return res.status(403).json({ error: "帳號已被停用" });

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: "帳號或密碼錯誤" });

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role, ts: Date.now() },
      ADMIN_JWT_SECRET,
      { expiresIn: "8h" }
    );

    await dbRun("UPDATE admins SET last_login = datetime('now') WHERE id = ?", [admin.id]);
    await logAdminAction(admin.id, "login", "admin", { username: admin.username }, req);

    res.json({ token, role: admin.role, username: admin.username, ok: true });
  } catch (e) {
    res.status(500).json({ error: "登入失敗" });
  }
});

// Admin Management (super_admin only)
app.get("/admin/admins", adminLimiter, checkRole(["super_admin"]), async (req, res) => {
  try {
    const admins = await dbAll("SELECT id, username, role, status, created_at, last_login, created_by FROM admins ORDER BY created_at DESC");
    res.json(admins);
  } catch (e) {
    res.status(500).json({ error: "查詢失敗" });
  }
});

app.post("/admin/admins", adminLimiter, checkRole(["super_admin"]), async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: "缺少必要參數" });
  if (!["super_admin", "operator", "support"].includes(role)) return res.status(400).json({ error: "無效的角色" });

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    await dbRun("INSERT INTO admins (username, password_hash, role, created_by) VALUES (?, ?, ?, ?)",
      [username, hash, role, req.admin.username]);
    await logAdminAction(req.admin.id, "create_admin", "admin", { target_username: username, role }, req);
    res.json({ ok: true, message: "管理員創建成功" });
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(400).json({ error: "帳號已存在" });
    res.status(500).json({ error: "創建失敗" });
  }
});

app.put("/admin/admins/:id", adminLimiter, checkRole(["super_admin"]), async (req, res) => {
  const { id } = req.params;
  const { password, role, status } = req.body;

  try {
    const admin = await dbGet("SELECT * FROM admins WHERE id = ?", [id]);
    if (!admin) return res.status(404).json({ error: "管理員不存在" });

    let sql = "UPDATE admins SET ";
    const params = [];
    const updates = [];

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      updates.push("password_hash = ?");
      params.push(hash);
    }
    if (role) {
      updates.push("role = ?");
      params.push(role);
    }
    if (status) {
      updates.push("status = ?");
      params.push(status);
    }

    if (updates.length === 0) return res.status(400).json({ error: "無更新內容" });

    sql += updates.join(", ") + " WHERE id = ?";
    params.push(id);

    await dbRun(sql, params);
    await logAdminAction(req.admin.id, "update_admin", "admin", { target_id: id, updates: Object.keys(req.body) }, req);
    res.json({ ok: true, message: "更新成功" });
  } catch (e) {
    res.status(500).json({ error: "更新失敗" });
  }
});

app.delete("/admin/admins/:id", adminLimiter, checkRole(["super_admin"]), async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.admin.id) return res.status(400).json({ error: "不能刪除自己" });

  try {
    const admin = await dbGet("SELECT * FROM admins WHERE id = ?", [id]);
    if (!admin) return res.status(404).json({ error: "管理員不存在" });

    await dbRun("DELETE FROM admins WHERE id = ?", [id]);
    await logAdminAction(req.admin.id, "delete_admin", "admin", { target_id: id, target_username: admin.username }, req);
    res.json({ ok: true, message: "刪除成功" });
  } catch (e) {
    res.status(500).json({ error: "刪除失敗" });
  }
});

app.get("/admin/logs", adminLimiter, checkRole(["super_admin"]), async (req, res) => {
  try {
    const logs = await dbAll(`
      SELECT al.*, a.username as admin_username 
      FROM admin_logs al 
      LEFT JOIN admins a ON al.admin_id = a.id 
      ORDER BY al.created_at DESC LIMIT 500
    `);
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: "查詢失敗" });
  }
});

app.get("/admin/users", adminLimiter, checkRole(["super_admin", "operator"]), async (req, res) => {
  const q = req.query.q ? `%${req.query.q}%` : null;
  const sql = q
    ? `SELECT * FROM users WHERE username LIKE ? OR tg_id LIKE ? OR tg_username LIKE ? OR tg_first_name LIKE ? ORDER BY created_at DESC`
    : `SELECT * FROM users ORDER BY created_at DESC`;
  const params = q ? [q, q, q, q] : [];
  db.all(sql, params, (e, rows) => {
    const users = (rows || []).map(u => ({
      ...u,
      banned: u.banned || 0,
      ban_reason: u.ban_reason || "",
    }));
    res.json(users);
  });
});

app.post("/admin/adjust-balance", adminLimiter, async (req, res) => {
  let adminPayload;
  try { adminPayload = adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { userId, amount, type, reason } = req.body;
  if (!userId || !amount || !type) return res.status(400).json({ error: "缺少必要參數" });
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) return res.status(400).json({ error: "金額必須為正數" });
  if (numAmount > 10000000) return res.status(400).json({ error: "單筆上分/扣分不能超過 10,000,000 USDT" });
  if (type !== "add" && type !== "deduct") return res.status(400).json({ error: "type 必須為 add 或 deduct" });

  // ── VIP threshold helper ────────────────────────────────────────────────────
  function calcVipLevel(totalDeposit) {
    if (totalDeposit >= 100000) return 5;
    if (totalDeposit >= 50000)  return 4;
    if (totalDeposit >= 20000)  return 3;
    if (totalDeposit >= 5000)   return 2;
    if (totalDeposit >= 1000)   return 1;
    return 0;
  }

  try {
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });

    const newBalance = type === "add" ? user.balance + numAmount : user.balance - numAmount;
    if (newBalance < 0) return res.status(400).json({ error: `餘額不足，當前：${user.balance.toFixed(2)}` });

    // Determine balance_log type: admin_add or admin_deduct
    const logType = type === "add" ? "admin_add" : "admin_deduct";

    // Determine if this is a deposit confirmation
    // Exact match: 儲值確認, or keywords: 儲值, 充值, deposit, 入款, 補款
    const reasonLower = (reason || "").toLowerCase();
    const isDepositConfirm = reason === "儲值確認";
    const isDepositKeyword = /儲值|充值|deposit|入款|補款/.test(reasonLower);
    const shouldUpdateDeposit = type === "add" && isDepositKeyword;

    // Build operator string with admin info
    const operatorStr = `admin:${adminPayload.username || adminPayload.id}`;
    const adminUsername = adminPayload.username || String(adminPayload.id);

    // ── Step 1: Update user balance (and optionally total_deposit + VIP) ─────
    let newTotalDeposit = user.total_deposit || 0;
    let newVipLevel = user.vip_level || 0;
    let vipUpgraded = false;

    if (shouldUpdateDeposit) {
      newTotalDeposit = newTotalDeposit + numAmount;
      const calculatedVip = calcVipLevel(newTotalDeposit);
      if (calculatedVip > newVipLevel) {
        newVipLevel = calculatedVip;
        vipUpgraded = true;
      }
      await dbRun(
        "UPDATE users SET balance = ?, total_deposit = ?, vip_level = ? WHERE id = ?",
        [newBalance, newTotalDeposit, newVipLevel, userId]
      );
    } else {
      await dbRun("UPDATE users SET balance = ? WHERE id = ?", [newBalance, userId]);
    }

    // ── Step 2: Record to balance_logs ───────────────────────────────────────
    const balanceLogType = isDepositConfirm ? "deposit" : logType;
    await dbRun(
      "INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, ?, ?, ?, ?)",
      [userId, balanceLogType, type === "add" ? numAmount : -numAmount, reason || "", operatorStr]
    );

    // ── Step 3: Write deposits table record (for deposit confirmations) ───────
    let depositId = null;
    if (isDepositConfirm) {
      const depResult = await dbRun(
        "INSERT INTO deposits (user_id, amount, status, reviewed_by, reviewed_at, created_at) VALUES (?, ?, 'approved', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        [userId, numAmount, adminUsername]
      );
      depositId = depResult.lastID;
    }

    // ── Step 4: First deposit bonus (only for deposit confirmation) ───────────
    let firstDepositBonus = 0;
    let firstDepositClaimed = false;
    if (isDepositConfirm && (user.first_deposit_claimed === 0 || user.first_deposit_claimed === null) && numAmount >= 500) {
      firstDepositBonus = Math.floor(numAmount * 0.33 * 100) / 100; // 33% bonus
      const wagerReq = (numAmount + firstDepositBonus) * 10;
      // Add bonus to balance
      await dbRun(
        "UPDATE users SET balance = balance + ?, first_deposit_claimed = 1, wager_requirement = wager_requirement + ? WHERE id = ?",
        [firstDepositBonus, wagerReq, userId]
      );
      // Record bonus in balance_logs
      await dbRun(
        "INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, 'first_deposit', ?, ?, ?)",
        [userId, firstDepositBonus, `首充獎勵 33% (儲值 ${numAmount} USDT)`, "system"]
      );
      firstDepositClaimed = true;
    }

    // ── Step 5: Referral commission (for deposit confirmations with inviter) ──
    let referralScheduled = false;
    if (isDepositConfirm && user.invited_by && user.invited_by > 0) {
      const commissionAmount = Math.floor(numAmount * 0.10 * 100) / 100; // 10% commission
      const wageringRequired = commissionAmount * 5; // 5x wagering required
      // Schedule for next day (insert as pending)
      await dbRun(
        `INSERT INTO referral_commissions 
         (referrer_id, referred_id, deposit_amount, commission_amount, status, wagering_required, deposit_date)
         VALUES (?, ?, ?, ?, 'pending', ?, date('now'))`,
        [user.invited_by, userId, numAmount, commissionAmount, wageringRequired]
      );
      referralScheduled = true;
    }

    // ── Step 6: Log admin action ──────────────────────────────────────────────
    logAdminAction(
      adminPayload.id,
      type === "add" ? "adjust_balance_add" : "adjust_balance_deduct",
      "user",
      { userId, amount: numAmount, reason, shouldUpdateDeposit, vipUpgraded, firstDepositClaimed, referralScheduled },
      req
    );

    // ── Step 6.1: Audit log ──
    await dbRun("INSERT INTO audit_logs (admin_id, action, target_type, target_id, details, ip) VALUES (?, ?, 'user', ?, ?, ?)",
      [adminPayload.id, type === "add" ? "adjust_balance_add" : "adjust_balance_deduct", userId, `${type} ${numAmount}U: ${reason}`, req.headers["x-forwarded-for"] || req.socket.remoteAddress]);

    // ── Step 7: TG notifications ──────────────────────────────────────────────
    const updatedUser = await dbGet("SELECT balance FROM users WHERE id = ?", [userId]);
    const finalBalance = updatedUser ? updatedUser.balance : newBalance + (firstDepositBonus || 0);

    if (user.tg_id) {
      const displayName = user.tg_first_name || user.tg_username || user.username;
      const actionText = type === "add" ? "上分" : "扣款";
      const emoji = type === "add" ? "💰" : "📤";
      let extraNotes = "";
      if (shouldUpdateDeposit) extraNotes += `\n📊 累計儲值：<b>${newTotalDeposit.toFixed(2)} USDT</b>`;
      if (vipUpgraded) extraNotes += `\n👑 恭喜升級至 <b>VIP${newVipLevel}</b>！`;
      if (firstDepositClaimed) extraNotes += `\n🎁 首充獎勵 <b>+${firstDepositBonus.toFixed(2)} USDT</b> 已發放！`;
      if (referralScheduled) extraNotes += `\n🤝 推薦返佣將於明日自動發放給邀請人`;
      const msg = `${emoji} <b>帳戶${actionText}通知</b>\n\n親愛的 ${displayName}，\n您的帳戶已${type === "add" ? "增加" : "扣除"} <b>${numAmount.toFixed(2)} USDT</b>\n💼 當前餘額：<b>${finalBalance.toFixed(2)} USDT</b>${reason ? `\n📝 備註：${reason}` : ""}${extraNotes}\n\n如有疑問請聯繫客服 @LA1111_bot`;
      sendTGToUser(user.tg_id, msg);
    }

    // Notify inviter about scheduled commission
    if (referralScheduled) {
      const inviter = await dbGet("SELECT tg_id, tg_first_name, tg_username, username FROM users WHERE id = ?", [user.invited_by]);
      if (inviter && inviter.tg_id) {
        const commissionAmount = Math.floor(numAmount * 0.10 * 100) / 100;
        const inviterName = inviter.tg_first_name || inviter.tg_username || inviter.username;
        const referredName = user.tg_first_name || user.tg_username || user.username;
        sendTGToUser(inviter.tg_id, `🤝 <b>推薦返佣通知</b>\n\n親愛的 ${inviterName}，\n您邀請的好友 ${referredName} 已完成儲值 <b>${numAmount.toFixed(2)} USDT</b>\n💰 您將獲得返佣：<b>${commissionAmount.toFixed(2)} USDT</b>\n⏰ 返佣將於明日自動到帳\n\n繼續邀請好友，賺取更多返佣！`);
      }
    }

    sendTG(`${type === "add" ? "⬆️ 上分" : "⬇️ 扣分"} | ${user.tg_username || user.username} | ${numAmount} USDT | 餘額: ${finalBalance.toFixed(2)} | 備註: ${reason || "無"}${shouldUpdateDeposit ? " | 已計入儲值" : ""}${vipUpgraded ? ` | VIP升至${newVipLevel}` : ""}${firstDepositClaimed ? ` | 首充獎勵+${firstDepositBonus}` : ""}`);

    res.json({
      ok: true,
      newBalance: finalBalance,
      message: `${type === "add" ? "上分" : "扣分"}成功`,
      deposit_updated: shouldUpdateDeposit,
      log_type: balanceLogType,
      vip_upgraded: vipUpgraded,
      new_vip_level: newVipLevel,
      first_deposit_bonus: firstDepositBonus,
      referral_scheduled: referralScheduled,
      deposit_id: depositId
    });
  } catch (e) {
    console.error("[adjust-balance] error:", e.message);
    res.status(500).json({ error: "操作失敗" });
  }
});

app.get("/admin/balance-logs", adminLimiter, (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  db.all(`SELECT bl.*, u.username, u.tg_username, u.tg_first_name FROM balance_logs bl LEFT JOIN users u ON bl.user_id = u.id ORDER BY bl.created_at DESC LIMIT 200`, (e, rows) => res.json(rows || []));
});

app.get("/admin/deposits", adminLimiter, (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  db.all("SELECT * FROM deposits ORDER BY id DESC", (e, rows) => res.json(rows || []));
});

// Admin: flag user for risk
app.post("/admin/flag-user", adminLimiter, (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { userId, flag } = req.body;
  db.run("UPDATE users SET risk_flag = ? WHERE id = ?", [flag ? 1 : 0, userId], (err) => {
    if (err) return res.status(500).json({ error: "操作失敗" });
    res.json({ ok: true, message: flag ? "已標記風控" : "已解除風控" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Feature #8: BAN / UNBAN USER
// ══════════════════════════════════════════════════════════════════════════════

app.post("/admin/ban-user", adminLimiter, async (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { userId, banned, reason } = req.body;
  if (!userId || banned === undefined) return res.status(400).json({ error: "缺少必要參數" });

  try {
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });

    const banValue = banned ? 1 : 0;
    const banReason = reason || "";
    await dbRun("UPDATE users SET banned = ?, ban_reason = ? WHERE id = ?", [banValue, banReason, userId]);

    // Audit log
    await dbRun("INSERT INTO audit_logs (admin_id, action, target_type, target_id, details, ip) VALUES (?, ?, 'user', ?, ?, ?)",
      [adminAuth(req).id, banned ? 'ban_user' : 'unban_user', userId, banReason, req.headers["x-forwarded-for"] || req.socket.remoteAddress]);

    // Notify user via TG
    if (user.tg_id) {
      if (banned) {
        sendTGToUser(user.tg_id, `🚫 <b>帳戶封禁通知</b>\n\n您的帳戶已被封禁。\n📝 原因：${banReason || "違規操作"}\n\n如有疑問請聯繫客服 @LA1111_bot`);
      } else {
        sendTGToUser(user.tg_id, `✅ <b>帳戶解封通知</b>\n\n您的帳戶已解除封禁，可正常使用。\n\n感謝您的配合！`);
      }
    }

    sendTG(`${banned ? "🚫 封號" : "✅ 解封"} | ${user.tg_username || user.username} | ${banReason}`);
    res.json({ ok: true, message: banned ? "已封號" : "已解封" });
  } catch (e) {
    res.status(500).json({ error: "操作失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Feature #3: WITHDRAWAL REVIEW SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

// Admin: Get withdrawal list
app.get("/admin/withdrawals", adminLimiter, async (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  try {
    const status = req.query.status; // pending, approved, rejected
    let sql = `SELECT w.*, u.username, u.tg_username, u.tg_first_name, u.balance, u.tg_id
               FROM withdrawals w LEFT JOIN users u ON w.user_id = u.id`;
    const params = [];
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      sql += " WHERE w.status = ?";
      params.push(status);
    }
    sql += " ORDER BY w.created_at DESC LIMIT 200";
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "查詢失敗" });
  }
});

// Admin: Review withdrawal (approve/reject)
app.post("/admin/review-withdrawal", adminLimiter, async (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { withdrawalId, action, reason } = req.body;
  if (!withdrawalId || !action) return res.status(400).json({ error: "缺少必要參數" });
  if (action !== "approve" && action !== "reject") return res.status(400).json({ error: "action 必須為 approve 或 reject" });

  try {
    const withdrawal = await dbGet("SELECT * FROM withdrawals WHERE id = ?", [withdrawalId]);
    if (!withdrawal) return res.status(404).json({ error: "提款記錄不存在" });
    if (withdrawal.status !== "pending") return res.status(400).json({ error: "該提款已被處理" });

    const user = await dbGet("SELECT * FROM users WHERE id = ?", [withdrawal.user_id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });

    if (action === "approve") {
      // Deduct balance
      if (user.balance < withdrawal.amount) {
        return res.status(400).json({ error: `用戶餘額不足，當前：${user.balance.toFixed(2)}` });
      }
      const newBalance = user.balance - withdrawal.amount;
      await dbRun("UPDATE users SET balance = ? WHERE id = ?", [newBalance, withdrawal.user_id]);
      await dbRun("UPDATE withdrawals SET status = 'approved', reviewed_by = 'admin', reviewed_at = datetime('now') WHERE id = ?", [withdrawalId]);
      await dbRun("INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, ?, ?, ?, ?)",
        [withdrawal.user_id, "deduct", withdrawal.amount, `提款審核通過（${withdrawal.wallet_address}）`, "admin"]);

      // Feature #7: TG notification for approved withdrawal
      if (user.tg_id) {
        const displayName = user.tg_first_name || user.tg_username || user.username;
        sendTGToUser(user.tg_id, `✅ <b>提款到帳通知</b>\n\n親愛的 ${displayName}，\n您的提款申請已通過！\n\n💸 提款金額：<b>${withdrawal.amount.toFixed(2)} USDT</b>\n💼 當前餘額：<b>${newBalance.toFixed(2)} USDT</b>\n📬 錢包地址：${withdrawal.wallet_address}\n\n資金將在 24 小時內到帳，如有疑問請聯繫客服 @LA1111_bot`);
      }
      sendTG(`✅ 提款通過 | ${user.tg_username || user.username} | ${withdrawal.amount} USDT | 地址: ${withdrawal.wallet_address}`);
      res.json({ ok: true, message: "提款已批准", newBalance });
    } else {
      // Reject - no balance deduction needed (balance was not held)
      const rejectReason = reason || "審核未通過";
      await dbRun("UPDATE withdrawals SET status = 'rejected', reviewed_by = 'admin', reject_reason = ?, reviewed_at = datetime('now') WHERE id = ?", [rejectReason, withdrawalId]);

      // Feature #7: TG notification for rejected withdrawal
      if (user.tg_id) {
        const displayName = user.tg_first_name || user.tg_username || user.username;
        sendTGToUser(user.tg_id, `❌ <b>提款申請被拒絕</b>\n\n親愛的 ${displayName}，\n您的提款申請未通過審核。\n\n💸 申請金額：<b>${withdrawal.amount.toFixed(2)} USDT</b>\n📝 原因：${rejectReason}\n💼 當前餘額：<b>${user.balance.toFixed(2)} USDT</b>\n\n如有疑問請聯繫客服 @LA1111_bot`);
      }
      sendTG(`❌ 提款拒絕 | ${user.tg_username || user.username} | ${withdrawal.amount} USDT | 原因: ${rejectReason}`);
      res.json({ ok: true, message: "提款已拒絕" });
    }
  } catch (e) {
    console.error("Review withdrawal error:", e);
    res.status(500).json({ error: "操作失敗" });
  }
});

// Feature #12: Admin calculate rebate
app.post("/admin/calculate-rebate", adminLimiter, checkRole(["super_admin", "operator"]), async (req, res) => {
  try {
    const today = getToday();
    const period = req.body.period || today;

    // Check if rebate already calculated for this period
    const existing = await dbGet("SELECT COUNT(*) as cnt FROM rebate_logs WHERE period = ?", [period]);
    if (existing && existing.cnt > 0) {
      return res.status(400).json({ error: `${period} 的返水已計算過` });
    }

    // Get all users with bets
    const users = await dbAll("SELECT * FROM users WHERE total_bet > 0");
    let totalRebate = 0;
    let processedCount = 0;

    for (const user of users) {
      const vipLevel = getVipLevel(user.total_bet || 0);
      const vipConfig = VIP_CONFIG[vipLevel];
      if (!vipConfig || vipConfig.rebate <= 0) continue;

      // Calculate bet amount for the period (from balance_logs)
      const betData = await dbGet(
        "SELECT COALESCE(SUM(amount), 0) as total FROM balance_logs WHERE user_id = ? AND type = 'bet' AND date(created_at) = ?",
        [user.id, period]
      );
      const periodBet = betData?.total || 0;
      if (periodBet <= 0) continue;

      // Weekend bonus
      const periodDate = new Date(period);
      const dayOfWeek = periodDate.getDay();
      const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
      let rebateRate = vipConfig.rebate;
      if (isWeekendDay && vipLevel >= 2) {
        rebateRate = rebateRate * 1.3; // 30% weekend bonus
      }

      const rebateAmount = parseFloat((periodBet * rebateRate).toFixed(2));
      if (rebateAmount <= 0) continue;

      // Add rebate to user balance
      await dbRun("UPDATE users SET balance = balance + ? WHERE id = ?", [rebateAmount, user.id]);
      await dbRun("INSERT INTO rebate_logs (user_id, amount, vip_level, bet_amount, period) VALUES (?, ?, ?, ?, ?)",
        [user.id, rebateAmount, vipLevel, periodBet, period]);
      await dbRun("INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, ?, ?, ?, ?)",
        [user.id, "add", rebateAmount, `VIP${vipLevel} 返水（投注 ${periodBet.toFixed(2)}，比例 ${(rebateRate * 100).toFixed(2)}%）`, req.admin.username]);

      // Notify user
      if (user.tg_id) {
        sendTGToUser(user.tg_id, `🎁 <b>返水到帳通知</b>\n\n💰 返水金額：<b>${rebateAmount.toFixed(2)} USDT</b>\n🎰 投注額：${periodBet.toFixed(2)} USDT\n👑 VIP 等級：${vipConfig.name}\n📊 返水比例：${(rebateRate * 100).toFixed(2)}%\n📅 期間：${period}\n\n繼續遊戲享受更多返水！🔥`);
      }

      totalRebate += rebateAmount;
      processedCount++;
    }

    sendTG(`📊 返水結算完成 | 期間: ${period} | 人數: ${processedCount} | 總額: ${totalRebate.toFixed(2)} USDT`);
    logAdminAction(req.admin.id, "calculate_rebate", "system", { period, processedCount, totalRebate }, req);
    res.json({ ok: true, period, processedCount, totalRebate: totalRebate.toFixed(2) });
  } catch (e) {
    console.error("Calculate rebate error:", e);
    res.status(500).json({ error: "返水計算失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TG LOGIN
// ══════════════════════════════════════════════════════════════════════════════

app.post("/tg-login", loginLimiter, (req, res) => {
  const { initData, referral } = req.body;
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

  // Helper: link a newly created user to a referrer by invite_code
  function linkReferral(newUserId, refCode) {
    if (!refCode) return;
    db.get("SELECT id FROM users WHERE invite_code = ?", [refCode], (e, referrer) => {
      if (referrer && referrer.id !== newUserId) {
        db.run("UPDATE users SET invited_by = ? WHERE id = ? AND invited_by = 0", [referrer.id, newUserId]);
        db.run("UPDATE users SET invite_count = invite_count + 1 WHERE id = ?", [referrer.id]);
        console.log(`[REFERRAL] TG user ${newUserId} linked to referrer ${referrer.id} via code ${refCode}`);
      }
    });
  }

  db.get("SELECT * FROM users WHERE tg_id = ?", [tg_id_str], (err, existing) => {
    if (existing) {
      // Feature #8: Check if user is banned
      if (existing.banned) {
        return res.status(403).json({ error: `帳戶已被封禁：${existing.ban_reason || "違規操作"}` });
      }
      db.run("UPDATE users SET tg_first_name=?, tg_last_name=?, tg_username=? WHERE tg_id=?", [first_name, last_name, username, tg_id_str]);
      // If this existing user has no referrer yet and a referral code was sent, link them now
      const referralLinked = !!(referral && existing.invited_by === 0);
      if (referralLinked) {
        linkReferral(existing.id, referral);
      }
      const token = jwt.sign({ id: existing.id, tg_id: tg_id_str }, JWT_SECRET, { expiresIn: "30d" });
      return res.json({
        token,
        referral_linked: referralLinked,
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
                linkReferral(row.id, referral);
                const token = jwt.sign({ id: row.id, tg_id: tg_id_str }, JWT_SECRET, { expiresIn: "30d" });
                sendTG(`🤖 TG 新用戶：${first_name} (@${username || tg_id_str})`);
                return res.json({ token, referral_linked: !!referral, user: { id: row.id, username: row.username, first_name, tg_id: tg_id_str, balance: 0, vip_level: 0, invite_code: row.invite_code } });
              });
            }
          );
          return;
        }
        const newId = this.lastID;
        linkReferral(newId, referral);
        const token = jwt.sign({ id: newId, tg_id: tg_id_str }, JWT_SECRET, { expiresIn: "30d" });
        sendTG(`🤖 TG 新用戶：${first_name} (@${username || tg_id_str})`);
        res.json({ token, referral_linked: !!referral, user: { id: newId, username: display_username, first_name, tg_id: tg_id_str, balance: 0, vip_level: 0, invite_code: inviteCode } });
      }
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// USER AUTH (Feature #4: bcrypt password encryption)
// ══════════════════════════════════════════════════════════════════════════════

app.post("/register", registerLimiter, async (req, res) => {
  const inviteCode = generateInviteCode();
  const { username, password, referral } = req.body;
  if (!username || !password) return res.status(400).json({ error: "請輸入用戶名和密碼" });

  try {
    // Feature #4: Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run("INSERT INTO users(username, password, invite_code) VALUES (?, ?, ?)", [username, hashedPassword, inviteCode], function(err) {
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
  } catch (e) {
    res.status(500).json({ error: "註冊失敗" });
  }
});

app.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "請輸入用戶名和密碼" });

  // Support backup_username login as well
  db.get(
    "SELECT * FROM users WHERE username = ? OR (backup_username != '' AND backup_username = ?)",
    [username, username],
    async (e, u) => {
    if (!u) return res.json({ error: "帳號或密碼錯誤" });

    // Determine which password field to check
    // If the user logged in via backup_username, use backup_password; otherwise use password
    const isBackupLogin = u.backup_username && u.backup_username === username;
    const storedPassword = isBackupLogin ? u.backup_password : u.password;
    if (!storedPassword) return res.json({ error: "帳號或密碼錯誤" });

    // Feature #8: Check if user is banned
    if (u.banned) {
      return res.status(403).json({ error: `帳戶已被封禁：${u.ban_reason || "違規操作"}` });
    }

    // Feature #4: Backward compatible password check
    let passwordMatch = false;

    // Check if password is bcrypt hashed (starts with $2a$ or $2b$)
    if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$")) {
      passwordMatch = await bcrypt.compare(password, storedPassword);
    } else {
      // Legacy plaintext password comparison
      passwordMatch = (storedPassword === password);
      // Auto-upgrade: hash the plaintext password (only for main password field)
      if (passwordMatch && !isBackupLogin) {
        try {
          const hashedPassword = await bcrypt.hash(password, 10);
          db.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, u.id]);
          console.log(`[AUTH] Auto-upgraded password for user: ${username}`);
        } catch (hashErr) {
          console.error("[AUTH] Failed to auto-upgrade password:", hashErr);
        }
      }
    }

    if (!passwordMatch) return res.json({ error: "帳號或密碼錯誤" });

    const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: u.id, username: u.username, balance: u.balance, vip_level: u.vip_level || 0, invite_code: u.invite_code } });
  });
});

app.get("/me", async (req, res) => {
  try {
    const u = auth(req);

    // Feature #8: Check if user is banned
    const banCheck = await checkBanned(u.id);
    if (banCheck.banned) {
      return res.status(403).json({ error: `帳戶已被封禁：${banCheck.reason}` });
    }

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
        banned: row.banned || 0,
        ban_reason: row.ban_reason || "",
      });
    });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Feature #3: USER WITHDRAWAL REQUEST
// ══════════════════════════════════════════════════════════════════════════════

app.post("/withdraw", async (req, res) => {
  try {
    const u = auth(req);

    // Feature #8: Check if user is banned
    const banCheck = await checkBanned(u.id);
    if (banCheck.banned) {
      return res.status(403).json({ error: `帳戶已被封禁：${banCheck.reason}` });
    }

    const { amount, wallet_address } = req.body;
    if (!amount || !wallet_address) return res.status(400).json({ error: "請輸入提款金額和錢包地址" });

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return res.status(400).json({ error: "金額必須為正數" });
    if (numAmount < 10) return res.status(400).json({ error: "最低提款金額為 10 USDT" });

    const user = await dbGet("SELECT * FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });
    if (user.risk_flag) return res.status(403).json({ error: "帳戶異常，請聯繫客服" });

    // Check balance
    if (user.balance < numAmount) {
      return res.status(400).json({ error: `餘額不足，當前餘額：${user.balance.toFixed(2)} USDT` });
    }

    // Check wager requirement
    if ((user.wager_requirement || 0) > 0) {
      return res.status(400).json({
        error: `流水要求未達標，還需完成 ${user.wager_requirement.toFixed(2)} USDT 流水`,
        wager_remaining: user.wager_requirement
      });
    }

    // Check if there's already a pending withdrawal
    const pendingWithdrawal = await dbGet("SELECT * FROM withdrawals WHERE user_id = ? AND status = 'pending'", [u.id]);
    if (pendingWithdrawal) {
      return res.status(400).json({ error: "您已有一筆待審核的提款申請，請等待處理完成" });
    }

    // Create withdrawal request
    await dbRun("INSERT INTO withdrawals (user_id, amount, wallet_address, status) VALUES (?, ?, ?, 'pending')",
      [u.id, numAmount, wallet_address]);

    sendTG(`📤 提款申請 | ${user.tg_username || user.username} | ${numAmount} USDT | 地址: ${wallet_address}`);

    if (user.tg_id) {
      sendTGToUser(user.tg_id, `📤 <b>提款申請已提交</b>\n\n💸 金額：<b>${numAmount.toFixed(2)} USDT</b>\n📬 地址：${wallet_address}\n⏳ 狀態：審核中\n\n請耐心等待審核，通常 24 小時內處理。`);
    }

    res.json({ ok: true, message: "提款申請已提交，請等待審核" });
  } catch (e) {
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") {
      return res.status(401).json({ error: "未授權" });
    }
    console.error("Withdraw error:", e);
    res.status(500).json({ error: "提款申請失敗" });
  }
});

// User: Get own withdrawal history
app.get("/withdraw/history", async (req, res) => {
  try {
    const u = auth(req);
    const rows = await dbAll("SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", [u.id]);
    res.json(rows);
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

    // Feature #8: Check if user is banned
    const banCheck = await checkBanned(u.id);
    if (banCheck.banned) {
      return res.status(403).json({ error: `帳戶已被封禁：${banCheck.reason}` });
    }

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

    const bonusAmount = Math.floor(user.total_deposit * tier.bonusRate);
    const wagerReq = (user.total_deposit + bonusAmount) * tier.wagerMultiplier;
    await dbRun("UPDATE users SET balance = balance + ?, first_deposit_claimed = 1, wager_requirement = wager_requirement + ? WHERE id = ?",
      [bonusAmount, wagerReq, u.id]);
    await dbRun("INSERT INTO first_deposit_logs (user_id, deposit_amount, bonus_amount, wager_multiplier) VALUES (?, ?, ?, ?)",
      [u.id, user.total_deposit, bonusAmount, tier.wagerMultiplier]);
    await dbRun("INSERT INTO balance_logs (user_id, type, amount, reason, wager_req, operator) VALUES (?, ?, ?, ?, ?, ?)",
      [u.id, "add", bonusAmount, `首充獎勵（充${user.total_deposit}送${bonusAmount}）`, wagerReq, "system"]);

    if (user.tg_id) {
      sendTGToUser(user.tg_id, `🎁 <b>首充獎勵已到帳！</b>\n\n💰 獎勵金額：<b>${bonusAmount} USDT</b>\n🎯 流水要求：${tier.wagerMultiplier} 倍（${wagerReq.toFixed(0)} USDT）\n\n祝您好運！🍀`);
    }

    res.json({ ok: true, bonus: bonusAmount, wagerMultiplier: tier.wagerMultiplier, wagerReq });
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

    // Feature #8: Check if user is banned
    const banCheck = await checkBanned(u.id);
    if (banCheck.banned) {
      return res.status(403).json({ error: `帳戶已被封禁：${banCheck.reason}` });
    }

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

    // ── New: referral_commissions stats ──────────────────────────────────────
    // Total commission earned (all paid commissions)
    const totalCommissionRow = await dbGet(
      "SELECT COALESCE(SUM(commission_amount), 0) as total FROM referral_commissions WHERE referrer_id = ? AND status = 'paid'",
      [u.id]
    );
    // Pending commissions (not yet dispatched — queued for next day)
    const pendingCommissionRow = await dbGet(
      "SELECT COALESCE(SUM(commission_amount), 0) as total FROM referral_commissions WHERE referrer_id = ? AND status = 'pending'",
      [u.id]
    );
    // Locked commissions: paid but wagering not yet complete
    const lockedCommissions = await dbAll(
      "SELECT * FROM referral_commissions WHERE referrer_id = ? AND status = 'paid' AND wagering_completed < wagering_required ORDER BY created_at DESC LIMIT 20",
      [u.id]
    );
    // Recent commission history
    const commissionHistory = await dbAll(
      "SELECT rc.*, u.tg_first_name, u.tg_username, u.username as referred_username FROM referral_commissions rc LEFT JOIN users u ON rc.referred_id = u.id WHERE rc.referrer_id = ? ORDER BY rc.created_at DESC LIMIT 30",
      [u.id]
    );

    const inviteLink = `${SITE_URL}?ref=${user.invite_code}`;
    const tgLink = `https://t.me/LA1111_bot?start=ref_${user.invite_code}`;

    res.json({
      invite_code: user.invite_code,
      invite_link: inviteLink,
      tg_link: tgLink,
      invite_count: user.invite_count || 0,
      invite_earnings: user.invite_earnings || 0,
      // New fields for 分潤獎勵 system
      total_commission: totalCommissionRow?.total || 0,
      pending_commission: pendingCommissionRow?.total || 0,
      locked_commissions: lockedCommissions,
      commission_history: commissionHistory,
      commission_rate: "10%",
      wagering_multiplier: 5,
      referrals,
      logs,
      commission_rates: { level1: "10%" },
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

    // Feature #8: Check if user is banned
    const banCheck = await checkBanned(u.id);
    if (banCheck.banned) {
      return res.status(403).json({ error: `帳戶已被封禁：${banCheck.reason}` });
    }

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
// Feature #12: REBATE HISTORY (User)
// ══════════════════════════════════════════════════════════════════════════════

app.get("/promo/rebate-history", async (req, res) => {
  try {
    const u = auth(req);
    const rows = await dbAll("SELECT * FROM rebate_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", [u.id]);
    res.json(rows);
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

    // Feature #8: Check if user is banned
    const banCheck = await checkBanned(u.id);
    if (banCheck.banned) {
      return res.status(403).json({ error: `帳戶已被封禁：${banCheck.reason}` });
    }

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
      db.run("UPDATE users SET balance=balance+?, total_deposit=total_deposit+?, last_deposit_at=datetime('now') WHERE id=?", [row.amount, row.amount, row.user_id]);

      // Check if this is first deposit → trigger legacy referral commission (L1/L2)
      const user = await dbGet("SELECT * FROM users WHERE id = ?", [row.user_id]);
      if (user && (user.total_deposit || 0) === 0) {
        // First deposit → process legacy referral (kept for backward compatibility)
        processReferralCommission(row.user_id, row.amount);
      }

      // NEW: Queue a pending referral_commissions record for next-day auto-dispatch
      // This covers ALL deposits (not just first deposit) for the new 10% system
      if (user && user.invited_by && user.invited_by !== 0) {
        const today = getToday();
        // Insert as 'pending' — daily job will process and pay out tomorrow
        db.run(`
          INSERT OR IGNORE INTO referral_commissions
            (referrer_id, referred_id, deposit_amount, commission_amount, status,
             wagering_required, wagering_completed, deposit_date)
          VALUES (?, ?, ?, ?, 'pending', ?, 0, ?)
        `, [
          user.invited_by,
          user.id,
          row.amount,
          parseFloat((row.amount * 0.10).toFixed(4)),
          parseFloat((row.amount * 0.10 * 5).toFixed(4)),
          today
        ], (insertErr) => {
          if (insertErr) console.error("[IPN] Failed to queue referral commission:", insertErr.message);
          else console.log(`[IPN] Queued referral commission for deposit ${row.id} by user ${user.id}`);
        });
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
// ANNOUNCEMENT SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

// Public: Get all active announcements
app.get("/announcements", async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM announcements WHERE active = 1 ORDER BY pinned DESC, created_at DESC");
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

// Admin: Create announcement
app.post("/admin/announcement", async (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { title, content, type, pinned } = req.body;
  if (!title || !content) return res.status(400).json({ error: "標題和內容不能為空" });
  const validTypes = ["info", "warning", "promo", "maintenance"];
  const annType = validTypes.includes(type) ? type : "info";
  try {
    const result = await dbRun(
      "INSERT INTO announcements (title, content, type, pinned) VALUES (?, ?, ?, ?)",
      [title, content, annType, pinned ? 1 : 0]
    );
    res.json({ ok: true, id: result.lastID, message: "公告已發布" });
  } catch (e) {
    res.status(500).json({ error: "發布失敗" });
  }
});

// Admin: Delete announcement
app.delete("/admin/announcement/:id", async (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  try {
    await dbRun("DELETE FROM announcements WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "公告已刪除" });
  } catch (e) {
    res.status(500).json({ error: "刪除失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TICKET SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

// User: Submit ticket
app.post("/ticket", async (req, res) => {
  try {
    const u = auth(req);
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ error: "主題和內容不能為空" });
    const result = await dbRun(
      "INSERT INTO tickets (user_id, subject, message) VALUES (?, ?, ?)",
      [u.id, subject, message]
    );
    sendTG(`🎫 新工單 #${result.lastID}：${subject}`);
    res.json({ ok: true, id: result.lastID, message: "工單已提交" });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// User: Get my tickets
app.get("/my-tickets", async (req, res) => {
  try {
    const u = auth(req);
    const rows = await dbAll("SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC", [u.id]);
    res.json(rows);
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// Admin: Get all tickets
app.get("/admin/tickets", async (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  try {
    const rows = await dbAll(
      `SELECT t.*, u.username, u.tg_username, u.tg_first_name
       FROM tickets t LEFT JOIN users u ON t.user_id = u.id
       ORDER BY CASE WHEN t.status = 'open' THEN 0 WHEN t.status = 'replied' THEN 1 ELSE 2 END, t.created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

// Admin: Reply to ticket
app.post("/admin/reply-ticket", async (req, res) => {
  try { adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { ticketId, reply } = req.body;
  if (!ticketId || !reply) return res.status(400).json({ error: "缺少必要參數" });
  try {
    await dbRun(
      "UPDATE tickets SET admin_reply = ?, status = 'replied', replied_at = CURRENT_TIMESTAMP WHERE id = ?",
      [reply, ticketId]
    );
    // Notify user via TG
    const ticket = await dbGet("SELECT t.*, u.tg_id, u.tg_first_name, u.username FROM tickets t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = ?", [ticketId]);
    if (ticket && ticket.tg_id) {
      sendTGToUser(ticket.tg_id, `📩 <b>工單回覆通知</b>\n\n工單 #${ticketId}：${ticket.subject}\n\n回覆：${reply}\n\n如有其他問題，歡迎繼續提交工單。`);
    }
    res.json({ ok: true, message: "回覆成功" });
  } catch (e) {
    res.status(500).json({ error: "回覆失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// BLACKJACK GAME ENGINE
// ══════════════════════════════════════════════════════════════════════════════

const BJ_SUITS = ["spades", "hearts", "diamonds", "clubs"];
const BJ_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const BJ_NUM_DECKS = 6;
const BJ_BET_OPTIONS = [5, 10, 25, 50, 100];

function bjCreateShoe() {
  const shoe = [];
  for (let d = 0; d < BJ_NUM_DECKS; d++) {
    for (const suit of BJ_SUITS) {
      for (const rank of BJ_RANKS) {
        shoe.push({ suit, rank });
      }
    }
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

function bjCardValue(card) {
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

function bjHandValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { total += bjCardValue(c); if (c.rank === "A") aces++; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function bjIsSoft(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { total += bjCardValue(c); if (c.rank === "A") aces++; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return aces > 0 && total <= 21;
}

function bjIsBlackjack(cards) {
  return cards.length === 2 && bjHandValue(cards) === 21;
}

function bjCanSplit(hand) {
  if (hand.cards.length !== 2) return false;
  return bjCardValue(hand.cards[0]) === bjCardValue(hand.cards[1]);
}

function bjDrawCard(session) {
  if (session.shoe.length < 20) session.shoe = bjCreateShoe();
  return session.shoe.pop();
}

function bjVisibleCard(card) { return { suit: card.suit, rank: card.rank }; }
function bjHiddenCard() { return { suit: "hidden", rank: "hidden" }; }

function bjBuildState(session, reveal = false) {
  const state = {
    status: session.status,
    bet_amount: session.betAmount,
    dealer_cards: [],
    dealer_value: 0,
    hands: [],
    active_hand: session.activeHand,
    insurance_bet: session.insuranceBet || 0,
    insurance_result: session.insuranceResult || null,
    result: session.result || null,
    total_win: session.totalWin || 0,
    new_balance: session.newBalance || null,
    can_insurance: false,
  };
  if (session.status === "settled" || reveal) {
    state.dealer_cards = session.dealerCards.map(bjVisibleCard);
    state.dealer_value = bjHandValue(session.dealerCards);
  } else {
    state.dealer_cards = session.dealerCards.map((c, i) => i === 0 ? bjVisibleCard(c) : bjHiddenCard());
    state.dealer_value = bjCardValue(session.dealerCards[0]);
  }
  for (let i = 0; i < session.hands.length; i++) {
    const h = session.hands[i];
    const hv = bjHandValue(h.cards);
    state.hands.push({
      cards: h.cards.map(bjVisibleCard),
      value: hv,
      bet: h.bet,
      status: h.status,
      is_blackjack: bjIsBlackjack(h.cards),
      is_busted: hv > 21,
      can_hit: h.status === "playing" && hv < 21,
      can_stand: h.status === "playing",
      can_double: h.status === "playing" && h.cards.length === 2 && !h.fromSplit,
      can_split: h.status === "playing" && bjCanSplit(h) && session.hands.length < 4,
      can_surrender: h.status === "playing" && h.cards.length === 2 && session.hands.length === 1 && !h.fromSplit,
      result: h.result || null,
      win_amount: h.winAmount || 0,
    });
  }
  state.can_insurance = session.status === "playing" &&
    session.dealerCards[0].rank === "A" &&
    session.hands.length === 1 &&
    session.hands[0].cards.length === 2 &&
    !session.insuranceBet && !session.insuranceDeclined;
  return state;
}

async function bjSaveSession(userId, session) {
  const data = JSON.stringify(session);
  await dbRun(
    `INSERT INTO blackjack_sessions (user_id, session_data, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET session_data = ?, updated_at = datetime('now')`,
    [userId, data, data]
  );
}

async function bjLoadSession(userId) {
  const row = await dbGet("SELECT session_data FROM blackjack_sessions WHERE user_id = ?", [userId]);
  if (!row) return null;
  try { return JSON.parse(row.session_data); } catch { return null; }
}

async function bjClearSession(userId) {
  await dbRun("DELETE FROM blackjack_sessions WHERE user_id = ?", [userId]);
}

function bjDealerPlay(session) {
  while (true) {
    const dv = bjHandValue(session.dealerCards);
    const soft = bjIsSoft(session.dealerCards);
    if (dv < 17 || (dv === 17 && soft)) {
      session.dealerCards.push(bjDrawCard(session));
    } else break;
  }
}

function bjAdvanceHand(session) {
  for (let i = session.activeHand + 1; i < session.hands.length; i++) {
    if (session.hands[i].status === "playing") {
      session.activeHand = i;
      return true;
    }
  }
  return false;
}

async function bjSettleGame(session, userId) {
  const dealerValue = bjHandValue(session.dealerCards);
  const dealerBJ = bjIsBlackjack(session.dealerCards);
  let totalWin = 0;
  const results = [];

  for (const hand of session.hands) {
    if (hand.status === "surrendered") {
      hand.result = "surrender";
      hand.winAmount = hand.bet / 2;
      totalWin += hand.winAmount;
      results.push("surrender");
      continue;
    }
    const pv = bjHandValue(hand.cards);
    const pBJ = bjIsBlackjack(hand.cards);
    if (pv > 21) {
      hand.result = "bust"; hand.winAmount = 0; results.push("bust");
    } else if (pBJ && dealerBJ) {
      hand.result = "push"; hand.winAmount = hand.bet; totalWin += hand.bet; results.push("push");
    } else if (pBJ) {
      hand.result = "blackjack"; hand.winAmount = hand.bet + hand.bet * 1.5; totalWin += hand.winAmount; results.push("blackjack");
    } else if (dealerBJ) {
      hand.result = "lose"; hand.winAmount = 0; results.push("lose");
    } else if (dealerValue > 21) {
      hand.result = "win"; hand.winAmount = hand.bet * 2; totalWin += hand.winAmount; results.push("win");
    } else if (pv > dealerValue) {
      hand.result = "win"; hand.winAmount = hand.bet * 2; totalWin += hand.winAmount; results.push("win");
    } else if (pv === dealerValue) {
      hand.result = "push"; hand.winAmount = hand.bet; totalWin += hand.bet; results.push("push");
    } else {
      hand.result = "lose"; hand.winAmount = 0; results.push("lose");
    }
  }

  if (session.insuranceBet > 0) {
    if (dealerBJ) { session.insuranceResult = "win"; totalWin += session.insuranceBet * 3; }
    else { session.insuranceResult = "lose"; }
  }

  session.totalWin = totalWin;
  session.status = "settled";

  const extraBets = session.extraBetsDeducted || 0;
  const totalDeducted = session.betAmount + (session.insuranceBet || 0) + extraBets;

  const user = await dbGet("SELECT * FROM users WHERE id = ?", [userId]);
  if (user) {
    const newBalance = user.balance + totalWin;
    session.newBalance = newBalance;
    await dbRun("UPDATE users SET balance = ? WHERE id = ?", [newBalance, userId]);
    await dbRun("UPDATE users SET total_bet = total_bet + ? WHERE id = ?", [totalDeducted, userId]);
    const updatedUser = await dbGet("SELECT * FROM users WHERE id = ?", [userId]);
    const newVip = getVipLevel(updatedUser.total_bet || 0);
    if (newVip !== (updatedUser.vip_level || 0)) {
      await dbRun("UPDATE users SET vip_level = ? WHERE id = ?", [newVip, userId]);
    }
    if (updatedUser.wager_requirement > 0) {
      const newWager = Math.max(0, updatedUser.wager_requirement - totalDeducted);
      await dbRun("UPDATE users SET wager_requirement = ? WHERE id = ?", [newWager, userId]);
    }
  }

  let overallResult = "lose";
  if (results.includes("blackjack")) overallResult = "blackjack";
  else if (results.includes("win")) overallResult = "win";
  else if (results.every(r => r === "push")) overallResult = "push";
  else if (results.includes("surrender")) overallResult = "surrender";
  session.result = overallResult;

  const details = JSON.stringify({
    dealer_cards: session.dealerCards,
    hands: session.hands.map(h => ({ cards: h.cards, bet: h.bet, result: h.result, winAmount: h.winAmount })),
    insurance: { bet: session.insuranceBet, result: session.insuranceResult },
  });
  await dbRun(
    "INSERT INTO game_records (user_id, game_type, bet_amount, result, win_amount, details) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, "blackjack", totalDeducted, overallResult, totalWin, details]
  );
  const netWin = totalWin - totalDeducted;
  if (netWin !== 0) {
    await dbRun(
      "INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, ?, ?, ?, ?)",
      [userId, netWin > 0 ? "add" : "deduct", Math.abs(netWin), `21點 ${overallResult} (下注${totalDeducted})`, "game"]
    );
  }
  await dbRun(
    "INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, ?, ?, ?, ?)",
    [userId, "bet", totalDeducted, "21點下注", "game"]
  );
  await bjClearSession(userId);
  return session;
}

// ── POST /game/blackjack/start ──
app.post("/game/blackjack/start", async (req, res) => {
  try {
    const u = auth(req);
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });
    if (user.risk_flag) return res.status(403).json({ error: "帳戶異常" });
    const { bet_amount } = req.body;
    if (!BJ_BET_OPTIONS.includes(bet_amount)) {
      return res.status(400).json({ error: `下注金額必須是 ${BJ_BET_OPTIONS.join("/")} USDT` });
    }
    if (user.balance < bet_amount) return res.status(400).json({ error: "餘額不足" });
    const existing = await bjLoadSession(u.id);
    if (existing && existing.status !== "settled") {
      return res.status(400).json({ error: "您有未完成的牌局", state: bjBuildState(existing) });
    }
    await dbRun("UPDATE users SET balance = balance - ? WHERE id = ?", [bet_amount, u.id]);
    const session = {
      shoe: bjCreateShoe(),
      dealerCards: [],
      hands: [{ cards: [], bet: bet_amount, status: "playing", fromSplit: false }],
      activeHand: 0,
      betAmount: bet_amount,
      insuranceBet: 0,
      insuranceDeclined: false,
      insuranceResult: null,
      extraBetsDeducted: 0,
      status: "playing",
      result: null,
      totalWin: 0,
      newBalance: null,
    };
    session.hands[0].cards.push(bjDrawCard(session));
    session.dealerCards.push(bjDrawCard(session));
    session.hands[0].cards.push(bjDrawCard(session));
    session.dealerCards.push(bjDrawCard(session));
    if (bjIsBlackjack(session.hands[0].cards)) {
      session.hands[0].status = "blackjack";
      bjDealerPlay(session);
      await bjSettleGame(session, u.id);
      return res.json({ ok: true, state: bjBuildState(session, true) });
    }
    const dealerUpCard = session.dealerCards[0];
    if (bjCardValue(dealerUpCard) === 10 && bjIsBlackjack(session.dealerCards)) {
      session.hands[0].status = "stand";
      await bjSettleGame(session, u.id);
      return res.json({ ok: true, state: bjBuildState(session, true) });
    }
    await bjSaveSession(u.id, session);
    res.json({ ok: true, state: bjBuildState(session) });
  } catch (e) {
    console.error("Blackjack start error:", e);
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") return res.status(401).json({ error: "未授權" });
    res.status(500).json({ error: "系統錯誤" });
  }
});

// ── POST /game/blackjack/action ──
app.post("/game/blackjack/action", async (req, res) => {
  try {
    const u = auth(req);
    const session = await bjLoadSession(u.id);
    if (!session || session.status === "settled") return res.status(400).json({ error: "沒有進行中的牌局" });
    const { action } = req.body;
    const hand = session.hands[session.activeHand];
    if (!hand || hand.status !== "playing") return res.status(400).json({ error: "當前手牌無法操作" });
    const user = await dbGet("SELECT * FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });

    switch (action) {
      case "insurance": {
        if (!bjBuildState(session).can_insurance) return res.status(400).json({ error: "無法購買保險" });
        const insBet = session.betAmount / 2;
        if (user.balance < insBet) return res.status(400).json({ error: "餘額不足購買保險" });
        await dbRun("UPDATE users SET balance = balance - ? WHERE id = ?", [insBet, u.id]);
        session.insuranceBet = insBet;
        session.extraBetsDeducted = (session.extraBetsDeducted || 0) + insBet;
        if (bjIsBlackjack(session.dealerCards)) {
          hand.status = "stand";
          await bjSettleGame(session, u.id);
          return res.json({ ok: true, state: bjBuildState(session, true) });
        }
        await bjSaveSession(u.id, session);
        return res.json({ ok: true, state: bjBuildState(session) });
      }
      case "decline_insurance": {
        session.insuranceDeclined = true;
        if (bjIsBlackjack(session.dealerCards)) {
          hand.status = "stand";
          await bjSettleGame(session, u.id);
          return res.json({ ok: true, state: bjBuildState(session, true) });
        }
        await bjSaveSession(u.id, session);
        return res.json({ ok: true, state: bjBuildState(session) });
      }
      case "hit": {
        hand.cards.push(bjDrawCard(session));
        const hv = bjHandValue(hand.cards);
        if (hv > 21) {
          hand.status = "busted";
          if (!bjAdvanceHand(session)) { bjDealerPlay(session); await bjSettleGame(session, u.id); return res.json({ ok: true, state: bjBuildState(session, true) }); }
        } else if (hv === 21) {
          hand.status = "stand";
          if (!bjAdvanceHand(session)) { bjDealerPlay(session); await bjSettleGame(session, u.id); return res.json({ ok: true, state: bjBuildState(session, true) }); }
        }
        await bjSaveSession(u.id, session);
        return res.json({ ok: true, state: bjBuildState(session) });
      }
      case "stand": {
        hand.status = "stand";
        if (!bjAdvanceHand(session)) { bjDealerPlay(session); await bjSettleGame(session, u.id); return res.json({ ok: true, state: bjBuildState(session, true) }); }
        await bjSaveSession(u.id, session);
        return res.json({ ok: true, state: bjBuildState(session) });
      }
      case "double": {
        if (hand.cards.length !== 2 || hand.fromSplit) return res.status(400).json({ error: "無法加倍" });
        if (user.balance < hand.bet) return res.status(400).json({ error: "餘額不足加倍" });
        await dbRun("UPDATE users SET balance = balance - ? WHERE id = ?", [hand.bet, u.id]);
        session.extraBetsDeducted = (session.extraBetsDeducted || 0) + hand.bet;
        hand.bet *= 2;
        hand.cards.push(bjDrawCard(session));
        hand.status = bjHandValue(hand.cards) > 21 ? "busted" : "doubled";
        if (!bjAdvanceHand(session)) { bjDealerPlay(session); await bjSettleGame(session, u.id); return res.json({ ok: true, state: bjBuildState(session, true) }); }
        await bjSaveSession(u.id, session);
        return res.json({ ok: true, state: bjBuildState(session) });
      }
      case "split": {
        if (!bjCanSplit(hand) || session.hands.length >= 4) return res.status(400).json({ error: "無法分牌" });
        if (user.balance < session.betAmount) return res.status(400).json({ error: "餘額不足分牌" });
        await dbRun("UPDATE users SET balance = balance - ? WHERE id = ?", [session.betAmount, u.id]);
        session.extraBetsDeducted = (session.extraBetsDeducted || 0) + session.betAmount;
        const card2 = hand.cards.pop();
        hand.fromSplit = true;
        hand.cards.push(bjDrawCard(session));
        const newHand = { cards: [card2, bjDrawCard(session)], bet: session.betAmount, status: "playing", fromSplit: true };
        session.hands.splice(session.activeHand + 1, 0, newHand);
        if (bjHandValue(hand.cards) === 21) {
          hand.status = "stand";
          if (!bjAdvanceHand(session)) { bjDealerPlay(session); await bjSettleGame(session, u.id); return res.json({ ok: true, state: bjBuildState(session, true) }); }
        }
        await bjSaveSession(u.id, session);
        return res.json({ ok: true, state: bjBuildState(session) });
      }
      case "surrender": {
        if (hand.cards.length !== 2 || session.hands.length !== 1 || hand.fromSplit) return res.status(400).json({ error: "無法投降" });
        hand.status = "surrendered";
        hand.bet = hand.bet / 2;
        bjDealerPlay(session);
        await bjSettleGame(session, u.id);
        return res.json({ ok: true, state: bjBuildState(session, true) });
      }
      default:
        return res.status(400).json({ error: "未知操作" });
    }
  } catch (e) {
    console.error("Blackjack action error:", e);
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") return res.status(401).json({ error: "未授權" });
    res.status(500).json({ error: "系統錯誤" });
  }
});

// ── GET /game/blackjack/state ──
app.get("/game/blackjack/state", async (req, res) => {
  try {
    const u = auth(req);
    const session = await bjLoadSession(u.id);
    if (!session || session.status === "settled") return res.json({ active: false });
    res.json({ active: true, state: bjBuildState(session) });
  } catch (e) {
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") return res.status(401).json({ error: "未授權" });
    res.status(500).json({ error: "系統錯誤" });
  }
});

// ── GET /game/blackjack/history ──
app.get("/game/blackjack/history", async (req, res) => {
  try {
    const u = auth(req);
    const rows = await dbAll(
      "SELECT id, bet_amount, result, win_amount, created_at FROM game_records WHERE user_id = ? AND game_type = 'blackjack' ORDER BY created_at DESC LIMIT 20",
      [u.id]
    );
    res.json(rows);
  } catch (e) {
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") return res.status(401).json({ error: "未授權" });
    res.status(500).json({ error: "系統錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUSH OPT-OUT: /stop
// ══════════════════════════════════════════════════════════════════════════════

app.post("/stop", async (req, res) => {
  try {
    const u = auth(req);
    await dbRun("UPDATE users SET opt_out = 1 WHERE id = ?", [u.id]);
    res.json({ ok: true, message: "已關閉推送通知，您將不再收到自動訊息。" });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

app.post("/start-push", async (req, res) => {
  try {
    const u = auth(req);
    await dbRun("UPDATE users SET opt_out = 0 WHERE id = ?", [u.id]);
    res.json({ ok: true, message: "已重新開啟推送通知。" });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: MESSAGE TEMPLATES CRUD
// ══════════════════════════════════════════════════════════════════════════════

app.get("/admin/templates", adminLimiter, checkRole(["super_admin"]), async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM message_templates ORDER BY trigger, lang");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "查詢失敗" });
  }
});

app.post("/admin/templates", adminLimiter, checkRole(["super_admin"]), async (req, res) => {
  const { trigger, content, lang } = req.body;
  if (!trigger || !content) return res.status(400).json({ error: "缺少 trigger 或 content" });
  try {
    await dbRun(
      `INSERT INTO message_templates (trigger, content, lang) VALUES (?, ?, ?)
       ON CONFLICT(trigger, lang) DO UPDATE SET content = ?`,
      [trigger, content, lang || "zh", content]
    );
    logAdminAction(req.admin.id, "save_template", "template", { trigger, lang }, req);
    res.json({ ok: true, message: "模板已儲存" });
  } catch (e) {
    res.status(500).json({ error: "儲存失敗" });
  }
});

app.delete("/admin/templates/:id", adminLimiter, checkRole(["super_admin"]), async (req, res) => {
  try {
    await dbRun("DELETE FROM message_templates WHERE id = ?", [req.params.id]);
    logAdminAction(req.admin.id, "delete_template", "template", { id: req.params.id }, req);
    res.json({ ok: true, message: "模板已刪除" });
  } catch (e) {
    res.status(500).json({ error: "刪除失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTION HISTORY
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/transactions — Returns combined deposits + withdrawals sorted by newest first
app.get("/api/transactions", async (req, res) => {
  try {
    const u = auth(req);
    const deposits = await dbAll(
      "SELECT id, amount, status, created_at, 'deposit' as type FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
      [u.id]
    );
    const withdrawals = await dbAll(
      "SELECT id, amount, status, created_at, 'withdrawal' as type FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
      [u.id]
    );
    // Merge and sort by created_at descending
    const all = [...deposits, ...withdrawals].sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    res.json(all);
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECURITY CENTER — NICKNAME & AVATAR
// ══════════════════════════════════════════════════════════════════════════════

// Ensure nickname, avatar, and backup-login columns exist (safe ALTER TABLE pattern)
db.serialize(() => {
  const securityCols = [
    "nickname TEXT DEFAULT ''",
    "nickname_changed INTEGER DEFAULT 0",
    "avatar TEXT DEFAULT ''",
    "backup_username TEXT DEFAULT ''",
    "backup_password TEXT DEFAULT ''",
  ];
  securityCols.forEach(col => {
    db.run(`ALTER TABLE users ADD COLUMN ${col}`, () => {});
  });
});

// GET /api/user/profile — Returns current nickname, avatar, and backup-login status
app.get("/api/user/profile", async (req, res) => {
  try {
    const u = auth(req);
    const user = await dbGet("SELECT id, tg_first_name, tg_username, username, nickname, nickname_changed, avatar, backup_username FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });
    res.json({
      id: user.id,
      display_name: user.nickname || user.tg_first_name || user.tg_username || user.username || "",
      nickname: user.nickname || "",
      nickname_changed: user.nickname_changed || 0,
      avatar: user.avatar || "",
      backup_username: user.backup_username || "",
      has_backup_login: !!(user.backup_username && user.backup_username.trim()),
    });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// PUT /api/user/nickname — Change nickname (only once)
app.put("/api/user/nickname", async (req, res) => {
  try {
    const u = auth(req);
    const user = await dbGet("SELECT id, nickname_changed FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });
    if (user.nickname_changed) return res.status(400).json({ error: "暱稱只能修改一次，已無法再次更改" });

    const { nickname } = req.body;
    if (!nickname || !nickname.trim()) return res.status(400).json({ error: "暱稱不能為空" });
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 20) return res.status(400).json({ error: "暱稱長度需在 2~20 個字元之間" });

    await dbRun("UPDATE users SET nickname = ?, nickname_changed = 1 WHERE id = ?", [trimmed, u.id]);
    res.json({ ok: true, nickname: trimmed, message: "暱稱已更新" });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// PUT /api/user/backup-login — Set or update backup username + password
app.put("/api/user/backup-login", async (req, res) => {
  try {
    const u = auth(req);
    const { backup_username, backup_password } = req.body;

    if (!backup_username || !backup_username.trim()) {
      return res.status(400).json({ error: "請輸入備用帳號" });
    }
    if (!backup_password || backup_password.length < 6) {
      return res.status(400).json({ error: "密碼至少需要 6 個字元" });
    }
    const trimmedUsername = backup_username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      return res.status(400).json({ error: "帳號長度需在 3~30 個字元之間" });
    }

    // Check if backup_username is already taken by another user
    const existing = await dbGet(
      "SELECT id FROM users WHERE backup_username = ? AND id != ?",
      [trimmedUsername, u.id]
    );
    if (existing) {
      return res.status(400).json({ error: "此備用帳號已被使用，請換一個" });
    }

    const hashedPassword = await bcrypt.hash(backup_password, 10);
    await dbRun(
      "UPDATE users SET backup_username = ?, backup_password = ? WHERE id = ?",
      [trimmedUsername, hashedPassword, u.id]
    );
    res.json({ ok: true, backup_username: trimmedUsername, message: "備用帳號密碼已設定" });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// PUT /api/user/avatar — Upload/change avatar (base64)
app.put("/api/user/avatar", async (req, res) => {
  try {
    const u = auth(req);
    const { avatar } = req.body;
    if (!avatar) return res.status(400).json({ error: "請提供頭像圖片" });
    // Validate it's a base64 data URL (image)
    if (!avatar.startsWith("data:image/")) return res.status(400).json({ error: "格式錯誤，請上傳圖片" });
    // Limit size: base64 of ~500KB image ≈ ~700KB string
    if (avatar.length > 800000) return res.status(400).json({ error: "圖片過大，請選擇小於 500KB 的圖片" });

    await dbRun("UPDATE users SET avatar = ? WHERE id = ?", [avatar, u.id]);
    res.json({ ok: true, message: "頭像已更新" });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════════════════════════════

// ── Register Agent/Partner routes (additive — no existing routes modified) ──
app.use(agentRoutes);
app.use(adminAgentRoutes);
app.use("/api/withdrawal", withdrawalRoutes);

app.get("/", (req, res) => res.json({
  status: "ok", service: "la1-backend", version: "5.4.1-withdrawal",
  endpoints: [
    "/tg-login", "/login", "/register", "/me",
    "/withdraw", "/withdraw/history",
    "/promo/first-deposit", "/promo/checkin", "/promo/checkin-status",
    "/promo/vip-info", "/promo/referral-info", "/promo/tasks", "/promo/claim-task",
    "/promo/weekend-status", "/promo/summary", "/promo/rebate-history",
    "/announcements", "/ticket", "/my-tickets",
    "/stop", "/start-push",
    "/admin/login", "/admin/users", "/admin/adjust-balance", "/admin/flag-user",
    "/admin/ban-user", "/admin/withdrawals", "/admin/review-withdrawal",
    "/admin/calculate-rebate",
    "/admin/announcement", "/admin/tickets", "/admin/reply-ticket",
    "/admin/templates",
    // New endpoints
    "/api/transactions",
    "/api/user/profile",
    "/api/user/nickname",
    "/api/user/avatar",
    "/api/user/backup-login",
    // Agent/Partner system (default OFF via feature flag)
    "/agent/dashboard", "/agent/referrals", "/agent/commissions",
    "/admin/agents", "/admin/agents/toggle", "/admin/agents/settlements",
    "/admin/agents/relations",
  ]
}));

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: Manual Referral Commission Dispatch
// ══════════════════════════════════════════════════════════════════════════════

// Admin: Manually trigger referral commission dispatch (for testing or catch-up)
app.post("/admin/run-referral-commission", adminLimiter, checkRole(["super_admin"]), async (req, res) => {
  try {
    const result = await runReferralCommissionJob();
    await logAdminAction(req.admin.id, "run_referral_commission", "system", result, req);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error("Manual referral commission error:", e);
    res.status(500).json({ error: "分潤派發失敗" });
  }
});

// Admin: View referral commission records
app.get("/admin/referral-commissions", adminLimiter, checkRole(["super_admin", "operator"]), async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT rc.*,
             r.username as referrer_username, r.tg_username as referrer_tg,
             u.username as referred_username, u.tg_username as referred_tg
      FROM referral_commissions rc
      LEFT JOIN users r ON rc.referrer_id = r.id
      LEFT JOIN users u ON rc.referred_id = u.id
      ORDER BY rc.created_at DESC LIMIT 500
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "查詢失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: Database Backup API
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /admin/backup-db
 * 手動觸發資料庫備份，導出所有重要表格為 JSON 格式
 * 僅限 super_admin 使用
 */
app.post("/admin/backup-db", adminLimiter, checkRole(["super_admin"]), async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = {
      backup_time: new Date().toISOString(),
      backup_by: req.admin.username,
      tables: {}
    };

    // 備份 users 表
    backup.tables.users = await dbAll("SELECT * FROM users ORDER BY id ASC");

    // 備份 admins 表
    try {
      backup.tables.admins = await dbAll("SELECT id, username, role, created_at FROM admins ORDER BY id ASC");
    } catch (e) { backup.tables.admins = []; }

    // 備份 deposits 表
    try {
      backup.tables.deposits = await dbAll("SELECT * FROM deposits ORDER BY id ASC");
    } catch (e) { backup.tables.deposits = []; }

    // 備份 withdrawals 表
    try {
      backup.tables.withdrawals = await dbAll("SELECT * FROM withdrawals ORDER BY id ASC");
    } catch (e) { backup.tables.withdrawals = []; }

    // 備份 checkins 表
    try {
      backup.tables.checkins = await dbAll("SELECT * FROM checkins ORDER BY id ASC");
    } catch (e) { backup.tables.checkins = []; }

    // 備份 balance_logs 表
    try {
      backup.tables.balance_logs = await dbAll("SELECT * FROM balance_logs ORDER BY id ASC LIMIT 10000");
    } catch (e) { backup.tables.balance_logs = []; }

    // 備份 referral_logs 表
    try {
      backup.tables.referral_logs = await dbAll("SELECT * FROM referral_logs ORDER BY id ASC");
    } catch (e) { backup.tables.referral_logs = []; }

    // 備份 rebate_logs 表
    try {
      backup.tables.rebate_logs = await dbAll("SELECT * FROM rebate_logs ORDER BY id ASC");
    } catch (e) { backup.tables.rebate_logs = []; }

    // 備份 announcements 表
    try {
      backup.tables.announcements = await dbAll("SELECT * FROM announcements ORDER BY id ASC");
    } catch (e) { backup.tables.announcements = []; }

    // 備份 tickets 表
    try {
      backup.tables.tickets = await dbAll("SELECT * FROM tickets ORDER BY id ASC");
    } catch (e) { backup.tables.tickets = []; }

    // 備份 agents 表
    try {
      backup.tables.agents = await dbAll("SELECT * FROM agents ORDER BY id ASC");
    } catch (e) { backup.tables.agents = []; }

    // 備份 agent_relations 表
    try {
      backup.tables.agent_relations = await dbAll("SELECT * FROM agent_relations ORDER BY id ASC");
    } catch (e) { backup.tables.agent_relations = []; }

    // 備份 agent_commissions 表
    try {
      backup.tables.agent_commissions = await dbAll("SELECT * FROM agent_commissions ORDER BY id ASC LIMIT 5000");
    } catch (e) { backup.tables.agent_commissions = []; }

    // 備份 agent_daily_stats 表
    try {
      backup.tables.agent_daily_stats = await dbAll("SELECT * FROM agent_daily_stats ORDER BY id ASC LIMIT 1000");
    } catch (e) { backup.tables.agent_daily_stats = []; }

    // 備份 referral_commissions 表
    try {
      backup.tables.referral_commissions = await dbAll("SELECT * FROM referral_commissions ORDER BY id ASC LIMIT 5000");
    } catch (e) { backup.tables.referral_commissions = []; }

    // 備份 admin_logs 表（最近 500 筆）
    try {
      backup.tables.admin_logs = await dbAll("SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 500");
    } catch (e) { backup.tables.admin_logs = []; }

    // 備份 message_templates 表
    try {
      backup.tables.message_templates = await dbAll("SELECT * FROM message_templates ORDER BY id ASC");
    } catch (e) { backup.tables.message_templates = []; }

    // 備份 task_claims 表
    try {
      backup.tables.task_claims = await dbAll("SELECT * FROM task_claims ORDER BY id ASC LIMIT 5000");
    } catch (e) { backup.tables.task_claims = []; }

    // 備份 first_deposit_logs 表
    try {
      backup.tables.first_deposit_logs = await dbAll("SELECT * FROM first_deposit_logs ORDER BY id ASC");
    } catch (e) { backup.tables.first_deposit_logs = []; }

    // 備份 blacklist 表
    try {
      backup.tables.blacklist = await dbAll("SELECT * FROM blacklist ORDER BY id ASC");
    } catch (e) { backup.tables.blacklist = []; }

    // 統計資訊
    backup.summary = {
      total_users: backup.tables.users.length,
      total_admins: backup.tables.admins.length,
      total_deposits: backup.tables.deposits.length,
      total_withdrawals: backup.tables.withdrawals.length,
      total_checkins: backup.tables.checkins.length,
      total_balance_logs: backup.tables.balance_logs.length,
      total_referral_logs: backup.tables.referral_logs.length,
      total_agents: backup.tables.agents.length,
      total_agent_commissions: backup.tables.agent_commissions.length,
      total_referral_commissions: backup.tables.referral_commissions.length,
      total_tickets: backup.tables.tickets.length,
      total_announcements: backup.tables.announcements.length,
      total_message_templates: backup.tables.message_templates.length,
    };

    await logAdminAction(req.admin.id, "backup_db", "database", { timestamp, summary: backup.summary }, req);

    // 設定下載標頭，讓瀏覽器直接下載 JSON 檔案
    res.setHeader("Content-Disposition", `attachment; filename=\"db_backup_${timestamp}.json\"`);
    res.setHeader("Content-Type", "application/json");
    res.json(backup);
  } catch (e) {
    console.error("Backup DB error:", e);
    res.status(500).json({ error: "備份失敗", detail: e.message });
  }
});

/**
 * GET /admin/backup-db/users
 * 快速導出 users 表為 JSON（僅用戶資料）
 */
app.get("/admin/backup-db/users", adminLimiter, checkRole(["super_admin", "operator"]), async (req, res) => {
  try {
    const users = await dbAll("SELECT * FROM users ORDER BY id ASC");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Disposition", `attachment; filename=\"users_backup_${timestamp}.json\"`);
    res.setHeader("Content-Type", "application/json");
    res.json({
      export_time: new Date().toISOString(),
      exported_by: req.admin.username,
      total: users.length,
      users
    });
  } catch (e) {
    res.status(500).json({ error: "導出失敗", detail: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// USER BALANCE LOGS — for frontend transaction history page
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/user/balance-logs
 * Returns the authenticated user's balance_logs (all types) sorted newest first.
 * Used by the frontend transaction history page to show full balance history.
 */
app.get("/api/user/balance-logs", async (req, res) => {
  try {
    const u = auth(req);
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;
    const rows = await dbAll(
      `SELECT id, type, amount, reason, operator, created_at
       FROM balance_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [u.id, limit, offset]
    );
    res.json({ ok: true, data: rows, total: rows.length });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

/**
 * GET /admin/users/:id/balance-logs
 * Returns a specific user's balance_logs for admin review.
 * Accessible by super_admin and operator roles.
 */
app.get("/admin/users/:id/balance-logs", adminLimiter, checkRole(["super_admin", "operator"]), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!userId) return res.status(400).json({ error: "無效的用戶 ID" });

    const user = await dbGet("SELECT id, username, tg_username, tg_first_name, balance, total_deposit FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });

    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const offset = parseInt(req.query.offset) || 0;

    const logs = await dbAll(
      `SELECT id, type, amount, reason, operator, created_at
       FROM balance_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const summary = await dbGet(
      `SELECT
         COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_in,
         COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_out,
         COUNT(*) as total_records
       FROM balance_logs WHERE user_id = ?`,
      [userId]
    );

    res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        tg_username: user.tg_username,
        display_name: user.tg_first_name || user.tg_username || user.username,
        balance: user.balance,
        total_deposit: user.total_deposit
      },
      summary,
      data: logs
    });
  } catch (e) {
    console.error("[admin/users/:id/balance-logs] error:", e.message);
    res.status(500).json({ error: "查詢失敗" });
  }
});

/**
 * GET /admin/db-tables
 * 列出資料庫中所有資料表及其紀錄數，用於驗證所有表格都已正確建立
 * 僅限 super_admin 使用
 */
// ── DEPOSIT REQUESTS ────────────────────────────────────────────────────────

// Create a deposit request (called by TG Bot or Frontend)
app.post("/api/deposit-request", async (req, res) => {
  let u;
  try { u = auth(req); } catch (e) { return res.status(401).json({ error: "未授權，請先登入" }); }

  const { amount, tx_id, screenshot_url } = req.body;
  const numAmount = parseFloat(amount);
  if (!numAmount || numAmount <= 0) return res.status(400).json({ error: "請輸入有效金額" });
  if (numAmount < 30) return res.status(400).json({ error: "最低儲值金額為 30 USDT" });

  try {
    // Check if user exists
    const user = await dbGet("SELECT id, username, tg_id FROM users WHERE id = ?", [u.id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });

    // Create deposit request
    const result = await dbRun(
      "INSERT INTO deposits (user_id, amount, tx_id, screenshot_url, status) VALUES (?, ?, ?, ?, 'pending')",
      [u.id, numAmount, tx_id || null, screenshot_url || null]
    );

    // ── Deposit Risk Detection ──
    try {
      // 1. 大額存款預警 (單筆超過 5000U)
      if (numAmount >= 5000) {
        await dbRun("INSERT INTO risk_alerts (user_id, type, level, detail) VALUES (?, '大額存款', '中', ?)",
          [u.id, `單筆存款金額 ${numAmount} USDT`]);
      }
      // 2. 存款來源追蹤 (記錄 IP)
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      await dbRun("INSERT INTO audit_logs (admin_id, action, target_type, target_id, details, ip) VALUES (0, 'deposit_request', 'user', ?, ?, ?)",
        [u.id, `申請儲值 ${numAmount} USDT`, ip]);
    } catch (riskErr) {
      console.error("[Deposit Risk] error:", riskErr.message);
    }
    console.log(`[deposit-request] user ${u.id} created deposit #${result.lastID} amount=${numAmount}`);
    res.json({ ok: true, id: result.lastID, amount: numAmount });
  } catch (e) {
    console.error("[deposit-request] error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// List deposit requests for admin
app.get("/admin/deposit-requests", adminLimiter, async (req, res) => {
  let adminPayload;
  try { adminPayload = adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { status = 'pending' } = req.query;
  try {
    const rows = await dbAll(`
      SELECT d.*, u.username, u.tg_id, u.tg_username, u.tg_first_name, u.balance as user_balance
      FROM deposits d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.status = ?
      ORDER BY d.created_at DESC
      LIMIT 200
    `, [status]);
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("[deposit-requests GET] error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Approve deposit request - full chain: VIP upgrade + first deposit bonus + referral commission
app.post("/admin/deposit-requests/:id/approve", adminLimiter, async (req, res) => {
  let adminPayload;
  try { adminPayload = adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { id } = req.params;
  const adminUsername = adminPayload.username || String(adminPayload.id);

  function calcVipLevel(totalDeposit) {
    if (totalDeposit >= 100000) return 5;
    if (totalDeposit >= 50000)  return 4;
    if (totalDeposit >= 20000)  return 3;
    if (totalDeposit >= 5000)   return 2;
    if (totalDeposit >= 1000)   return 1;
    return 0;
  }

  try {
    const deposit = await dbGet("SELECT * FROM deposits WHERE id = ? AND status = 'pending'", [id]);
    if (!deposit) return res.status(404).json({ error: "儲值申請不存在或已處理" });

    const user = await dbGet("SELECT * FROM users WHERE id = ?", [deposit.user_id]);
    if (!user) return res.status(404).json({ error: "用戶不存在" });

    const numAmount = parseFloat(deposit.amount);
    const operatorStr = `admin:${adminUsername}`;

    // Step 1: Update balance + total_deposit + VIP
    const newTotalDeposit = (user.total_deposit || 0) + numAmount;
    const oldVipLevel = user.vip_level || 0;
    const newVipLevel = calcVipLevel(newTotalDeposit);
    const vipUpgraded = newVipLevel > oldVipLevel;
    const newBalance = (user.balance || 0) + numAmount;

    await dbRun(
      "UPDATE users SET balance = ?, total_deposit = ?, vip_level = ? WHERE id = ?",
      [newBalance, newTotalDeposit, newVipLevel, deposit.user_id]
    );

    // Step 2: Record balance log
    await dbRun(
      "INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, 'deposit', ?, ?, ?)",
      [deposit.user_id, numAmount, `儲值確認 (ID: ${id}${deposit.tx_id ? ', TxID: ' + deposit.tx_id : ''})`, operatorStr]
    );

    // Step 3: Update deposit status
    await dbRun(
      "UPDATE deposits SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [adminUsername, id]
    );

    // Step 4: First deposit bonus
    let firstDepositBonus = 0;
    let firstDepositClaimed = false;
    if ((user.first_deposit_claimed === 0 || user.first_deposit_claimed === null) && numAmount >= 500) {
      firstDepositBonus = Math.floor(numAmount * 0.33 * 100) / 100;
      const wagerReq = (numAmount + firstDepositBonus) * 10;
      await dbRun(
        "UPDATE users SET balance = balance + ?, first_deposit_claimed = 1, wager_requirement = wager_requirement + ? WHERE id = ?",
        [firstDepositBonus, wagerReq, deposit.user_id]
      );
      await dbRun(
        "INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, 'first_deposit', ?, ?, 'system')",
        [deposit.user_id, firstDepositBonus, `首充獎勵 33% (儲值 ${numAmount} USDT)`]
      );
      firstDepositClaimed = true;
    }

    // Step 5: Referral commission (schedule for next day)
    let referralScheduled = false;
    if (user.invited_by && user.invited_by > 0) {
      const commissionAmount = Math.floor(numAmount * 0.10 * 100) / 100;
      const wageringRequired = commissionAmount * 5;
      await dbRun(
        `INSERT INTO referral_commissions (referrer_id, referred_id, deposit_amount, commission_amount, status, wagering_required, deposit_date)
         VALUES (?, ?, ?, ?, 'pending', ?, date('now'))`,
        [user.invited_by, deposit.user_id, numAmount, commissionAmount, wageringRequired]
      );
      referralScheduled = true;
    }

    // Step 6: TG notifications
    const updatedUser = await dbGet("SELECT balance FROM users WHERE id = ?", [deposit.user_id]);
    const finalBalance = updatedUser ? updatedUser.balance : newBalance + firstDepositBonus;
    if (user.tg_id) {
      const displayName = user.tg_first_name || user.tg_username || user.username;
      let extraNotes = `\n📊 累計儲值：<b>${newTotalDeposit.toFixed(2)} USDT</b>`;
      if (vipUpgraded) extraNotes += `\n👑 恭喜升級至 <b>VIP${newVipLevel}</b>！`;
      if (firstDepositClaimed) extraNotes += `\n🎁 首充獎勵 <b>+${firstDepositBonus.toFixed(2)} USDT</b> 已發放！`;
      if (referralScheduled) extraNotes += `\n🤝 推薦返佣將於明日自動發放給邀請人`;
      sendTGToUser(user.tg_id,
        `💰 <b>儲值已到帳！</b>\n\n親愛的 ${displayName}，\n您的儲值 <b>${numAmount.toFixed(2)} USDT</b> 已確認入帳\n💼 當前餘額：<b>${finalBalance.toFixed(2)} USDT</b>${extraNotes}\n\n如有疑問請聯繫客服 @LA1111_bot`
      );
    }
    if (referralScheduled) {
      const inviter = await dbGet("SELECT tg_id, tg_first_name, tg_username, username FROM users WHERE id = ?", [user.invited_by]);
      if (inviter && inviter.tg_id) {
        const commAmt = Math.floor(numAmount * 0.10 * 100) / 100;
        const inviterName = inviter.tg_first_name || inviter.tg_username || inviter.username;
        const referredName = user.tg_first_name || user.tg_username || user.username;
        sendTGToUser(inviter.tg_id,
          `🤝 <b>推薦返佣通知</b>\n\n親愛的 ${inviterName}，\n您邀請的 ${referredName} 已儲值 <b>${numAmount.toFixed(2)} USDT</b>\n💰 您將獲得返佣：<b>${commAmt.toFixed(2)} USDT</b>\n⏰ 返佣將於明日自動到帳`
        );
      }
    }
    sendTG(`✅ 儲值審核通過 | ${user.tg_username || user.username} | ${numAmount} USDT | 審核人: ${adminUsername}${vipUpgraded ? ` | VIP升至${newVipLevel}` : ''}${firstDepositClaimed ? ` | 首充+${firstDepositBonus}` : ''}`);

    res.json({ ok: true, message: "審核通過，已自動上分", vip_upgraded: vipUpgraded, new_vip_level: newVipLevel, first_deposit_bonus: firstDepositBonus, referral_scheduled: referralScheduled });
  } catch (e) {
    console.error("[deposit-requests approve] error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Reject deposit request
app.post("/admin/deposit-requests/:id/reject", adminLimiter, async (req, res) => {
  let adminPayload;
  try { adminPayload = adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { id } = req.params;
  const { reason } = req.body;
  const adminUsername = adminPayload.username || String(adminPayload.id);

  try {
    const deposit = await dbGet("SELECT * FROM deposits WHERE id = ? AND status = 'pending'", [id]);
    if (!deposit) return res.status(404).json({ error: "儲值申請不存在或已處理" });

    await dbRun(
      "UPDATE deposits SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [adminUsername, id]
    );

    // Notify user about rejection
    const user = await dbGet("SELECT tg_id, tg_first_name, tg_username, username FROM users WHERE id = ?", [deposit.user_id]);
    if (user && user.tg_id) {
      const displayName = user.tg_first_name || user.tg_username || user.username;
      sendTGToUser(user.tg_id,
        `❌ <b>儲值申請未通過</b>\n\n親愛的 ${displayName}，\n您的 ${deposit.amount} USDT 儲值申請未通過審核。${reason ? `\n原因：${reason}` : ''}\n\n如有疑問請聯繫客服 @LA1111_bot`
      );
    }

    res.json({ ok: true, message: "已拒絕" });
  } catch (e) {
    console.error("[deposit-requests reject] error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/admin/db-tables", adminLimiter, checkRole(["super_admin"]), async (req, res) => {
  try {
    const tables = await dbAll(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC"
    );
    const result = [];
    for (const t of tables) {
      try {
        const countRow = await dbGet(`SELECT COUNT(*) as cnt FROM "${t.name}"`);
        result.push({ table: t.name, records: countRow ? countRow.cnt : 0 });
      } catch (e) {
        result.push({ table: t.name, records: -1, error: e.message });
      }
    }
    res.json({
      db_path: require("./models/db").DB_PATH,
      total_tables: result.length,
      tables: result
    });
  } catch (e) {
    res.status(500).json({ error: "查詢失敗", detail: e.message });
  }
});

// ── Poker REST API: room list ────────────────────────────────────────────────
app.get("/api/rooms", async (req, res) => {
  try {
    const { getRoomList } = require("./poker/socket");
    // getRoomList is only available after initPokerSocket, fallback to DB
    const pokerDb = require("./poker/db");
    const configs = await pokerDb.loadRoomConfigs();
    const list = configs.map(cfg => ({
      id: cfg.id,
      name: cfg.name,
      smallBlind: cfg.small_blind,
      bigBlind: cfg.big_blind,
      minBuyIn: cfg.min_buyin,
      maxBuyIn: cfg.max_buyin,
      maxPlayers: cfg.max_players,
      playerCount: 0,
      phase: "WAITING",
    }));
    res.json(list);
  } catch (e) {
    console.error("[Poker API] /api/rooms error:", e.message);
    res.json([]);
  }
});

// ── Poker System Config API (hot-reload without redeploy) ───────────────────
app.post("/api/poker/system-configs/refresh", async (req, res) => {
  try {
    const pokerDb = require("./poker/db");
    pokerDb.invalidateSystemConfigCache();
    res.json({ success: true, message: "Poker config cache invalidated" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;

// ── Create HTTP server with Socket.IO ────────────────────────────────────────
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// Initialize poker schema and socket namespace
initPokerSchema()
  .then(() => {
    console.log("[Poker] Schema initialized");
    initPokerSocket(io);
    console.log("[Poker] Socket.IO /poker namespace ready");
  })
  .catch(err => console.error("[Poker] Init error:", err.message));

server.listen(PORT, () => {
  console.log(`LA1 Backend v5.4.0-poker running on port ${PORT}`);
  console.log(`[Poker] WebSocket available at ws://0.0.0.0:${PORT}/poker`);
  // Restore user data if DB is newly created (Persistent Volume first boot)
  setTimeout(() => {
    seedUsersIfEmpty().catch(err => console.error("[DB] seedUsersIfEmpty failed:", err.message));
  }, 2000);
  // Start the hourly push job
  startPushJob();
  // Start the agent settlement scheduler (runs hourly, executes at 3 AM)
  startSettlementScheduler();
  // Start the daily referral commission scheduler (runs at 01:00)
  startReferralCommissionScheduler();
});
