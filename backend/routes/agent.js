/**
 * routes/agent.js — Agent-facing APIs
 *
 * All routes are prefixed with /agent and require user JWT auth.
 * When AGENT_SYSTEM_ENABLED is false, all endpoints return { enabled: false }.
 *
 * Endpoints:
 *   GET /agent/dashboard    — own stats (reward, ratio, status, referralCount)
 *   GET /agent/referrals    — list of referred users
 *   GET /agent/commissions  — commission history (limit 100)
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const { dbGet, dbAll } = require("../models/db");
const featureFlags = require("../config/featureFlags");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "la1_secret_2026";

// ── Auth helper (same logic as server.js auth()) ───────────────────────────
function agentAuth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return jwt.verify(token, JWT_SECRET);
}

// ── Feature gate middleware ────────────────────────────────────────────────
function requireAgentSystem(req, res, next) {
  if (!featureFlags.AGENT_SYSTEM_ENABLED) {
    return res.json({ enabled: false, message: "代理系統尚未啟用" });
  }
  next();
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /agent/dashboard — Agent's own stats
// ══════════════════════════════════════════════════════════════════════════════
router.get("/agent/dashboard", requireAgentSystem, async (req, res) => {
  try {
    const user = agentAuth(req);

    const agent = await dbGet("SELECT * FROM agents WHERE user_id = ?", [user.id]);
    if (!agent) {
      return res.status(404).json({ error: "您尚未成為代理" });
    }

    // Count referrals
    const refRow = await dbGet(
      "SELECT COUNT(*) as count FROM agent_relations WHERE parent_id = ?",
      [agent.id]
    );

    // Sum approved commissions (分潤獎勵)
    const rewardRow = await dbGet(
      "SELECT COALESCE(SUM(amount), 0) as total FROM agent_commissions WHERE agent_id = ? AND status = 'approved'",
      [agent.id]
    );

    res.json({
      enabled: true,
      data: {
        agentId: agent.id,
        userId: agent.user_id,
        ratio: agent.ratio,
        status: agent.status,
        referralCount: refRow ? refRow.count : 0,
        totalReward: rewardRow ? rewardRow.total : 0, // 分潤獎勵
        createdAt: agent.created_at,
      },
    });
  } catch (e) {
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") {
      return res.status(401).json({ error: "未授權" });
    }
    console.error("[Agent] dashboard error:", e.message);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /agent/referrals — List of referred users
// ══════════════════════════════════════════════════════════════════════════════
router.get("/agent/referrals", requireAgentSystem, async (req, res) => {
  try {
    const user = agentAuth(req);

    const agent = await dbGet("SELECT * FROM agents WHERE user_id = ?", [user.id]);
    if (!agent) {
      return res.status(404).json({ error: "您尚未成為代理" });
    }

    const referrals = await dbAll(
      `SELECT ar.child_id, ar.created_at as joined_at,
              u.username, u.tg_username,
              COALESCE(SUM(ac.amount), 0) as contribution
       FROM agent_relations ar
       LEFT JOIN users u ON u.id = (SELECT user_id FROM agents WHERE id = ar.child_id)
       LEFT JOIN agent_commissions ac ON ac.agent_id = ? AND ac.user_id = u.id AND ac.status = 'approved'
       WHERE ar.parent_id = ?
       GROUP BY ar.child_id
       ORDER BY ar.created_at DESC`,
      [agent.id, agent.id]
    );

    res.json({ enabled: true, data: referrals });
  } catch (e) {
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") {
      return res.status(401).json({ error: "未授權" });
    }
    console.error("[Agent] referrals error:", e.message);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /agent/commissions — Commission history (分潤獎勵紀錄)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/agent/commissions", requireAgentSystem, async (req, res) => {
  try {
    const user = agentAuth(req);

    const agent = await dbGet("SELECT * FROM agents WHERE user_id = ?", [user.id]);
    if (!agent) {
      return res.status(404).json({ error: "您尚未成為代理" });
    }

    const commissions = await dbAll(
      `SELECT ac.id, ac.user_id, ac.amount, ac.status, ac.risk_flag, ac.created_at,
              u.username, u.tg_username
       FROM agent_commissions ac
       LEFT JOIN users u ON u.id = ac.user_id
       WHERE ac.agent_id = ?
       ORDER BY ac.created_at DESC
       LIMIT 100`,
      [agent.id]
    );

    // Use "分潤獎勵" terminology in response
    res.json({
      enabled: true,
      label: "分潤獎勵紀錄",
      data: commissions,
    });
  } catch (e) {
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") {
      return res.status(401).json({ error: "未授權" });
    }
    console.error("[Agent] commissions error:", e.message);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

module.exports = router;
