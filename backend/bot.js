const TelegramBot = require("node-telegram-bot-api");
const crypto = require("crypto");
require("dotenv").config();

// Feature #1: Use unified DB instance from models/db.js
const { db, dbGet, dbAll, dbRun } = require("./models/db");

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TG_TOKEN || "8796143383:AAHkbw_msst7ps7lt__cRlBwn7yhp82mv1U";
const SITE_URL = process.env.SITE_URL || "https://la1-website-production.up.railway.app";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ── Ensure leads table exists ───────────────────────────────────────────────────

db.run(`CREATE TABLE IF NOT EXISTS leads(
  id INTEGER PRIMARY KEY,
  tg_id TEXT,
  tg_username TEXT,
  status TEXT DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function generateInviteCode() {
  return "LA1" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

const VIP_CONFIG = [
  { level: 0, name: "普通會員", minBet: 0, rebate: 0 },
  { level: 1, name: "VIP1", minBet: 1000, rebate: 0.005 },
  { level: 2, name: "VIP2", minBet: 5000, rebate: 0.008 },
  { level: 3, name: "VIP3", minBet: 20000, rebate: 0.012 },
  { level: 4, name: "VIP4", minBet: 50000, rebate: 0.015 },
  { level: 5, name: "VIP5", minBet: 100000, rebate: 0.018 },
];

const CHECKIN_REWARDS = [0.5, 0.5, 1, 1, 1.5, 1.5, 3];

function getVipLevel(totalBet) {
  let vipLevel = 0;
  for (let i = VIP_CONFIG.length - 1; i >= 0; i--) {
    if (totalBet >= VIP_CONFIG[i].minBet) { vipLevel = VIP_CONFIG[i].level; break; }
  }
  return vipLevel;
}

function recordLead(msg) {
  db.get("SELECT * FROM leads WHERE tg_id=?", [msg.chat.id.toString()], (e, row) => {
    if (!row) {
      db.run("INSERT INTO leads(tg_id,tg_username,status) VALUES (?,?,?)",
        [msg.chat.id.toString(), msg.from.username || "unknown", "new"]);
    }
  });
}

async function getOrCreateUser(msg) {
  const tgId = msg.chat.id.toString();
  let user = await dbGet("SELECT * FROM users WHERE tg_id = ?", [tgId]);
  if (!user) {
    const inviteCode = generateInviteCode();
    const username = msg.from.username || `tg_${tgId}`;
    try {
      await dbRun("INSERT INTO users (username, tg_id, tg_first_name, tg_last_name, tg_username, invite_code) VALUES (?, ?, ?, ?, ?, ?)",
        [username, tgId, msg.from.first_name || "", msg.from.last_name || "", msg.from.username || "", inviteCode]);
    } catch (e) {
      await dbRun("INSERT OR IGNORE INTO users (username, tg_id, tg_first_name, tg_last_name, tg_username, invite_code) VALUES (?, ?, ?, ?, ?, ?)",
        [`user_${tgId}`, tgId, msg.from.first_name || "", msg.from.last_name || "", msg.from.username || "", inviteCode]);
    }
    user = await dbGet("SELECT * FROM users WHERE tg_id = ?", [tgId]);
  }
  return user;
}

// ── /start (with referral support) ──────────────────────────────────────────

bot.onText(/\/start(.*)/, async (msg, match) => {
  recordLead(msg);
  const chatId = msg.chat.id;
  const param = (match[1] || "").trim();

  // Handle referral: /start ref_XXXXXXXX
  if (param.startsWith("ref_")) {
    const refCode = param.replace("ref_", "");
    const user = await getOrCreateUser(msg);
    if (user && !user.invited_by) {
      const referrer = await dbGet("SELECT * FROM users WHERE invite_code = ?", [refCode]);
      if (referrer && referrer.id !== user.id) {
        await dbRun("UPDATE users SET invited_by = ? WHERE id = ?", [referrer.id, user.id]);
        await dbRun("UPDATE users SET invite_count = invite_count + 1 WHERE id = ?", [referrer.id]);
        bot.sendMessage(chatId, `🎉 您已通過好友邀請加入！\n邀請人：${referrer.tg_first_name || referrer.username}\n\n完成首充即可為邀請人帶來佣金獎勵！`);
      }
    }
  }

  // Reset opt_out when user sends /start (re-subscribe)
  const tgIdStr = chatId.toString();
  db.run("UPDATE users SET opt_out = 0 WHERE tg_id = ?", [tgIdStr], () => {});

  bot.sendMessage(chatId,
`🔥 <b>歡迎來到 LA1 AI 娛樂平台</b>

🎰 信任 · 快速 · 頂級

📌 <b>快捷指令：</b>
/sign — ✅ 每日簽到（領獎金）
/vip — 👑 查看 VIP 等級
/invite — 🤝 邀請好友（賺佣金）
/bonus — 🎁 查看可領獎勵
/stop — 🔕 關閉推送通知

1️⃣ 新手教學
2️⃣ 今日推薦
3️⃣ 直接開始
4️⃣ 聯繫客服

👇 輸入數字或點擊指令`, { parse_mode: "HTML" });

  db.run("UPDATE leads SET status='talking' WHERE tg_id=?", [chatId.toString()]);
});

// ── /sign — 每日簽到 ────────────────────────────────────────────────────────

bot.onText(/\/sign/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await getOrCreateUser(msg);
    if (!user) return bot.sendMessage(chatId, "❌ 系統錯誤，請稍後再試");
    if (user.risk_flag) return bot.sendMessage(chatId, "❌ 帳戶異常，請聯繫客服");

    const today = getToday();
    const existing = await dbGet("SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?", [user.id, today]);
    if (existing) return bot.sendMessage(chatId, "✅ 今日已簽到！明天再來哦～\n\n💡 連續簽到獎勵更多！");

    // Calculate streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const lastCheckin = await dbGet("SELECT * FROM checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1", [user.id]);

    let streak = 0;
    if (lastCheckin && lastCheckin.checkin_date === yesterdayStr) {
      const records = await dbAll("SELECT * FROM checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 7", [user.id]);
      streak = 1;
      for (let i = 1; i < records.length; i++) {
        const prev = new Date(records[i - 1].checkin_date);
        const curr = new Date(records[i].checkin_date);
        const diff = (prev - curr) / (1000 * 60 * 60 * 24);
        if (diff === 1) streak++;
        else break;
      }
    }

    const dayIndex = streak % 7;
    const reward = CHECKIN_REWARDS[dayIndex];
    const wagerReq = reward * 2;

    await dbRun("INSERT INTO checkins (user_id, day, amount, checkin_date) VALUES (?, ?, ?, ?)", [user.id, dayIndex + 1, reward, today]);
    await dbRun("UPDATE users SET balance = balance + ?, wager_requirement = COALESCE(wager_requirement, 0) + ? WHERE id = ?", [reward, wagerReq, user.id]);
    await dbRun("INSERT INTO balance_logs (user_id, type, amount, reason, wager_req, operator) VALUES (?, ?, ?, ?, ?, ?)",
      [user.id, "add", reward, `每日簽到 Day${dayIndex + 1}`, wagerReq, "system"]);

    // Build 7-day display
    let dayDisplay = "";
    for (let i = 0; i < 7; i++) {
      const r = CHECKIN_REWARDS[i];
      if (i < dayIndex) dayDisplay += `✅ Day${i + 1}: ${r}U\n`;
      else if (i === dayIndex) dayDisplay += `🎉 Day${i + 1}: ${r}U ← 今日\n`;
      else dayDisplay += `⬜ Day${i + 1}: ${r}U\n`;
    }

    const updatedUser = await dbGet("SELECT balance FROM users WHERE id = ?", [user.id]);

    bot.sendMessage(chatId,
`✅ <b>簽到成功！</b>

📅 連續簽到第 <b>${dayIndex + 1}</b> 天
💰 獲得：<b>${reward} USDT</b>
🎯 流水要求：2 倍（${wagerReq} USDT）
💼 當前餘額：<b>${(updatedUser?.balance || 0).toFixed(2)} USDT</b>

<b>📋 7 天簽到進度：</b>
${dayDisplay}
🔥 連續 7 天可領 <b>3U</b> 大獎！`, { parse_mode: "HTML" });

  } catch (e) {
    console.error("Sign error:", e);
    bot.sendMessage(chatId, "❌ 簽到失敗，請稍後再試");
  }
});

// ── /vip — 查看 VIP 等級 ────────────────────────────────────────────────────

bot.onText(/\/vip/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await getOrCreateUser(msg);
    if (!user) return bot.sendMessage(chatId, "❌ 系統錯誤");

    const totalBet = user.total_bet || 0;
    const vipLevel = getVipLevel(totalBet);
    const currentVip = VIP_CONFIG[vipLevel];
    const nextVip = VIP_CONFIG[Math.min(vipLevel + 1, 5)];
    const remaining = Math.max(0, nextVip.minBet - totalBet);
    const progress = vipLevel >= 5 ? 100 : Math.min(100, ((totalBet - currentVip.minBet) / (nextVip.minBet - currentVip.minBet) * 100));

    // Progress bar
    const filled = Math.round(progress / 10);
    const bar = "🟨".repeat(filled) + "⬜".repeat(10 - filled);

    let vipTable = "";
    VIP_CONFIG.forEach(v => {
      const marker = v.level === vipLevel ? " ← 當前" : "";
      vipTable += `${v.level === vipLevel ? "👉" : "  "} ${v.name}: 投注 ${v.minBet.toLocaleString()} | 返水 ${(v.rebate * 100).toFixed(1)}%${marker}\n`;
    });

    bot.sendMessage(chatId,
`👑 <b>VIP 等級資訊</b>

🏅 當前等級：<b>${currentVip.name}</b>
💰 返水比例：<b>${(currentVip.rebate * 100).toFixed(1)}%</b>
📊 累計投注：<b>${totalBet.toLocaleString()} USDT</b>

${bar} ${Math.round(progress)}%

🎯 下一等級：${nextVip.name}
📈 還需投注：<b>${remaining.toLocaleString()} USDT</b>

<b>📋 VIP 等級表：</b>
${vipTable}
🔥 週末 VIP2+ 返水額外 +30%！`, { parse_mode: "HTML" });

  } catch (e) {
    bot.sendMessage(chatId, "❌ 查詢失敗，請稍後再試");
  }
});

// ── /invite — 邀請好友 ──────────────────────────────────────────────────────

bot.onText(/\/invite/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await getOrCreateUser(msg);
    if (!user) return bot.sendMessage(chatId, "❌ 系統錯誤");

    // Ensure invite code
    if (!user.invite_code) {
      const code = generateInviteCode();
      await dbRun("UPDATE users SET invite_code = ? WHERE id = ?", [code, user.id]);
      user.invite_code = code;
    }

    const tgLink = `https://t.me/LA1111_bot?start=ref_${user.invite_code}`;
    const webLink = `${SITE_URL}?ref=${user.invite_code}`;

    bot.sendMessage(chatId,
`🤝 <b>邀請好友，賺取永久佣金！</b>

📌 <b>您的邀請碼：</b><code>${user.invite_code}</code>

🔗 <b>邀請連結（TG）：</b>
${tgLink}

🌐 <b>邀請連結（網頁）：</b>
${webLink}

💰 <b>佣金規則：</b>
├ 直推好友首充：<b>15%</b> 佣金
└ 二級好友首充：<b>3%</b> 佣金

📊 <b>邀請統計：</b>
├ 已邀請人數：<b>${user.invite_count || 0}</b> 人
└ 累計佣金：<b>${(user.invite_earnings || 0).toFixed(2)} USDT</b>

💡 把邀請連結分享給好友，好友首充後佣金自動到帳！`, { parse_mode: "HTML" });

  } catch (e) {
    bot.sendMessage(chatId, "❌ 查詢失敗，請稍後再試");
  }
});

// ── /bonus — 查看可領獎勵 ───────────────────────────────────────────────────

bot.onText(/\/bonus/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await getOrCreateUser(msg);
    if (!user) return bot.sendMessage(chatId, "❌ 系統錯誤");

    const today = getToday();
    let bonusList = "";
    let count = 0;

    // 1. First deposit bonus
    if (!user.first_deposit_claimed) {
      if ((user.total_deposit || 0) >= 30) {
        bonusList += "🎁 <b>首充獎勵</b> — 可領取！\n   充 100 送 38 / 充 30 送 10\n   👉 前往網站領取\n\n";
        count++;
      } else {
        bonusList += "🎁 <b>首充獎勵</b> — 未達條件\n   需先完成首次儲值（最低 30U）\n\n";
      }
    } else {
      bonusList += "✅ <b>首充獎勵</b> — 已領取\n\n";
    }

    // 2. Daily check-in
    const todayCheckin = await dbGet("SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?", [user.id, today]);
    if (!todayCheckin) {
      bonusList += "📅 <b>每日簽到</b> — 可簽到！\n   👉 輸入 /sign 立即簽到\n\n";
      count++;
    } else {
      bonusList += "✅ <b>每日簽到</b> — 今日已簽到\n\n";
    }

    // 3. Tasks
    const todayClaims = await dbAll("SELECT task_id FROM task_claims WHERE user_id = ? AND claim_date = ?", [user.id, today]);
    const claimedIds = todayClaims.map(c => c.task_id);
    const todayBet = await dbGet("SELECT COALESCE(SUM(amount), 0) as total FROM balance_logs WHERE user_id = ? AND type = 'bet' AND date(created_at) = ?", [user.id, today]);

    const tasks = [
      { id: "bet_300", name: "今日投注滿 300", target: 300, reward: 2, type: "bet" },
      { id: "bet_1000", name: "今日投注滿 1000", target: 1000, reward: 5, type: "bet" },
      { id: "invite_1", name: "邀請 1 位好友", target: 1, reward: 3, type: "invite" },
    ];

    tasks.forEach(task => {
      let progress = 0;
      if (task.type === "bet") progress = todayBet?.total || 0;
      if (task.type === "invite") progress = user.invite_count || 0;
      const completed = progress >= task.target;
      const claimed = claimedIds.includes(task.id);

      if (claimed) {
        bonusList += `✅ ${task.name} — 已領取 ${task.reward}U\n`;
      } else if (completed) {
        bonusList += `🏆 ${task.name} — <b>可領取 ${task.reward}U！</b>\n   👉 前往網站領取\n`;
        count++;
      } else {
        bonusList += `⬜ ${task.name} — ${progress}/${task.target}\n`;
      }
    });

    // 4. Weekend
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;
    const vipLevel = getVipLevel(user.total_bet || 0);
    if (isWeekend && vipLevel >= 2) {
      bonusList += `\n🎊 <b>週末返水 +30%</b> — 已激活！\n`;
    } else if (isWeekend) {
      bonusList += `\n🎊 <b>週末返水 +30%</b> — 需 VIP2+\n`;
    }

    bot.sendMessage(chatId,
`🎁 <b>可領取獎勵</b>（${count} 項可領）

${bonusList}
💼 當前餘額：<b>${(user.balance || 0).toFixed(2)} USDT</b>

👉 前往網站查看更多：
${SITE_URL}/activity`, { parse_mode: "HTML" });

  } catch (e) {
    console.error("Bonus error:", e);
    bot.sendMessage(chatId, "❌ 查詢失敗，請稍後再試");
  }
});
// ── /stop — 關閉推送通知 ──────────────────────────────────────────────────────────────

bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const tgId = chatId.toString();
    const user = await dbGet("SELECT * FROM users WHERE tg_id = ?", [tgId]);
    if (user) {
      await dbRun("UPDATE users SET opt_out = 1 WHERE tg_id = ?", [tgId]);
      bot.sendMessage(chatId, "✅ 已關閉推送通知。\n\n如需重新開啟，請發送 /start");
    } else {
      bot.sendMessage(chatId, "❗ 您尚未註冊，請先發送 /start 開始使用。");
    }
  } catch (e) {
    console.error("Stop error:", e);
    bot.sendMessage(chatId, "❌ 操作失敗，請稍後再試");
  }
});

// ── Number menu (existing CRM) ──────────────────────────────────────────────────

bot.on("message", (msg) => {
  const text = msg.text;
  if (!text || text.startsWith("/")) return;
  recordLead(msg);

  if (text === "1") {
    bot.sendMessage(msg.chat.id,
`📖 <b>新手教學</b>

Step 1：從 Telegram 打開 Mini App
Step 2：選擇遊戲分類
Step 3：儲值開始遊戲

超簡單，3 分鐘搞定 👇
${SITE_URL}`, { parse_mode: "HTML" });
  }
  if (text === "2") {
    bot.sendMessage(msg.chat.id,
`🔥 <b>今日 AI 推薦</b>

🃏 百家樂 — 勝率 68%
🎰 老虎機 — 爆獎率高
🎲 骰寶 — 穩定收益

要不要我幫你安排？回覆「3」直接開始`, { parse_mode: "HTML" });
  }
  if (text === "3") {
    bot.sendMessage(msg.chat.id,
`💰 你預算多少？

A. $50 以下 — 新手體驗
B. $100-500 — 穩定玩家
C. $500+ — VIP 專屬

回覆 A / B / C 我幫你安排最適合的玩法`);
  }
  if (["A", "a", "B", "b", "C", "c"].includes(text)) {
    bot.sendMessage(msg.chat.id,
`✅ 收到！已為你安排最佳方案

👉 點擊開始：
${SITE_URL}/deposit

有問題隨時問我 💬`);
    db.run("UPDATE leads SET status='interested' WHERE tg_id=?", [msg.chat.id.toString()]);
  }
  if (text === "4") {
    bot.sendMessage(msg.chat.id,
`📩 客服在線中

請直接說明您的問題，我會盡快回覆！
或聯繫真人客服：@LA1111_bot`);
  }
});

console.log("LA1 TG Bot v3.0 is running...");
