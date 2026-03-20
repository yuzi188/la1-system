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

db.serialize(() => {
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
    operator TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Send a TG message directly to a specific user by their tg_id.
 */
function sendTGToUser(tg_id, msg) {
  if (!tg_id) return;
  axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    params: { chat_id: tg_id, text: msg, parse_mode: "HTML" }
  }).catch(() => {});
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

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    return computedHash === hash;
  } catch (e) {
    return false;
  }
}

// ── Admin Auth ────────────────────────────────────────────────────────────────

/**
 * POST /admin/login
 * Body: { password: string }
 * Returns admin JWT if password matches.
 */
app.post("/admin/login", (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "請輸入密碼" });
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "密碼錯誤" });

  const token = jwt.sign({ role: "admin", ts: Date.now() }, ADMIN_JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, ok: true });
});

/**
 * GET /admin/users
 * Header: Authorization: Bearer <admin_token>
 * Query: ?q=search_term (optional)
 * Returns all users with optional search.
 */
app.get("/admin/users", (req, res) => {
  try {
    adminAuth(req);
  } catch (e) {
    return res.status(401).json({ error: "未授權，請先登入後台" });
  }

  const q = req.query.q ? `%${req.query.q}%` : null;
  const sql = q
    ? `SELECT id, username, tg_id, tg_first_name, tg_last_name, tg_username, balance, level, created_at
       FROM users
       WHERE username LIKE ? OR tg_id LIKE ? OR tg_username LIKE ? OR tg_first_name LIKE ?
       ORDER BY created_at DESC`
    : `SELECT id, username, tg_id, tg_first_name, tg_last_name, tg_username, balance, level, created_at
       FROM users ORDER BY created_at DESC`;

  const params = q ? [q, q, q, q] : [];
  db.all(sql, params, (e, rows) => res.json(rows || []));
});

/**
 * POST /admin/adjust-balance
 * Header: Authorization: Bearer <admin_token>
 * Body: { userId, amount, type: "add"|"deduct", reason }
 * Adjusts user balance and sends TG notification.
 */
app.post("/admin/adjust-balance", (req, res) => {
  try {
    adminAuth(req);
  } catch (e) {
    return res.status(401).json({ error: "未授權，請先登入後台" });
  }

  const { userId, amount, type, reason } = req.body;
  if (!userId || !amount || !type) {
    return res.status(400).json({ error: "缺少必要參數" });
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "金額必須為正數" });
  }

  if (type !== "add" && type !== "deduct") {
    return res.status(400).json({ error: "type 必須為 add 或 deduct" });
  }

  db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
    if (!user) return res.status(404).json({ error: "用戶不存在" });

    const newBalance = type === "add"
      ? user.balance + numAmount
      : user.balance - numAmount;

    if (newBalance < 0) {
      return res.status(400).json({ error: `餘額不足，當前餘額：${user.balance.toFixed(2)}` });
    }

    db.run("UPDATE users SET balance = ? WHERE id = ?", [newBalance, userId], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: "更新失敗" });

      // Log the operation
      db.run(
        "INSERT INTO balance_logs (user_id, type, amount, reason) VALUES (?, ?, ?, ?)",
        [userId, type, numAmount, reason || ""]
      );

      // Send TG notification to the user
      if (user.tg_id) {
        const displayName = user.tg_first_name || user.tg_username || user.username;
        const actionText = type === "add" ? "充值" : "扣款";
        const emoji = type === "add" ? "💰" : "📤";
        const reasonText = reason ? `\n📝 備註：${reason}` : "";
        const msg = `${emoji} <b>帳戶${actionText}通知</b>\n\n` +
          `親愛的 ${displayName}，\n` +
          `您的帳戶已${type === "add" ? "充值" : "扣除"} <b>${numAmount.toFixed(2)} USDT</b>\n` +
          `💼 當前餘額：<b>${newBalance.toFixed(2)} USDT</b>` +
          reasonText + `\n\n如有疑問請聯繫客服 @LA1111_bot`;
        sendTGToUser(user.tg_id, msg);
      }

      // Also notify admin channel
      const adminMsg = `${type === "add" ? "⬆️ 上分" : "⬇️ 扣分"} | 用戶：${user.tg_username || user.username} | 金額：${numAmount} | 餘額：${newBalance.toFixed(2)}${reason ? ` | 原因：${reason}` : ""}`;
      sendTG(adminMsg);

      res.json({
        ok: true,
        userId,
        type,
        amount: numAmount,
        newBalance,
        message: `${type === "add" ? "上分" : "扣分"}成功，新餘額：${newBalance.toFixed(2)} USDT`
      });
    });
  });
});

/**
 * GET /admin/balance-logs
 * Returns recent balance adjustment logs.
 */
app.get("/admin/balance-logs", (req, res) => {
  try {
    adminAuth(req);
  } catch (e) {
    return res.status(401).json({ error: "未授權" });
  }

  db.all(
    `SELECT bl.*, u.username, u.tg_username, u.tg_first_name
     FROM balance_logs bl
     LEFT JOIN users u ON bl.user_id = u.id
     ORDER BY bl.created_at DESC LIMIT 100`,
    (e, rows) => res.json(rows || [])
  );
});

app.get("/admin/deposits", (req, res) => {
  try {
    adminAuth(req);
  } catch (e) {
    return res.status(401).json({ error: "未授權" });
  }
  db.all("SELECT * FROM deposits ORDER BY id DESC", (e, rows) => res.json(rows || []));
});

// ── TG Login ──────────────────────────────────────────────────────────────────

app.post("/tg-login", (req, res) => {
  const { initData } = req.body;
  if (!initData) return res.json({ error: "缺少 initData" });

  const isValid = verifyTelegramInitData(initData, BOT_TOKEN);
  if (!isValid) {
    return res.status(401).json({ error: "initData 驗證失敗" });
  }

  const params = new URLSearchParams(initData);
  let tgUser;
  try {
    tgUser = JSON.parse(params.get("user") || "{}");
  } catch (e) {
    return res.status(400).json({ error: "無法解析用戶資訊" });
  }

  const { id: tg_id, first_name, last_name = "", username = "" } = tgUser;
  if (!tg_id) return res.status(400).json({ error: "無法取得 Telegram 用戶 ID" });

  const tg_id_str = String(tg_id);
  const display_username = username || `tg_${tg_id_str}`;

  db.get("SELECT * FROM users WHERE tg_id = ?", [tg_id_str], (err, existing) => {
    if (existing) {
      db.run(
        "UPDATE users SET tg_first_name=?, tg_last_name=?, tg_username=? WHERE tg_id=?",
        [first_name, last_name, username, tg_id_str]
      );
      const token = jwt.sign({ id: existing.id, tg_id: tg_id_str }, JWT_SECRET, { expiresIn: "30d" });
      return res.json({
        token,
        user: {
          id: existing.id,
          username: existing.tg_username || existing.username || display_username,
          first_name, last_name, tg_id: tg_id_str,
          balance: existing.balance,
          vip: existing.level === "vip" ? "VIP 會員" : "一般會員",
        }
      });
    }

    db.run(
      `INSERT INTO users (username, tg_id, tg_first_name, tg_last_name, tg_username) VALUES (?, ?, ?, ?, ?)`,
      [display_username, tg_id_str, first_name, last_name, username],
      function (insertErr) {
        if (insertErr) {
          const fallback = `user_${tg_id_str}`;
          db.run(
            `INSERT OR IGNORE INTO users (username, tg_id, tg_first_name, tg_last_name, tg_username) VALUES (?, ?, ?, ?, ?)`,
            [fallback, tg_id_str, first_name, last_name, username],
            function () {
              db.get("SELECT * FROM users WHERE tg_id = ?", [tg_id_str], (e2, row) => {
                if (!row) return res.status(500).json({ error: "建立用戶失敗" });
                const token = jwt.sign({ id: row.id, tg_id: tg_id_str }, JWT_SECRET, { expiresIn: "30d" });
                sendTG(`🤖 TG 新用戶：${first_name} (@${username || tg_id_str})`);
                return res.json({ token, user: { id: row.id, username: row.username, first_name, last_name, tg_id: tg_id_str, balance: 0, vip: "一般會員" } });
              });
            }
          );
          return;
        }
        const newId = this.lastID;
        const token = jwt.sign({ id: newId, tg_id: tg_id_str }, JWT_SECRET, { expiresIn: "30d" });
        sendTG(`🤖 TG 新用戶：${first_name} (@${username || tg_id_str})`);
        res.json({ token, user: { id: newId, username: display_username, first_name, last_name, tg_id: tg_id_str, balance: 0, vip: "一般會員" } });
      }
    );
  });
});

// ── User Auth ─────────────────────────────────────────────────────────────────

app.post("/register", (req, res) => {
  db.run("INSERT INTO users(username, password) VALUES (?, ?)", [req.body.username, req.body.password], (err) => {
    if (err) return res.json({ error: "用戶名已存在" });
    sendTG(`📝 新用戶註冊：${req.body.username}`);
    res.json({ ok: true });
  });
});

app.post("/login", (req, res) => {
  db.get("SELECT * FROM users WHERE username=? AND password=?", [req.body.username, req.body.password], (e, u) => {
    if (!u) return res.json({ error: "帳號或密碼錯誤" });
    sendTG(`🔑 用戶登入：${u.username}`);
    const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: u.id, username: u.username, balance: u.balance, vip: u.level === "vip" ? "VIP 會員" : "一般會員" } });
  });
});

app.get("/me", (req, res) => {
  try {
    const u = auth(req);
    db.get("SELECT id, username, tg_first_name, tg_username, tg_id, balance, level FROM users WHERE id=?", [u.id], (e, row) => {
      if (!row) return res.json({ error: "用戶不存在" });
      res.json({ id: row.id, username: row.tg_username || row.username, first_name: row.tg_first_name, tg_id: row.tg_id, balance: row.balance, vip: row.level === "vip" ? "VIP 會員" : "一般會員" });
    });
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// ── Payment ───────────────────────────────────────────────────────────────────

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

app.post("/ipn", (req, res) => {
  if (req.body.payment_status === "finished") {
    db.get("SELECT * FROM deposits WHERE payment_id=?", [req.body.payment_id], (e, row) => {
      if (!row || row.status === "done") return;
      db.run("UPDATE deposits SET status='done' WHERE id=?", [row.id]);
      db.run("UPDATE users SET balance=balance+? WHERE id=?", [row.amount, row.user_id]);
      sendTG(`💰 收款成功：$${row.amount}`);
    });
  }
  res.send("ok");
});

// ── Health Check ──────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.json({
  status: "ok", service: "la1-backend", version: "2.2.0",
  endpoints: ["/tg-login", "/login", "/register", "/me", "/create-payment", "/ipn", "/admin/login", "/admin/users", "/admin/adjust-balance", "/admin/balance-logs"]
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LA1 Backend v2.2 running on port ${PORT}`));
