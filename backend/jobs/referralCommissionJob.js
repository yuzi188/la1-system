/**
 * referralCommissionJob.js — Daily auto-dispatch of referral 分潤獎勵
 *
 * Rules:
 *  - Runs at 01:00 (server time) every day
 *  - Processes all approved deposits from YESTERDAY
 *  - For each deposit where the depositor was referred (invited_by != 0),
 *    credits 10% of deposit_amount to the referrer as 分潤獎勵
 *  - Commission is locked with 5x wagering requirement
 *  - Inserts a record into referral_commissions (status = 'paid')
 *  - Updates users.balance, users.invite_earnings, users.wager_requirement
 *  - Logs to balance_logs with reason '分潤獎勵'
 *  - Skips if referrer is risk_flagged or banned
 *  - Idempotent: checks for existing commission record for same referrer+referred+deposit_date
 */

const { dbGet, dbAll, dbRun } = require("../models/db");

const COMMISSION_RATE = 0.10;       // 10%
const WAGERING_MULTIPLIER = 5;      // 5x wagering requirement

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

async function runReferralCommissionJob() {
  const yesterday = getYesterday();
  console.log(`[ReferralJob] Starting commission dispatch for deposits on ${yesterday}`);

  try {
    // Find all completed deposits from yesterday where the depositor has a referrer
    const deposits = await dbAll(`
      SELECT d.id as deposit_id, d.user_id, d.amount as deposit_amount,
             u.invited_by as referrer_id, u.tg_username, u.tg_first_name, u.username
      FROM deposits d
      JOIN users u ON d.user_id = u.id
      WHERE d.status = 'done'
        AND date(d.created_at) = ?
        AND u.invited_by IS NOT NULL
        AND u.invited_by != 0
    `, [yesterday]);

    if (deposits.length === 0) {
      console.log(`[ReferralJob] No eligible deposits found for ${yesterday}`);
      return { processed: 0, skipped: 0 };
    }

    let processed = 0;
    let skipped = 0;

    for (const dep of deposits) {
      try {
        // Idempotency check: skip if commission already issued for this deposit
        const existing = await dbGet(
          `SELECT id FROM referral_commissions
           WHERE referred_id = ? AND deposit_date = ? AND referrer_id = ?`,
          [dep.user_id, yesterday, dep.referrer_id]
        );
        if (existing) {
          console.log(`[ReferralJob] Skipping duplicate: referrer=${dep.referrer_id}, referred=${dep.user_id}, date=${yesterday}`);
          skipped++;
          continue;
        }

        // Fetch referrer details
        const referrer = await dbGet(
          `SELECT id, balance, invite_earnings, wager_requirement, risk_flag, banned, tg_id, tg_first_name, tg_username, username
           FROM users WHERE id = ?`,
          [dep.referrer_id]
        );

        if (!referrer) {
          console.log(`[ReferralJob] Referrer ${dep.referrer_id} not found, skipping`);
          skipped++;
          continue;
        }

        // Skip risk-flagged or banned referrers
        if (referrer.risk_flag || referrer.banned) {
          console.log(`[ReferralJob] Referrer ${dep.referrer_id} is flagged/banned, skipping`);
          skipped++;
          continue;
        }

        const commissionAmount = parseFloat((dep.deposit_amount * COMMISSION_RATE).toFixed(4));
        const wageringRequired = parseFloat((commissionAmount * WAGERING_MULTIPLIER).toFixed(4));

        // Insert commission record
        await dbRun(`
          INSERT INTO referral_commissions
            (referrer_id, referred_id, deposit_amount, commission_amount, status,
             wagering_required, wagering_completed, deposit_date, paid_at)
          VALUES (?, ?, ?, ?, 'paid', ?, 0, ?, datetime('now'))
        `, [dep.referrer_id, dep.user_id, dep.deposit_amount, commissionAmount, wageringRequired, yesterday]);

        // Credit balance + update invite_earnings + add wager requirement
        await dbRun(`
          UPDATE users
          SET balance = balance + ?,
              invite_earnings = invite_earnings + ?,
              wager_requirement = wager_requirement + ?
          WHERE id = ?
        `, [commissionAmount, commissionAmount, wageringRequired, dep.referrer_id]);

        // Log to balance_logs
        const referredName = dep.tg_first_name || dep.tg_username || dep.username || `user_${dep.user_id}`;
        await dbRun(`
          INSERT INTO balance_logs (user_id, type, amount, reason, wager_req, operator)
          VALUES (?, 'add', ?, ?, ?, 'system')
        `, [
          dep.referrer_id,
          commissionAmount,
          `分潤獎勵（${referredName} 消費點數 ${dep.deposit_amount} USDT · ${yesterday}）`,
          wageringRequired
        ]);

        // Send TG notification to referrer
        if (referrer.tg_id) {
          try {
            const axios = require("axios");
            const BOT_TOKEN = process.env.BOT_TOKEN || "8796143383:AAHkbw_msst7ps7lt__cRlBwn7yhp82mv1U";
            const referrerName = referrer.tg_first_name || referrer.tg_username || referrer.username;
            const msg = `💰 <b>分潤獎勵到帳！</b>\n\n👤 好友：${referredName}\n💳 消費點數：${dep.deposit_amount.toFixed(2)} USDT\n🎁 分潤獎勵（10%）：<b>${commissionAmount.toFixed(2)} USDT</b>\n🎯 流水要求：5 倍（${wageringRequired.toFixed(2)} USDT）\n\n繼續邀請好友，賺取更多分潤獎勵！🚀`;
            await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              params: { chat_id: referrer.tg_id, text: msg, parse_mode: "HTML" }
            }).catch(() => {});
          } catch (tgErr) {
            console.error("[ReferralJob] TG notify error:", tgErr.message);
          }
        }

        console.log(`[ReferralJob] Dispatched ${commissionAmount} USDT to referrer ${dep.referrer_id} for deposit by ${dep.user_id}`);
        processed++;
      } catch (depErr) {
        console.error(`[ReferralJob] Error processing deposit ${dep.deposit_id}:`, depErr.message);
        skipped++;
      }
    }

    console.log(`[ReferralJob] Done. Processed: ${processed}, Skipped: ${skipped}`);
    return { processed, skipped, date: yesterday };
  } catch (err) {
    console.error("[ReferralJob] Fatal error:", err.message);
    throw err;
  }
}

/**
 * Start the daily scheduler.
 * Runs at 01:00 server time every day.
 */
function startReferralCommissionScheduler() {
  console.log("[ReferralJob] Scheduler started — will run daily at 01:00");

  // Check every minute if it's time to run
  setInterval(async () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Run at 01:00 (hour=1, minute=0)
    if (hours === 1 && minutes === 0) {
      console.log("[ReferralJob] Triggering daily commission dispatch...");
      try {
        const result = await runReferralCommissionJob();
        console.log("[ReferralJob] Scheduler run complete:", result);
      } catch (err) {
        console.error("[ReferralJob] Scheduler run failed:", err.message);
      }
    }
  }, 60 * 1000); // check every minute
}

module.exports = { startReferralCommissionScheduler, runReferralCommissionJob };
