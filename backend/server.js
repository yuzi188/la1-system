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
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function auth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return jwt.verify(token, JWT_SECRET);
}

function sendTG(msg) {
  if (process.env.TG_TOKEN && process.env.TG_ID) {
    axios.get(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
      params: { chat_id: process.env.TG_ID, text: msg }
    }).catch(() => {});
  }
}

/**
 * Verify Telegram Web App initData according to official spec:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function verifyTelegramInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    // Build data-check-string: all fields except hash, sorted alphabetically
    const checkArr = [];
    params.forEach((value, key) => {
      if (key !== "hash") checkArr.push(`${key}=${value}`);
    });
    checkArr.sort();
    const dataCheckString = checkArr.join("\n");

    // HMAC-SHA256 with secret key = HMAC-SHA256("WebAppData", botToken)
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

// ── Auth Routes ───────────────────────────────────────────────────────────────

/**
 * POST /tg-login
 * Body: { initData: string }
 * Verifies Telegram Web App initData, creates/updates user, returns JWT.
 */
app.post("/tg-login", (req, res) => {
  const { initData } = req.body;
  if (!initData) return res.json({ error: "缺少 initData" });

  // Verify signature
  const isValid = verifyTelegramInitData(initData, BOT_TOKEN);
  if (!isValid) {
    return res.status(401).json({ error: "initData 驗證失敗" });
  }

  // Parse user info from initData
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

  // Upsert user: find by tg_id, create if not exists
  db.get("SELECT * FROM users WHERE tg_id = ?", [tg_id_str], (err, existing) => {
    if (existing) {
      // Update TG profile info
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
          first_name: first_name,
          last_name: last_name,
          tg_id: tg_id_str,
          balance: existing.balance,
          vip: existing.level === "vip" ? "VIP 會員" : "一般會員",
        }
      });
    }

    // Create new user
    db.run(
      `INSERT INTO users (username, tg_id, tg_first_name, tg_last_name, tg_username)
       VALUES (?, ?, ?, ?, ?)`,
      [display_username, tg_id_str, first_name, last_name, username],
      function (insertErr) {
        if (insertErr) {
          // Username collision — try with tg_id suffix
          const fallback_username = `user_${tg_id_str}`;
          db.run(
            `INSERT OR IGNORE INTO users (username, tg_id, tg_first_name, tg_last_name, tg_username)
             VALUES (?, ?, ?, ?, ?)`,
            [fallback_username, tg_id_str, first_name, last_name, username],
            function () {
              db.get("SELECT * FROM users WHERE tg_id = ?", [tg_id_str], (e2, row) => {
                if (!row) return res.status(500).json({ error: "建立用戶失敗" });
                const token = jwt.sign({ id: row.id, tg_id: tg_id_str }, JWT_SECRET, { expiresIn: "30d" });
                sendTG(`🤖 TG 新用戶：${first_name} (@${username || tg_id_str})`);
                return res.json({
                  token,
                  user: {
                    id: row.id,
                    username: row.username,
                    first_name, last_name, tg_id: tg_id_str,
                    balance: 0, vip: "一般會員",
                  }
                });
              });
            }
          );
          return;
        }

        const newId = this.lastID;
        const token = jwt.sign({ id: newId, tg_id: tg_id_str }, JWT_SECRET, { expiresIn: "30d" });
        sendTG(`🤖 TG 新用戶：${first_name} (@${username || tg_id_str})`);
        res.json({
          token,
          user: {
            id: newId,
            username: display_username,
            first_name, last_name, tg_id: tg_id_str,
            balance: 0, vip: "一般會員",
          }
        });
      }
    );
  });
});

// ── Original Auth Routes ──────────────────────────────────────────────────────

app.post("/register", (req, res) => {
  db.run(
    "INSERT INTO users(username, password) VALUES (?, ?)",
    [req.body.username, req.body.password],
    (err) => {
      if (err) return res.json({ error: "用戶名已存在" });
      sendTG(`📝 新用戶註冊：${req.body.username}`);
      res.json({ ok: true });
    }
  );
});

app.post("/login", (req, res) => {
  db.get(
    "SELECT * FROM users WHERE username=? AND password=?",
    [req.body.username, req.body.password],
    (e, u) => {
      if (!u) return res.json({ error: "帳號或密碼錯誤" });
      sendTG(`🔑 用戶登入：${u.username}`);
      const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: "30d" });
      res.json({
        token,
        user: {
          id: u.id,
          username: u.username,
          balance: u.balance,
          vip: u.level === "vip" ? "VIP 會員" : "一般會員",
        }
      });
    }
  );
});

app.get("/me", (req, res) => {
  try {
    const u = auth(req);
    db.get(
      "SELECT id, username, tg_first_name, tg_username, tg_id, balance, level FROM users WHERE id=?",
      [u.id],
      (e, row) => {
        if (!row) return res.json({ error: "用戶不存在" });
        res.json({
          id: row.id,
          username: row.tg_username || row.username,
          first_name: row.tg_first_name,
          tg_id: row.tg_id,
          balance: row.balance,
          vip: row.level === "vip" ? "VIP 會員" : "一般會員",
        });
      }
    );
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
});

// ── Payment Routes ────────────────────────────────────────────────────────────

app.post("/create-payment", async (req, res) => {
  try {
    const u = auth(req);
    if (!process.env.PAY_KEY) return res.json({ error: "儲值功能尚未啟用" });

    const pay = await axios.post("https://api.nowpayments.io/v1/payment", {
      price_amount: req.body.amount,
      price_currency: "usd",
      pay_currency: "usdttrc20"
    }, {
      headers: { "x-api-key": process.env.PAY_KEY }
    });

    db.run(
      "INSERT INTO deposits(user_id, amount, status, payment_id) VALUES (?,?,?,?)",
      [u.id, req.body.amount, "waiting", pay.data.payment_id]
    );

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

// ── Admin Routes ──────────────────────────────────────────────────────────────

app.get("/admin/users", (req, res) => {
  db.all(
    "SELECT id, username, tg_id, tg_first_name, tg_username, balance, level, created_at FROM users",
    (e, rows) => res.json(rows || [])
  );
});

app.get("/admin/deposits", (req, res) => {
  db.all("SELECT * FROM deposits ORDER BY id DESC", (e, rows) => res.json(rows || []));
});

// ── Health Check ──────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.json({
  status: "ok",
  service: "la1-backend",
  version: "2.1.0",
  endpoints: ["/tg-login", "/login", "/register", "/me", "/create-payment", "/ipn"]
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LA1 Backend v2.1 running on port ${PORT}`));
