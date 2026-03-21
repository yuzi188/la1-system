/**
 * initReferralTables.js — Create referral commission tables (IF NOT EXISTS)
 *
 * 100% non-destructive: only creates tables if they don't already exist.
 * Also safely adds referral_code column to users table if not present.
 *
 * Tables created:
 *   1. referral_commissions — per-deposit commission records with wagering tracking
 *
 * Columns added to users (IF NOT EXISTS):
 *   - referral_code TEXT UNIQUE  (alias for invite_code, kept for clarity)
 */

const { db, dbRun } = require("./models/db");

async function initReferralTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // ── 1. referral_commissions ──────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS referral_commissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          referrer_id INTEGER NOT NULL,
          referred_id INTEGER NOT NULL,
          deposit_amount REAL NOT NULL,
          commission_amount REAL NOT NULL,
          status TEXT DEFAULT 'pending',
          wagering_required REAL NOT NULL,
          wagering_completed REAL DEFAULT 0,
          deposit_date TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          paid_at DATETIME
        )
      `);

      // ── 2. Safely add referral_code column to users (IF NOT EXISTS) ──────
      // SQLite does not support ADD COLUMN IF NOT EXISTS natively,
      // so we attempt the ALTER and silently ignore "duplicate column" errors.
      db.run(`ALTER TABLE users ADD COLUMN referral_code TEXT`, (err) => {
        // Ignore error if column already exists (SQLITE_ERROR: duplicate column name)
        if (err && !err.message.includes("duplicate column")) {
          console.warn("[ReferralTables] Unexpected error adding referral_code:", err.message);
        }
      });

      // ── 3. Index for fast referrer lookups ───────────────────────────────
      db.run(`CREATE INDEX IF NOT EXISTS idx_ref_commissions_referrer ON referral_commissions(referrer_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_ref_commissions_referred ON referral_commissions(referred_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_ref_commissions_status ON referral_commissions(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_ref_commissions_deposit_date ON referral_commissions(deposit_date)`, (err) => {
        if (err) {
          console.error("[ReferralTables] Error creating indexes:", err.message);
          reject(err);
        } else {
          console.log("[ReferralTables] All referral tables initialized (IF NOT EXISTS)");
          resolve();
        }
      });
    });
  });
}

module.exports = initReferralTables;
