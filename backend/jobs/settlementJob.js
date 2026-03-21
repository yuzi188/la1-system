/**
 * jobs/settlementJob.js — Automated Agent Commission Settlement
 *
 * Runs on an hourly scheduler but only executes at 3 AM (server time).
 * Processes pending commissions with AI-style risk review:
 *   - same_ip       → auto reject
 *   - abnormal_ratio / spike → manual_review (admin must approve)
 *   - normal        → auto approve + credit balance
 *
 * Anti-duplicate: uses isRunning lock to prevent concurrent execution.
 * Respects AGENT_SYSTEM_ENABLED feature flag.
 */

const { dbAll, dbGet, dbRun } = require("../models/db");
const featureFlags = require("../config/featureFlags");

let isRunning = false;

// ── AI Review Logic ────────────────────────────────────────────────────────
// Simulates risk assessment for each pending commission
async function reviewCommission(commission) {
  // Rule 1: same_ip — if agent and referred user share IP pattern → reject
  if (commission.risk_flag === "same_ip") {
    return { action: "reject", reason: "same_ip" };
  }

  // Rule 2: abnormal_ratio — commission amount seems abnormally high
  // Check if this commission is > 3x the agent's average
  const avgRow = await dbGet(
    `SELECT AVG(amount) as avg_amount FROM agent_commissions
     WHERE agent_id = ? AND status = 'approved' AND id != ?`,
    [commission.agent_id, commission.id]
  );

  if (avgRow && avgRow.avg_amount && commission.amount > avgRow.avg_amount * 3) {
    return { action: "manual_review", reason: "abnormal_ratio" };
  }

  // Rule 3: spike — check if agent has > 10 pending commissions today (unusual spike)
  const today = new Date().toISOString().split("T")[0];
  const spikeRow = await dbGet(
    `SELECT COUNT(*) as count FROM agent_commissions
     WHERE agent_id = ? AND status = 'pending' AND date(created_at) = ?`,
    [commission.agent_id, today]
  );

  if (spikeRow && spikeRow.count > 10) {
    return { action: "manual_review", reason: "spike" };
  }

  // Rule 4: normal → approve
  return { action: "approve", reason: "normal" };
}

// ── Main Settlement Process ────────────────────────────────────────────────
async function runSettlement() {
  if (isRunning) {
    console.log("[Settlement] Already running, skipping...");
    return;
  }

  if (!featureFlags.AGENT_SYSTEM_ENABLED) {
    console.log("[Settlement] Agent system disabled, skipping...");
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  console.log("[Settlement] Starting settlement process...");

  try {
    // Get all pending commissions
    const pendingCommissions = await dbAll(
      "SELECT * FROM agent_commissions WHERE status = 'pending' ORDER BY created_at ASC"
    );

    if (pendingCommissions.length === 0) {
      console.log("[Settlement] No pending commissions to process.");
      return;
    }

    let approved = 0;
    let rejected = 0;
    let flagged = 0;

    for (const commission of pendingCommissions) {
      try {
        const review = await reviewCommission(commission);

        if (review.action === "approve") {
          // Auto approve and credit balance
          await dbRun("UPDATE agent_commissions SET status = 'approved', risk_flag = ? WHERE id = ?", [
            review.reason,
            commission.id,
          ]);

          // Credit agent's user balance
          const agent = await dbGet("SELECT user_id FROM agents WHERE id = ?", [commission.agent_id]);
          if (agent) {
            await dbRun("UPDATE users SET balance = balance + ? WHERE id = ?", [
              commission.amount,
              agent.user_id,
            ]);
            // Log the balance change
            await dbRun(
              "INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, ?, ?, ?, ?)",
              [agent.user_id, "agent_commission", commission.amount, `分潤獎勵自動結算 #${commission.id}`, "system:settlement"]
            );
          }
          approved++;
        } else if (review.action === "reject") {
          await dbRun("UPDATE agent_commissions SET status = 'rejected', risk_flag = ? WHERE id = ?", [
            review.reason,
            commission.id,
          ]);
          rejected++;
        } else if (review.action === "manual_review") {
          await dbRun("UPDATE agent_commissions SET status = 'manual_review', risk_flag = ? WHERE id = ?", [
            review.reason,
            commission.id,
          ]);
          flagged++;
        }
      } catch (commErr) {
        // One commission failure must not affect others
        console.error(`[Settlement] Error processing commission #${commission.id}:`, commErr.message);
      }
    }

    // Write daily stats for each agent
    const today = new Date().toISOString().split("T")[0];
    const agentIds = [...new Set(pendingCommissions.map((c) => c.agent_id))];

    for (const agentId of agentIds) {
      try {
        const dayTotal = await dbGet(
          `SELECT COALESCE(SUM(amount), 0) as total
           FROM agent_commissions
           WHERE agent_id = ? AND date(created_at) = ? AND status = 'approved'`,
          [agentId, today]
        );

        // Upsert daily stats
        const existing = await dbGet(
          "SELECT id FROM agent_daily_stats WHERE agent_id = ? AND date = ?",
          [agentId, today]
        );

        if (existing) {
          await dbRun(
            "UPDATE agent_daily_stats SET total_amount = ?, status = 'settled' WHERE id = ?",
            [dayTotal.total, existing.id]
          );
        } else {
          await dbRun(
            "INSERT INTO agent_daily_stats (agent_id, total_amount, status, date) VALUES (?, ?, ?, ?)",
            [agentId, dayTotal.total, "settled", today]
          );
        }
      } catch (statsErr) {
        console.error(`[Settlement] Error writing daily stats for agent #${agentId}:`, statsErr.message);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[Settlement] Done — approved: ${approved}, rejected: ${rejected}, flagged: ${flagged}, total: ${pendingCommissions.length}, time: ${elapsed}s`
    );
  } catch (err) {
    console.error("[Settlement] Fatal error:", err);
  } finally {
    isRunning = false;
  }
}

// ── Scheduler ──────────────────────────────────────────────────────────────
// Runs every hour, but only executes settlement at 3 AM
function startSettlementScheduler() {
  console.log("[Settlement] Scheduler started — checks hourly, executes at 3 AM");

  // Check every hour
  setInterval(() => {
    const now = new Date();
    const hour = now.getHours();

    if (hour === 3) {
      console.log("[Settlement] 3 AM — triggering settlement...");
      runSettlement();
    }
  }, 60 * 60 * 1000);
}

module.exports = { startSettlementScheduler, runSettlement };
