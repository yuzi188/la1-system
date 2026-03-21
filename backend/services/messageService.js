/**
 * services/messageService.js — Message template resolution
 *
 * Feature #6: Reads templates from message_templates table.
 * Falls back to hardcoded defaults if DB lookup fails.
 */

const { dbGet } = require("../models/db");

const SITE_URL = process.env.SITE_URL || "https://la1-website-production.up.railway.app";

// Hardcoded fallback templates (Chinese only)
const FALLBACK = {
  register_no_deposit:
    "🎉 歡迎加入 LA1！\n\n您已成功註冊，現在完成首充即可領取豐厚獎勵 💰\n\n👉 立即儲值：" + SITE_URL + "/deposit",
  deposit_no_bet:
    "💰 您的帳戶已有餘額！\n\n還沒開始遊戲嗎？試試我們的熱門遊戲，贏取更多獎勵 🎰\n\n👉 開始遊戲：" + SITE_URL,
  inactive_3d:
    "👋 好久不見！\n\n我們想念您了～回來簽到領獎金，每天都有驚喜！\n\n👉 立即簽到：發送 /sign",
  inactive_7d:
    "🔔 專屬回歸禮等你拿！\n\n已經 7 天沒上線了，回來看看有什麼新活動吧！\n\n👉 查看獎勵：" + SITE_URL + "/activity",
  high_value:
    "👑 尊貴的 VIP 玩家您好！\n\n感謝您的支持，專屬返水和週末加碼活動已為您開啟 🎁\n\n👉 查看 VIP 福利：發送 /vip",
};

/**
 * Resolve a message template for a given trigger.
 * Tries DB first, falls back to hardcoded.
 *
 * @param {string} triggerName
 * @param {string} lang – 'zh' or 'en'
 * @param {object} user – user row (for variable interpolation)
 * @returns {string}
 */
async function resolveTemplate(triggerName, lang = "zh", user = {}) {
  let content = null;

  try {
    const row = await dbGet(
      "SELECT content FROM message_templates WHERE trigger = ? AND lang = ?",
      [triggerName, lang]
    );
    if (row && row.content) {
      content = row.content;
    }
  } catch (err) {
    console.error("[MessageService] DB lookup failed, using fallback:", err.message);
  }

  if (!content) {
    content = FALLBACK[triggerName] || `[${triggerName}] 通知`;
  }

  // Variable interpolation
  content = content.replace(/\{\{site_url\}\}/g, SITE_URL);
  content = content.replace(/\{\{username\}\}/g, user.tg_first_name || user.tg_username || user.username || "");
  content = content.replace(/\{\{balance\}\}/g, ((user.balance || 0).toFixed(2)));
  content = content.replace(/\{\{vip_level\}\}/g, String(user.vip_level || 0));

  return content;
}

module.exports = { resolveTemplate };
