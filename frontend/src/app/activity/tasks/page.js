"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = "https://la1-backend-production.up.railway.app";

const TASK_DEFS = [
  { id: "bet_300", icon: "🎰", title: "今日投注達 300 USDT", desc: "完成 300 USDT 有效投注", reward: 2, target: 300, unit: "USDT", wager: 3 },
  { id: "bet_1000", icon: "💎", title: "今日投注達 1,000 USDT", desc: "完成 1,000 USDT 有效投注", reward: 5, target: 1000, unit: "USDT", wager: 3 },
  { id: "invite_1", icon: "👥", title: "邀請 1 位好友", desc: "成功邀請 1 位好友並完成首充", reward: 3, target: 1, unit: "人", wager: 3 },
];

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState(null);
  const [claiming, setClaiming] = useState({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("la1_token");
    if (token) {
      fetch(`${API}/promo/tasks`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setTasks(d)).catch(() => {});
    }
  }, []);

  async function claimTask(taskId) {
    const token = localStorage.getItem("la1_token");
    if (!token) { router.push("/login"); return; }
    setClaiming(prev => ({ ...prev, [taskId]: true }));
    const res = await fetch(`${API}/promo/claim-task`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg(`🎉 任務獎勵 +${data.reward} USDT 已到帳！`);
      setTasks(prev => ({ ...prev, [taskId]: { ...prev?.[taskId], claimed: true } }));
    } else {
      setMsg(data.error || "領取失敗");
    }
    setClaiming(prev => ({ ...prev, [taskId]: false }));
    setTimeout(() => setMsg(""), 4000);
  }

  const cardStyle = {
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,215,0,0.2)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "16px",
  };

  return (
    <div className="fade-in" style={{ padding: "16px", paddingBottom: "100px", maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "8px 14px", color: "#fff", cursor: "pointer", fontSize: "14px" }}>← 返回</button>
        <h1 style={{ fontSize: "20px", fontWeight: "bold", color: "#FFD700" }}>📋 任務中心</h1>
      </div>

      {msg && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.95)", border: "1px solid #FFD700", padding: "12px 24px", borderRadius: "12px", zIndex: 9999, color: "#FFD700", fontWeight: "bold", fontSize: "14px", maxWidth: "90vw", textAlign: "center" }}>{msg}</div>
      )}

      {/* Banner */}
      <div style={{ ...cardStyle, background: "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(0,191,255,0.08))", borderColor: "rgba(255,215,0,0.4)", textAlign: "center", padding: "24px 20px" }}>
        <div style={{ fontSize: "48px", marginBottom: "8px" }}>🎯</div>
        <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#FFD700", marginBottom: "4px" }}>每日任務</h2>
        <p style={{ color: "#aaa", fontSize: "13px" }}>完成任務領取獎勵，每日 00:00 重置</p>
      </div>

      {/* Task cards */}
      {TASK_DEFS.map((task) => {
        const taskData = tasks?.[task.id] || {};
        const progress = Math.min(taskData.progress || 0, task.target);
        const pct = Math.round((progress / task.target) * 100);
        const completed = pct >= 100;
        const claimed = taskData.claimed;

        return (
          <div key={task.id} style={{
            ...cardStyle,
            borderColor: claimed ? "rgba(255,255,255,0.08)" : completed ? "rgba(255,215,0,0.4)" : "rgba(255,215,0,0.15)",
            opacity: claimed ? 0.6 : 1,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{ fontSize: "32px" }}>{task.icon}</div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "bold", color: "#fff", marginBottom: "2px" }}>{task.title}</div>
                  <div style={{ fontSize: "12px", color: "#888" }}>{task.desc}</div>
                </div>
              </div>
              <div style={{ textAlign: "center", background: "rgba(255,215,0,0.1)", borderRadius: "10px", padding: "8px 12px", border: "1px solid rgba(255,215,0,0.3)", flexShrink: 0, marginLeft: "8px" }}>
                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#FFD700" }}>+{task.reward}U</div>
                <div style={{ fontSize: "10px", color: "#888" }}>{task.wager}倍流水</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#888", marginBottom: "4px" }}>
                <span>進度</span>
                <span>{progress.toLocaleString()} / {task.target.toLocaleString()} {task.unit}</span>
              </div>
              <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: completed ? "linear-gradient(90deg, #FFD700, #FFA500)" : "linear-gradient(90deg, #00BFFF, #1E90FF)", borderRadius: "3px", transition: "width 0.5s ease" }} />
              </div>
              <div style={{ fontSize: "11px", color: completed ? "#FFD700" : "#00BFFF", marginTop: "3px", textAlign: "right" }}>{pct}%</div>
            </div>

            <button
              onClick={() => claimTask(task.id)}
              disabled={!completed || claimed || claiming[task.id]}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                border: "none",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: (!completed || claimed) ? "default" : "pointer",
                background: claimed ? "rgba(255,255,255,0.05)" : completed ? "linear-gradient(135deg, #FFD700, #FFA500)" : "rgba(255,255,255,0.05)",
                color: claimed ? "#555" : completed ? "#000" : "#555",
              }}
            >
              {claimed ? "✅ 已領取" : claiming[task.id] ? "領取中..." : completed ? "🎁 領取獎勵" : `完成進度 ${pct}%`}
            </button>
          </div>
        );
      })}

      {/* Rules */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>📜 任務規則</h3>
        {[
          "任務每日 00:00（UTC+8）重置，需每日重新完成",
          "投注任務：計算當日所有遊戲的有效投注金額",
          "邀請任務：好友需通過您的邀請連結並完成首充",
          "所有任務獎勵需完成 3 倍流水後方可提款",
          "同一任務每日只能領取一次",
          "禁止刷流水、多帳號等違規行為，違規封號",
        ].map((rule, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px", fontSize: "13px", color: "#aaa", lineHeight: "1.5" }}>
            <span style={{ color: "#FFD700", flexShrink: 0 }}>•</span>
            <span>{rule}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
