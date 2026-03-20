const TelegramBot = require("node-telegram-bot-api");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const bot = new TelegramBot(process.env.TG_TOKEN, { polling: true });
const db = new sqlite3.Database("./db.sqlite");

// CRM leads 表
db.run(`CREATE TABLE IF NOT EXISTS leads(
  id INTEGER PRIMARY KEY,
  tg_id TEXT,
  tg_username TEXT,
  status TEXT DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 記錄每個進來的用戶
function recordLead(msg){
  db.get("SELECT * FROM leads WHERE tg_id=?",[msg.chat.id.toString()],(e,row)=>{
    if(!row){
      db.run("INSERT INTO leads(tg_id,tg_username,status) VALUES (?,?,?)",
      [msg.chat.id.toString(), msg.from.username||"unknown", "new"]);
    }
  });
}

bot.on("message", (msg) => {
  const text = msg.text;
  recordLead(msg);

  if (text === "/start") {
    bot.sendMessage(msg.chat.id,
`🔥 歡迎來到 LA1 AI 娛樂平台

1️⃣ 新手教學
2️⃣ 今日推薦
3️⃣ 直接開始
4️⃣ 聯繫客服

請輸入數字選擇 👇`);
    db.run("UPDATE leads SET status='talking' WHERE tg_id=?",[msg.chat.id.toString()]);
  }

  if (text === "1") {
    bot.sendMessage(msg.chat.id,
`📖 新手教學

Step 1：註冊帳號
Step 2：選擇遊戲
Step 3：儲值開始

超簡單，3分鐘搞定 👇
https://la1-website-production.up.railway.app/login`);
  }

  if (text === "2") {
    bot.sendMessage(msg.chat.id,
`🔥 今日 AI 推薦

🃏 百家樂 — 勝率 68%
🎰 老虎機 — 爆獎率高
🎲 骰寶 — 穩定收益

要不要我幫你安排？回覆「3」直接開始`);
  }

  if (text === "3") {
    bot.sendMessage(msg.chat.id,
`💰 你預算多少？

A. $50 以下 — 新手體驗
B. $100-500 — 穩定玩家
C. $500+ — VIP 專屬

回覆 A / B / C 我幫你安排最適合的玩法`);
  }

  if (["A","a","B","b","C","c"].includes(text)) {
    bot.sendMessage(msg.chat.id,
`✅ 收到！已為你安排最佳方案

👉 點擊開始：
https://la1-website-production.up.railway.app/deposit

有問題隨時問我 💬`);
    db.run("UPDATE leads SET status='interested' WHERE tg_id=?",[msg.chat.id.toString()]);
  }

  if (text === "4") {
    bot.sendMessage(msg.chat.id,
`📩 客服在線中

請直接說明您的問題，我會盡快回覆！
或聯繫真人客服：@yu_888yu`);
  }
});

console.log("LA1 TG Bot is running...");
