/**
 * initAgentTables.js — Create agent-related tables (IF NOT EXISTS)
 *
 * 100% non-destructive: only creates tables if they don't already exist.
 * Does NOT modify the existing users table or any other existing tables.
 *
 * Tables created:
 *   1. agents          — agent profiles linked to users
 *   2. agent_relations  — parent-child referral tree
 *   3. agent_commissions — commission records per referred user action
 *   4. agent_daily_stats — daily aggregated settlement stats
 */

const { db } = require("./models/db");

function initAgentTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // ── 1. agents ────────────────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS agents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE NOT NULL,
          ratio REAL DEFAULT 0.1,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // ── 2. agent_relations ───────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS agent_relations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_id INTEGER NOT NULL,
          child_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // ── 3. agent_commissions ─────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS agent_commissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          status TEXT DEFAULT 'pending',
          risk_flag TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // ── 4. agent_daily_stats ─────────────────────────────────────────────
      db.run(
        `
        CREATE TABLE IF NOT EXISTS agent_daily_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_id INTEGER NOT NULL,
          total_amount REAL DEFAULT 0,
          status TEXT DEFAULT 'pending',
          date TEXT NOT NULL
        )
      `,
        (err) => {
          if (err) {
            console.error("[AgentTables] Error creating tables:", err.message);
            reject(err);
          } else {
            console.log("[AgentTables] All agent tables initialized (IF NOT EXISTS)");
            resolve();
          }
        }
      );
    });
  });
}

module.exports = initAgentTables;
