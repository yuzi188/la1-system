"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = "https://la1-backend-production.up.railway.app";

const CHECKIN_REWARDS = [
  { day: 1, reward: 0.5, label: "Day 1" },
  { day: 2, reward: 0.5, label: "Day 2" },
  { day: 3, reward: 1.0, label: "Day 3" },
  { day: 4, reward: 1.0, label: "Day 4" },
  { day: 5, reward: 1.5, label: "Day 5" },
  { day: 6, reward: 1.5, label: "Day 6" },
  { day: 7, reward: 3.0, label: "Day 7 🎁" },
];

export default function CheckinPage() {
  const router = useRouter();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("la1_token");
    if (token) {
      fetch(`${API}/promo/checkin-status`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setStatus(d)).catch(() => {});
    }
  }, []);

  async function doCheckin() {
    const token = localStorage.getItem("la1_token");
    if (!token) { router.push("/login"); return; }
    setLoading(true);
    const res = await fetch(`${API}/promo/checkin`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (data.ok) {
      setMsg(`🎉 簽到成功！獲得 ${data.reward} USDT（2倍流水後可提款）`);
      setStatus(prev => ({ ...prev, checked_today: true, streak: (prev?.streak || 0) + 1 }));
    } else {
      setMsg(data.error || "今日已簽到");
    }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  }

  const cardStyle = {
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,215,0,0.2)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "16px",
  };

  const streak = status?.streak || 0;

  return (
    <div className="fade-in" style={{ padding: "16px", paddingBottom: "100px", maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "8px 14px", color: "#fff", cursor: "pointer", fontSize: "14px" }}>← 返回</button>
        <h1 style={{ fontSize: "20px", fontWeight: "bold", color: "#FFD700" }}>📅 每日簽到</h1>
      </div>

      {msg && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.95)", border: "1px solid #FFD700", padding: "12px 24px", borderRadius: "12px", zIndex: 9999, color: "#FFD700", fontWeight: "bold", fontSize: "14px", maxWidth: "90vw", textAlign: "center" }}>{msg}</div>
      )}

      {/* Banner */}
      <div style={{ ...cardStyle, background: "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(0,191,255,0.08))", borderColor: "rgba(255,215,0,0.4)", textAlign: "center", padding: "24px 20px" }}>
        <div style={{ fontSize: "48px", marginBottom: "8px" }}>🗓️</div>
        <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#FFD700", marginBottom: "4px" }}>連續簽到 7 天</h2>
        <p style={{ color: "#aaa", fontSize: "13px" }}>最高獎勵 3 USDT，累計最多 9 USDT</p>
        {status && (
          <div style={{ marginTop: "12px", background: "rgba(255,215,0,0.1)", borderRadius: "10px", padding: "8px 16px", display: "inline-block" }}>
            <span style={{ color: "#FFD700", fontWeight: "bold" }}>🔥 已連續簽到 {streak} 天</span>
          </div>
        )}
      </div>

      {/* 7-day grid */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "15px", fontWeight: "bold", color: "#FFD700", marginBottom: "14px" }}>7 天獎勵一覽</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "8px" }}>
          {CHECKIN_REWARDS.slice(0, 4).map((item) => {
            const done = streak >= item.day;
            const isToday = streak + 1 === item.day && !status?.checked_today;
            return (
              <div key={item.day} style={{
                textAlign: "center",
                background: done ? "rgba(255,215,0,0.15)" : isToday ? "rgba(0,191,255,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${done ? "rgba(255,215,0,0.5)" : isToday ? "rgba(0,191,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: "12px",
                padding: "12px 6px",
              }}>
                <div style={{ fontSize: "18px", marginBottom: "4px" }}>{done ? "✅" : isToday ? "⭐" : "🎁"}</div>
                <div style={{ fontSize: "11px", color: done ? "#FFD700" : isToday ? "#00BFFF" : "#888", fontWeight: "bold" }}>{item.label}</div>
                <div style={{ fontSize: "13px", fontWeight: "bold", color: done ? "#FFD700" : "#fff" }}>{item.reward}U</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
          {CHECKIN_REWARDS.slice(4, 6).map((item) => {
            const done = streak >= item.day;
            const isToday = streak + 1 === item.day && !status?.checked_today;
            return (
              <div key={item.day} style={{
                textAlign: "center",
                background: done ? "rgba(255,215,0,0.15)" : isToday ? "rgba(0,191,255,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${done ? "rgba(255,215,0,0.5)" : isToday ? "rgba(0,191,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: "12px",
                padding: "12px 6px",
              }}>
                <div style={{ fontSize: "18px", marginBottom: "4px" }}>{done ? "✅" : isToday ? "⭐" : "🎁"}</div>
                <div style={{ fontSize: "11px", color: done ? "#FFD700" : isToday ? "#00BFFF" : "#888", fontWeight: "bold" }}>{item.label}</div>
                <div style={{ fontSize: "13px", fontWeight: "bold", color: done ? "#FFD700" : "#fff" }}>{item.reward}U</div>
              </div>
            );
          })}
          {/* Day 7 special */}
          {(() => {
            const item = CHECKIN_REWARDS[6];
            const done = streak >= item.day;
            const isToday = streak + 1 === item.day && !status?.checked_today;
            return (
              <div style={{
                textAlign: "center",
                background: done ? "rgba(255,215,0,0.2)" : isToday ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.03)",
                border: `2px solid ${done ? "#FFD700" : isToday ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: "12px",
                padding: "12px 6px",
                boxShadow: done || isToday ? "0 0 15px rgba(255,215,0,0.3)" : "none",
              }}>
                <div style={{ fontSize: "20px", marginBottom: "4px" }}>{done ? "✅" : "🏆"}</div>
                <div style={{ fontSize: "11px", color: "#FFD700", fontWeight: "bold" }}>Day 7</div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700" }}>3U</div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Check-in button */}
      <button
        onClick={doCheckin}
        disabled={loading || status?.checked_today}
        style={{
          width: "100%",
          padding: "16px",
          borderRadius: "12px",
          border: "none",
          fontWeight: "bold",
          fontSize: "16px",
          cursor: (loading || status?.checked_today) ? "default" : "pointer",
          background: status?.checked_today ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #FFD700, #FFA500)",
          color: status?.checked_today ? "#555" : "#000",
          marginBottom: "16px",
          boxShadow: status?.checked_today ? "none" : "0 4px 20px rgba(255,215,0,0.3)",
        }}
      >
        {loading ? "簽到中..." : status?.checked_today ? "✅ 今日已簽到" : `📅 立即簽到（第 ${streak + 1} 天）`}
      </button>

      {/* Rules */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>📜 簽到規則</h3>
        {[
          "每日 00:00（UTC+8）重置，可進行當日簽到",
          "必須連續簽到才算，中斷後從第 1 天重新開始",
          "簽到獎勵需完成 2 倍流水後方可提款",
          "7 天連續簽到完成後，第 8 天從第 1 天重新開始",
          "每個帳號每日只能簽到一次",
          "禁止多帳號重複領取，違規帳號將被封禁",
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
