/**
 * LA1 娛樂平台 — 提款（脫售）系統 & 安全防範機制
 * 包含：永久地址綁定、提款限額、IP檢測、冷卻期、流水驗證、風控預警
 */
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { dbGet, dbAll, dbRun } = require("../models/db");

const JWT_SECRET = process.env.JWT_SECRET || "la1_secret_2026";
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "la1_admin_secret_2026";
const BOT_TOKEN = process.env.BOT_TOKEN || "8796143383:AAHkbw_msst7ps7lt__cRlBwn7yhp82mv1U";

// ── Config ──────────────────────────────────────────────────────────────────
const WITHDRAW_CONFIG = {
  MIN_AMOUNT: 10,
  MAX_SINGLE_AMOUNT: 20000,
  DAILY_MAX_AMOUNT: 50000,
  DAILY_MAX_COUNT: 3,
  NEW_ACCOUNT_COOLDOWN_HOURS: 24,
};

// ── Auth helpers ─────────────────────────────────────────────────────────────
function auth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return jwt.verify(token, JWT_SECRET);
}

function adminAuth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  const payload = jwt.verify(token, ADMIN_JWT_SECRET);
  if (!payload.role) throw new Error("Not admin");
  return payload;
}

async function checkBanned(userId) {
  const user = await dbGet("SELECT banned, ban_reason FROM users WHERE id = ?", [userId]);
  if (!user) return { banned: false };
  return { banned: !!user.banned, reason: user.ban_reason || "" };
}

// ── TG Helpers ───────────────────────────────────────────────────────────────
function sendTGAdmin(msg) {
  if (process.env.TG_TOKEN && process.env.TG_ID) {
    axios.get(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
      params: { chat_id: process.env.TG_ID, text: msg }
    }).catch(() => {});
  }
}

function sendTGUser(tg_id, msg) {
  if (!tg_id) return;
  axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    params: { chat_id: tg_id, text: msg, parse_mode: "HTML" }
  }).catch(() => {});
}

// ── Init tables ──────────────────────────────────────────────────────────────
async function initWithdrawalTables() {
  // withdrawals table upgrade
  const newCols = [
    "network TEXT DEFAULT 'TRC20'",
    "completed_at DATETIME",
    "tx_hash TEXT DEFAULT ''",
    "ip_address TEXT",
  ];
  for (const col of newCols) {
    try { await dbRun(`ALTER TABLE withdrawals ADD COLUMN ${col}`); } catch (e) {}
  }

  // user_wallets table — PERMANENT BINDING
  await dbRun(`CREATE TABLE IF NOT EXISTS user_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    network TEXT NOT NULL CHECK(network IN ('TRC20','ERC20')),
    usdt_address TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, network)
  )`);

  // risk_alerts table
  await dbRun(`CREATE TABLE IF NOT EXISTS risk_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT, -- 頻繁提款, 流水不足, IP異常, 大額異常, 新帳號快速提款, 疑似對沖
    level TEXT, -- 低, 中, 高
    detail TEXT,
    status TEXT DEFAULT 'pending', -- pending, handled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // audit_logs table
  await dbRun(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT,
    target_type TEXT,
    target_id TEXT,
    details TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log("[Withdrawal/Security] Tables initialized.");
}

// ── Risk & Anomaly Detection ─────────────────────────────────────────────────
async function detectRisk(userId, ip) {
  const alerts = [];
  const user = await dbGet("SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) return alerts;

  // 1. IP 異常檢測 (同 IP 多帳號提款)
  if (ip) {
    const sameIpUsers = await dbAll(
      "SELECT DISTINCT user_id FROM withdrawals WHERE ip_address = ? AND user_id != ? AND created_at >= datetime('now', '-24 hours')",
      [ip, userId]
    );
    if (sameIpUsers.length >= 2) {
      alerts.push({ type: "IP異常", level: "高", detail: `同 IP 24小時內有 ${sameIpUsers.length + 1} 個帳號申請提款` });
    }
  }

  // 2. 新帳號快速提款 (註冊 48 小時內大額提款)
  const regTime = new Date(user.created_at).getTime();
  const now = Date.now();
  if (now - regTime < 48 * 3600 * 1000) {
    alerts.push({ type: "新帳號提款", level: "中", detail: `帳號註冊未滿 48 小時` });
  }

  // 3. 流水刷水異常 (下注次數極少但流水達標)
  const betCount = await dbGet("SELECT COUNT(*) as cnt FROM game_records WHERE user_id = ?", [userId]);
  if (user.total_deposit > 0 && (betCount.cnt || 0) < 10 && (user.total_bet || 0) > user.total_deposit) {
    alerts.push({ type: "流水異常", level: "高", detail: `下注僅 ${betCount.cnt} 次即完成大額流水，疑似刷水` });
  }

  // 4. 疑似對沖 (勝率異常接近 50%)
  const gameStats = await dbGet(
    "SELECT COUNT(*) as total, SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins FROM game_records WHERE user_id = ? AND created_at >= datetime('now', '-24 hours')",
    [userId]
  );
  if (gameStats && gameStats.total >= 30) {
    const winRate = gameStats.wins / gameStats.total;
    if (winRate >= 0.48 && winRate <= 0.52) {
      alerts.push({ type: "疑似對沖", level: "高", detail: `24小時勝率 ${(winRate*100).toFixed(1)}% (${gameStats.wins}/${gameStats.total})，疑似對沖` });
    }
  }

  // Save alerts to DB
  for (const a of alerts) {
    await dbRun("INSERT INTO risk_alerts (user_id, type, level, detail) VALUES (?, ?, ?, ?)", [userId, a.type, a.level, a.detail]);
  }
  return alerts;
}

// ════════════════════════════════════════════════════════════════════════════
// PLAYER APIS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/withdrawal/info — 提款頁面資訊
router.get("/info", async (req, res) => {
  try {
    const u = auth(req);
    const user = await dbGet("SELECT id, balance, wager_requirement, created_at FROM users WHERE id = ?", [u.id]);
    
    // Daily stats
    const today = new Date().toISOString().split('T')[0] + '%';
    const dailyStats = await dbGet(
      "SELECT COUNT(*) as count, SUM(amount) as total FROM withdrawals WHERE user_id = ? AND created_at LIKE ? AND status != 'rejected'",
      [u.id, today]
    );

    const wallets = await dbAll("SELECT network, usdt_address FROM user_wallets WHERE user_id = ?", [u.id]);
    
    const regDate = new Date(user.created_at);
    const cooldownEnd = new Date(regDate.getTime() + WITHDRAW_CONFIG.NEW_ACCOUNT_COOLDOWN_HOURS * 3600 * 1000);
    const isCooling = Date.now() < cooldownEnd.getTime();

    res.json({
      ok: true,
      balance: user.balance,
      wager_requirement: user.wager_requirement || 0,
      daily_remaining_count: Math.max(0, WITHDRAW_CONFIG.DAILY_MAX_COUNT - (dailyStats.count || 0)),
      daily_remaining_amount: Math.max(0, WITHDRAW_CONFIG.DAILY_MAX_AMOUNT - (dailyStats.total || 0)),
      wallets,
      cooldown_end: cooldownEnd.toISOString(),
      is_cooling: isCooling,
      limits: {
        min: WITHDRAW_CONFIG.MIN_AMOUNT,
        max_single: WITHDRAW_CONFIG.MAX_SINGLE_AMOUNT
      }
    });
  } catch (e) { res.status(401).json({ error: "未授權" }); }
});

// POST /api/withdrawal/bind-wallet — 永久綁定地址 (限一次)
router.post("/bind-wallet", async (req, res) => {
  try {
    const u = auth(req);
    const { network, usdt_address } = req.body;
    if (!network || !usdt_address) return res.status(400).json({ error: "參數缺失" });
    
    // Check if already bound
    const existing = await dbGet("SELECT * FROM user_wallets WHERE user_id = ? AND network = ?", [u.id, network]);
    if (existing) return res.status(400).json({ error: "地址已綁定，永久不可更改" });

    // Format validation
    if (network === "TRC20" && !/^T[A-Za-z0-9]{33}$/.test(usdt_address)) return res.status(400).json({ error: "TRC20 格式錯誤" });
    if (network === "ERC20" && !/^0x[0-9a-fA-F]{40}$/.test(usdt_address)) return res.status(400).json({ error: "ERC20 格式錯誤" });

    await dbRun("INSERT INTO user_wallets (user_id, network, usdt_address) VALUES (?, ?, ?)", [u.id, network, usdt_address]);
    res.json({ ok: true, message: "地址已永久綁定" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/withdrawal/apply — 提交提款
router.post("/apply", async (req, res) => {
  try {
    const u = auth(req);
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const { amount, network } = req.body;
    const numAmount = parseFloat(amount);

    // 1. Basic checks
    if (isNaN(numAmount) || numAmount < WITHDRAW_CONFIG.MIN_AMOUNT) return res.status(400).json({ error: `最低提款 ${WITHDRAW_CONFIG.MIN_AMOUNT} USDT` });
    if (numAmount > WITHDRAW_CONFIG.MAX_SINGLE_AMOUNT) return res.status(400).json({ error: `單筆最高 ${WITHDRAW_CONFIG.MAX_SINGLE_AMOUNT} USDT` });

    const user = await dbGet("SELECT * FROM users WHERE id = ?", [u.id]);
    if (user.banned) return res.status(403).json({ error: "帳號已封禁" });
    if (user.balance < numAmount) return res.status(400).json({ error: "餘額不足" });
    if (user.wager_requirement > 0) return res.status(400).json({ error: `流水不足，還差 ${user.wager_requirement.toFixed(2)} USDT` });

    // 2. Cooldown check
    const regTime = new Date(user.created_at).getTime();
    if (Date.now() - regTime < WITHDRAW_CONFIG.NEW_ACCOUNT_COOLDOWN_HOURS * 3600 * 1000) {
      return res.status(400).json({ error: `新帳號需註冊滿 ${WITHDRAW_CONFIG.NEW_ACCOUNT_COOLDOWN_HOURS} 小時後方可提款` });
    }

    // 3. Daily limits check
    const today = new Date().toISOString().split('T')[0] + '%';
    const daily = await dbGet("SELECT COUNT(*) as count, SUM(amount) as total FROM withdrawals WHERE user_id = ? AND created_at LIKE ? AND status != 'rejected'", [u.id, today]);
    if (daily.count >= WITHDRAW_CONFIG.DAILY_MAX_COUNT) return res.status(400).json({ error: "今日提款次數已達上限" });
    if ((daily.total || 0) + numAmount > WITHDRAW_CONFIG.DAILY_MAX_AMOUNT) return res.status(400).json({ error: "今日提款額度已達上限" });

    // 4. Wallet check
    const wallet = await dbGet("SELECT usdt_address FROM user_wallets WHERE user_id = ? AND network = ?", [u.id, network]);
    if (!wallet) return res.status(400).json({ error: "請先綁定提款地址" });

    // 5. Pending check
    const pending = await dbGet("SELECT id FROM withdrawals WHERE user_id = ? AND status = 'pending'", [u.id]);
    if (pending) return res.status(400).json({ error: "已有待審核申請" });

    // 6. Risk detection
    await detectRisk(u.id, ip);

    // Create request
    await dbRun(
      "INSERT INTO withdrawals (user_id, amount, wallet_address, network, status, ip_address) VALUES (?, ?, ?, ?, 'pending', ?)",
      [u.id, numAmount, wallet.usdt_address, network, ip]
    );

    sendTGAdmin(`📤 提款申請 | ${user.username} | ${numAmount}U | ${network} | IP: ${ip}`);
    res.json({ ok: true, message: "申請已提交，請等待審核" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// ADMIN APIS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/withdrawal/admin/list — 提款審核列表
router.get("/admin/list", async (req, res) => {
  try {
    adminAuth(req);
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = "";
    const params = [];
    if (status && ["pending", "approved", "rejected", "completed"].includes(status)) {
      where = "WHERE w.status = ?";
      params.push(status);
    }
    const rows = await dbAll(
      `SELECT w.*, u.username, u.tg_username, u.balance, u.total_bet, u.total_deposit, u.wager_requirement, u.risk_flag
       FROM withdrawals w LEFT JOIN users u ON w.user_id = u.id
       ${where} ORDER BY w.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const count = await dbGet(`SELECT COUNT(*) as total FROM withdrawals w ${where}`, params);
    res.json({ ok: true, data: rows, total: count.total });
  } catch (e) { res.status(401).json({ error: "未授權" }); }
});

// GET /api/withdrawal/admin/detail/:id — 提款詳情 (含遊戲紀錄、異常偵測)
router.get("/admin/detail/:id", async (req, res) => {
  try {
    adminAuth(req);
    const { id } = req.params;
    const withdrawal = await dbGet(
      `SELECT w.*, u.username, u.tg_username, u.tg_id, u.balance, u.total_bet, u.total_deposit, u.wager_requirement, u.risk_flag, u.created_at as user_created_at
       FROM withdrawals w LEFT JOIN users u ON w.user_id = u.id WHERE w.id = ?`, [id]
    );
    if (!withdrawal) return res.status(404).json({ error: "記錄不存在" });

    const userId = withdrawal.user_id;
    const gameRecords = await dbAll("SELECT * FROM game_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", [userId]);
    const deposits = await dbAll("SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 10", [userId]);
    const alerts = await dbAll("SELECT * FROM risk_alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", [userId]);
    const wallets = await dbAll("SELECT * FROM user_wallets WHERE user_id = ?", [userId]);

    res.json({ ok: true, withdrawal, game_records: gameRecords, deposits, alerts, wallets });
  } catch (e) { res.status(401).json({ error: "未授權" }); }
});

// POST /api/withdrawal/admin/approve — 審核通過 (扣除餘額)
router.post("/admin/approve", async (req, res) => {
  let admin;
  try { admin = adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { id, tx_hash } = req.body;
  try {
    const w = await dbGet("SELECT * FROM withdrawals WHERE id = ?", [id]);
    if (!w || w.status !== 'pending') return res.status(400).json({ error: "狀態錯誤" });

    const user = await dbGet("SELECT balance, tg_id FROM users WHERE id = ?", [w.user_id]);
    if (user.balance < w.amount) return res.status(400).json({ error: "用戶餘額不足" });

    await dbRun("UPDATE users SET balance = balance - ? WHERE id = ?", [w.amount, w.user_id]);
    await dbRun("UPDATE withdrawals SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now'), tx_hash = ? WHERE id = ?",
      [admin.username, tx_hash || '', id]);
    
    await dbRun("INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, 'withdraw', ?, ?, ?)",
      [w.user_id, -w.amount, `提款審核通過 (${w.network})`, `admin:${admin.username}`]);

    sendTGUser(user.tg_id, `✅ <b>提款審核通過</b>\n\n金額：${w.amount} USDT\n網路：${w.network}\n狀態：已打款\n${tx_hash ? `Hash: ${tx_hash}` : ""}`);
    res.json({ ok: true, message: "已批准並扣款" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/withdrawal/admin/reject — 拒絕提款 (不扣餘額)
router.post("/admin/reject", async (req, res) => {
  let admin;
  try { admin = adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { id, reason } = req.body;
  try {
    const w = await dbGet("SELECT * FROM withdrawals WHERE id = ?", [id]);
    if (!w || w.status !== 'pending') return res.status(400).json({ error: "狀態錯誤" });

    await dbRun("UPDATE withdrawals SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), reject_reason = ? WHERE id = ?",
      [admin.username, reason, id]);
    
    const user = await dbGet("SELECT tg_id FROM users WHERE id = ?", [w.user_id]);
    sendTGUser(user.tg_id, `❌ <b>提款申請被拒絕</b>\n\n金額：${w.amount} USDT\n原因：${reason}`);
    res.json({ ok: true, message: "已拒絕申請" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/withdrawal/admin/risk-alerts — 風控預警列表
router.get("/admin/risk-alerts", async (req, res) => {
  try {
    adminAuth(req);
    const rows = await dbAll(
      "SELECT r.*, u.username, u.balance FROM risk_alerts r LEFT JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT 100"
    );
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(401).json({ error: "未授權" }); }
});

// POST /api/withdrawal/admin/freeze — 一鍵凍結帳號
router.post("/admin/freeze", async (req, res) => {
  let admin;
  try { admin = adminAuth(req); } catch (e) { return res.status(401).json({ error: "未授權" }); }
  const { userId, reason } = req.body;
  try {
    await dbRun("UPDATE users SET banned = 1, ban_reason = ? WHERE id = ?", [reason, userId]);
    await dbRun("INSERT INTO audit_logs (admin_id, action, target_type, target_id, details, ip) VALUES (?, 'freeze_user', 'user', ?, ?, ?)",
      [admin.id, userId, reason, req.headers["x-forwarded-for"] || req.socket.remoteAddress]);
    res.json({ ok: true, message: "帳號已凍結" });
  } catch (e) { res.status(500).json({ error: "操作失敗" }); }
});

// GET /api/withdrawal/admin/audit-logs — 審計日誌
router.get("/admin/audit-logs", async (req, res) => {
  try {
    adminAuth(req);
    const rows = await dbAll("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200");
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(401).json({ error: "未授權" }); }
});

module.exports = { router, initWithdrawalTables };
