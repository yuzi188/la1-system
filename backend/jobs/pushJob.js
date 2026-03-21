/**
 * jobs/pushJob.js — Hourly automated push job
 *
 * Runs every hour via setInterval. For each active user:
 *   1. Reset daily push count if new day (Feature #3)
 *   2. Segment the user (segmentService)
 *   3. Evaluate trigger with priority (triggerService — Feature #7)
 *   4. Check 6-hour cooldown (Feature #5)
 *   5. Resolve message template from DB (Feature #6)
 *   6. Send via TG with try/catch (Feature #4)
 *   7. Update push tracking columns
 */

const { getAllUsers, incrementPushCount, resetDailyPushCounts, dbRun } = require("../models/db");
const { segmentUser } = require("../services/segmentService");
const { evaluateTrigger } = require("../services/triggerService");
const { resolveTemplate } = require("../services/messageService");
const { sendTGToUser } = require("../services/pushService");

const MAX_DAILY_PUSH = 3; // max pushes per user per day

async function runPushJob() {
  const startTime = Date.now();
  console.log("[PushJob] Starting push scan...");

  try {
    // Feature #3: reset daily counts at the start of each run
    await resetDailyPushCounts();

    const users = await getAllUsers(true); // active, non-opted-out, non-banned
    let sent = 0;
    let skipped = 0;

    for (const user of users) {
      try {
        // Skip users without TG id (can't push)
        if (!user.tg_id) {
          skipped++;
          continue;
        }

        // Skip if daily push limit reached
        if ((user.daily_push_count || 0) >= MAX_DAILY_PUSH) {
          skipped++;
          continue;
        }

        // Step 1: Segment
        const segment = segmentUser(user);

        // Step 2: Evaluate trigger (includes priority + cooldown logic)
        const triggerName = evaluateTrigger(user, segment);
        if (!triggerName) {
          skipped++;
          continue;
        }

        // Step 3: Resolve message template
        const message = await resolveTemplate(triggerName, "zh", user);

        // Step 4: Send via TG (try/catch inside sendTGToUser)
        const success = await sendTGToUser(user.tg_id, message);

        if (success) {
          // Step 5: Update tracking
          await incrementPushCount(user.id);
          await dbRun(
            "UPDATE users SET last_trigger = ?, last_push_at = datetime('now') WHERE id = ?",
            [triggerName, user.id]
          );
          sent++;
        } else {
          skipped++;
        }
      } catch (userErr) {
        // Feature #4: one user failure must not affect others
        console.error(`[PushJob] Error processing user ${user.id}:`, userErr.message);
        skipped++;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[PushJob] Done — sent: ${sent}, skipped: ${skipped}, total users: ${users.length}, time: ${elapsed}s`);
  } catch (err) {
    console.error("[PushJob] Fatal error:", err);
  }
}

/**
 * Start the push job on a 1-hour interval.
 * Also runs once immediately after a short delay (30 s) to allow DB init.
 */
function startPushJob() {
  console.log("[PushJob] Scheduled — every 1 hour");

  // First run after 30 seconds (give DB time to init schema)
  setTimeout(() => {
    runPushJob();
  }, 30 * 1000);

  // Then every hour
  setInterval(() => {
    runPushJob();
  }, 60 * 60 * 1000);
}

module.exports = { startPushJob, runPushJob };
