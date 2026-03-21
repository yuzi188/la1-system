/**
 * services/pushService.js — Telegram push with try/catch
 *
 * Feature #4: Every sendTG call is wrapped in try/catch so one
 * failure never blocks or crashes the rest of the push loop.
 */

const axios = require("axios");

const BOT_TOKEN =
  process.env.BOT_TOKEN || "8796143383:AAHkbw_msst7ps7lt__cRlBwn7yhp82mv1U";

/**
 * Send a Telegram message to a specific chat_id.
 * Returns true on success, false on failure. Never throws.
 *
 * @param {string|number} chatId
 * @param {string} text
 * @param {string} parseMode – "HTML" | "Markdown" | ""
 * @returns {Promise<boolean>}
 */
async function sendTGToUser(chatId, text, parseMode = "HTML") {
  if (!chatId) return false;
  try {
    await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      params: { chat_id: chatId, text, parse_mode: parseMode },
      timeout: 10000,
    });
    return true;
  } catch (err) {
    console.error(
      `[PushService] Failed to send TG to ${chatId}:`,
      err.response?.data?.description || err.message
    );
    return false;
  }
}

/**
 * Send an admin/system notification (uses TG_TOKEN + TG_ID env vars).
 * Never throws.
 */
async function sendTGAdmin(msg) {
  if (!process.env.TG_TOKEN || !process.env.TG_ID) return false;
  try {
    await axios.get(
      `https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`,
      { params: { chat_id: process.env.TG_ID, text: msg }, timeout: 10000 }
    );
    return true;
  } catch (err) {
    console.error("[PushService] Admin TG failed:", err.message);
    return false;
  }
}

module.exports = { sendTGToUser, sendTGAdmin };
