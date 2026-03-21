/**
 * routes/adminAgent.js — Admin APIs for Agent/Partner management
 *
 * All routes require admin JWT auth (ADMIN_JWT_SECRET).
 * Feature flag toggle is available even when AGENT_SYSTEM_ENABLED is false.
 *
 * Endpoints:
 *   GET    /admin/agents                      — list all agents
 *   POST   /admin/agents                      — create agent
 *   PUT    /admin/agents/:user_id             — update ratio/status
 *   GET    /admin/agents/:user_id/details     — agent detail with referrals & commissions
 *   GET    /admin/agents/settlements           — all settlement records
 *   POST   /admin/agents/settlements/:id/approve — approve flagged settlement
 *   POST   /admin/agents/settlements/:id/reject  — reject flagged settlement
 *   POST   /admin/agents/relations             — add referral relation manually
 *   POST   /admin/agents/toggle                — runtime feature flag toggle
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const { dbGet, dbAll, dbRun } = require("../models/db");
const featureFlags = require("../config/featureFlags");

const router = express.Router();

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "la1_admin_secret_2026";

// ── Admin auth helper (same logic as server.js adminAuth()) ────────────────
function adminAuth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  const payload = jwt.verify(token, ADMIN_JWT_SECRET);
  if (!payload.role) throw new Error("Not admin");
  return payload;
}

// ── Admin auth middleware ──────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  try {
    req.admin = adminAuth(req);
    next();
  } catch (e) {
    res.status(401).json({ error: "未授權" });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/agents/toggle — Runtime feature flag toggle
// ══════════════════════════════════════════════════════════════════════════════
router.post("/admin/agents/toggle", requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "請提供 enabled (boolean)" });
    }
    featureFlags.AGENT_SYSTEM_ENABLED = enabled;
    console.log(`[AdminAgent] Feature flag toggled: AGENT_SYSTEM_ENABLED = ${enabled} by admin ${req.admin.username || req.admin.id}`);
    res.json({
      ok: true,
      message: `代理系統已${enabled ? "啟用" : "停用"}`,
      AGENT_SYSTEM_ENABLED: featureFlags.AGENT_SYSTEM_ENABLED,
    });
  } catch (e) {
    console.error("[AdminAgent] toggle error:", e.message);
    res.status(500).json({ error: "操作失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/agents — List all agents with referral_count and total_reward
// ══════════════════════════════════════════════════════════════════════════════
router.get("/admin/agents", requireAdmin, async (req, res) => {
  try {
    const agents = await dbAll(`
      SELECT a.*,
             u.username, u.tg_username, u.balance,
             (SELECT COUNT(*) FROM agent_relations WHERE parent_id = a.id) as referral_count,
             (SELECT COALESCE(SUM(amount), 0) FROM agent_commissions WHERE agent_id = a.id AND status = 'approved') as total_reward
      FROM agents a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
    `);
    res.json({ ok: true, data: agents });
  } catch (e) {
    console.error("[AdminAgent] list error:", e.message);
    res.status(500).json({ error: "查詢失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/agents — Create agent (user_id, ratio 10%-30%)
// ══════════════════════════════════════════════════════════════════════════════
router.post("/admin/agents", requireAdmin, async (req, res) => {
  try {
    const { user_id, ratio } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "缺少 user_id" });
    }

    // Validate ratio: must be between 0.1 (10%) and 0.3 (30%)
    const agentRatio = ratio !== undefined ? parseFloat(ratio) : 0.1;
    if (isNaN(agentRatio) || agentRatio < 0.1 || agentRatio > 0.3) {
      return res.status(400).json({ error: "分潤比例必須在 10%~30% 之間 (0.1~0.3)" });
    }

    // Check user exists
    const user = await dbGet("SELECT id, username FROM users WHERE id = ?", [user_id]);
    if (!user) {
      return res.status(404).json({ error: "找不到該用戶" });
    }

    // Check if already an agent
    const existing = await dbGet("SELECT id FROM agents WHERE user_id = ?", [user_id]);
    if (existing) {
      return res.status(409).json({ error: "該用戶已是代理" });
    }

    // Create agent
    await dbRun(
      "INSERT INTO agents (user_id, ratio) VALUES (?, ?)",
      [user_id, agentRatio]
    );

    // Also set is_agent flag on users table (existing column)
    await dbRun("UPDATE users SET is_agent = 1 WHERE id = ?", [user_id]);

    console.log(`[AdminAgent] Agent created: user_id=${user_id}, ratio=${agentRatio} by admin ${req.admin.username || req.admin.id}`);
    res.json({ ok: true, message: "代理已建立", user_id, ratio: agentRatio });
  } catch (e) {
    console.error("[AdminAgent] create error:", e.message);
    res.status(500).json({ error: "建立失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /admin/agents/:user_id — Update ratio/status
// ══════════════════════════════════════════════════════════════════════════════
router.put("/admin/agents/:user_id", requireAdmin, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { ratio, status } = req.body;

    const agent = await dbGet("SELECT * FROM agents WHERE user_id = ?", [user_id]);
    if (!agent) {
      return res.status(404).json({ error: "找不到該代理" });
    }

    const updates = [];
    const params = [];

    if (ratio !== undefined) {
      const newRatio = parseFloat(ratio);
      if (isNaN(newRatio) || newRatio < 0.1 || newRatio > 0.3) {
        return res.status(400).json({ error: "分潤比例必須在 10%~30% 之間 (0.1~0.3)" });
      }
      updates.push("ratio = ?");
      params.push(newRatio);
    }

    if (status !== undefined) {
      if (!["active", "suspended", "disabled"].includes(status)) {
        return res.status(400).json({ error: "狀態必須為 active/suspended/disabled" });
      }
      updates.push("status = ?");
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "請提供要更新的欄位 (ratio/status)" });
    }

    params.push(user_id);
    await dbRun(`UPDATE agents SET ${updates.join(", ")} WHERE user_id = ?`, params);

    console.log(`[AdminAgent] Agent updated: user_id=${user_id}, changes=${JSON.stringify(req.body)} by admin ${req.admin.username || req.admin.id}`);
    res.json({ ok: true, message: "代理已更新" });
  } catch (e) {
    console.error("[AdminAgent] update error:", e.message);
    res.status(500).json({ error: "更新失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/agents/:user_id/details — Agent detail with referrals & commissions
// ══════════════════════════════════════════════════════════════════════════════
router.get("/admin/agents/:user_id/details", requireAdmin, async (req, res) => {
  try {
    const { user_id } = req.params;

    const agent = await dbGet(
      `SELECT a.*, u.username, u.tg_username, u.balance
       FROM agents a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.user_id = ?`,
      [user_id]
    );
    if (!agent) {
      return res.status(404).json({ error: "找不到該代理" });
    }

    // Referrals
    const referrals = await dbAll(
      `SELECT ar.child_id, ar.created_at as joined_at, u.username, u.tg_username
       FROM agent_relations ar
       LEFT JOIN users u ON u.id = ar.child_id
       WHERE ar.parent_id = ?
       ORDER BY ar.created_at DESC`,
      [agent.id]
    );

    // Commissions (分潤獎勵)
    const commissions = await dbAll(
      `SELECT ac.*, u.username, u.tg_username
       FROM agent_commissions ac
       LEFT JOIN users u ON u.id = ac.user_id
       WHERE ac.agent_id = ?
       ORDER BY ac.created_at DESC
       LIMIT 200`,
      [agent.id]
    );

    // Summary stats
    const stats = await dbGet(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as total_approved,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending,
         COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END), 0) as total_rejected,
         COUNT(*) as total_records
       FROM agent_commissions WHERE agent_id = ?`,
      [agent.id]
    );

    res.json({
      ok: true,
      data: {
        agent,
        referrals,
        commissions,
        summary: stats,
      },
    });
  } catch (e) {
    console.error("[AdminAgent] details error:", e.message);
    res.status(500).json({ error: "查詢失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /admin/agents/settlements — All settlement records (agent_daily_stats)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/admin/agents/settlements", requireAdmin, async (req, res) => {
  try {
    const settlements = await dbAll(`
      SELECT ads.*, a.user_id, u.username, u.tg_username
      FROM agent_daily_stats ads
      LEFT JOIN agents a ON a.id = ads.agent_id
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY ads.date DESC, ads.id DESC
      LIMIT 500
    `);
    res.json({ ok: true, data: settlements });
  } catch (e) {
    console.error("[AdminAgent] settlements error:", e.message);
    res.status(500).json({ error: "查詢失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/agents/settlements/:id/approve — Approve flagged settlement
// ══════════════════════════════════════════════════════════════════════════════
router.post("/admin/agents/settlements/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const commission = await dbGet("SELECT * FROM agent_commissions WHERE id = ? AND status = 'manual_review'", [id]);
    if (!commission) {
      return res.status(404).json({ error: "找不到該待審核記錄" });
    }

    // Approve the commission
    await dbRun("UPDATE agent_commissions SET status = 'approved' WHERE id = ?", [id]);

    // Credit the agent's user balance
    const agent = await dbGet("SELECT user_id FROM agents WHERE id = ?", [commission.agent_id]);
    if (agent) {
      await dbRun("UPDATE users SET balance = balance + ? WHERE id = ?", [commission.amount, agent.user_id]);
      // Log the balance change
      await dbRun(
        "INSERT INTO balance_logs (user_id, type, amount, reason, operator) VALUES (?, ?, ?, ?, ?)",
        [agent.user_id, "agent_commission", commission.amount, `分潤獎勵 #${id} 審核通過`, `admin:${req.admin.username || req.admin.id}`]
      );
    }

    console.log(`[AdminAgent] Settlement #${id} approved by admin ${req.admin.username || req.admin.id}`);
    res.json({ ok: true, message: "已核准並發放分潤獎勵" });
  } catch (e) {
    console.error("[AdminAgent] approve error:", e.message);
    res.status(500).json({ error: "操作失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/agents/settlements/:id/reject — Reject flagged settlement
// ══════════════════════════════════════════════════════════════════════════════
router.post("/admin/agents/settlements/:id/reject", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const commission = await dbGet(
      "SELECT * FROM agent_commissions WHERE id = ? AND status IN ('manual_review', 'pending')",
      [id]
    );
    if (!commission) {
      return res.status(404).json({ error: "找不到該待審核記錄" });
    }

    await dbRun("UPDATE agent_commissions SET status = 'rejected', risk_flag = ? WHERE id = ?", [
      reason || "admin_rejected",
      id,
    ]);

    console.log(`[AdminAgent] Settlement #${id} rejected by admin ${req.admin.username || req.admin.id}`);
    res.json({ ok: true, message: "已拒絕該分潤記錄" });
  } catch (e) {
    console.error("[AdminAgent] reject error:", e.message);
    res.status(500).json({ error: "操作失敗" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /admin/agents/relations — Add referral relation manually
// ══════════════════════════════════════════════════════════════════════════════
router.post("/admin/agents/relations", requireAdmin, async (req, res) => {
  try {
    const { parent_user_id, child_user_id } = req.body;

    if (!parent_user_id || !child_user_id) {
      return res.status(400).json({ error: "缺少 parent_user_id 或 child_user_id" });
    }

    if (parent_user_id === child_user_id) {
      return res.status(400).json({ error: "不能將自己設為推薦人" });
    }

    // Find parent agent
    const parentAgent = await dbGet("SELECT id FROM agents WHERE user_id = ?", [parent_user_id]);
    if (!parentAgent) {
      return res.status(404).json({ error: "上級代理不存在" });
    }

    // Check child user exists
    const childUser = await dbGet("SELECT id FROM users WHERE id = ?", [child_user_id]);
    if (!childUser) {
      return res.status(404).json({ error: "下級用戶不存在" });
    }

    // Check if relation already exists
    const existing = await dbGet(
      "SELECT id FROM agent_relations WHERE parent_id = ? AND child_id = ?",
      [parentAgent.id, child_user_id]
    );
    if (existing) {
      return res.status(409).json({ error: "推薦關係已存在" });
    }

    await dbRun(
      "INSERT INTO agent_relations (parent_id, child_id) VALUES (?, ?)",
      [parentAgent.id, child_user_id]
    );

    console.log(`[AdminAgent] Relation added: agent ${parentAgent.id} -> user ${child_user_id} by admin ${req.admin.username || req.admin.id}`);
    res.json({ ok: true, message: "推薦關係已建立" });
  } catch (e) {
    console.error("[AdminAgent] relation error:", e.message);
    res.status(500).json({ error: "操作失敗" });
  }
});

module.exports = router;
