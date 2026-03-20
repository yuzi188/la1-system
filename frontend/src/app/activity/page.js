"use client";
// v2.1 - Added detail page links + forced rebuild
import { useState, useEffect } from "react";
import Link from "next/link";

const API = "https://la1-backend-production.up.railway.app";
const CHECKIN_REWARDS = [0.5, 0.5, 1, 1, 1.5, 1.5, 3];

const ACTIVITIES = [
  {
    id: "first-deposit",
    icon: "🎁",
    title: "首充豪禮",
    subtitle: "充 100 送 38 · 充 30 送 10",
    desc: "新會員專屬，首次儲值即享豐厚獎勵",
    badge: "HOT",
    badgeColor: "#FF4500",
    gradient: "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,69,0,0.08))",
    border: "rgba(255,215,0,0.4)",
  },
  {
    id: "vip",
    icon: "👑",
    title: "VIP 專屬待遇",
    subtitle: "VIP1~VIP5 · 最高返水 1.8%",
    desc: "累計投注自動升級，享受頂級 VIP 專屬權益",
    badge: "VIP",
    badgeColor: "#FFD700",
    gradient: "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(0,191,255,0.06))",
    border: "rgba(255,215,0,0.3)",
  },
  {
    id: "referral",
    icon: "🤝",
    title: "邀請返傭",
    subtitle: "直推 15% · 二級 3%",
    desc: "邀請好友永久佣金，無上限無時限",
    badge: "永久",
    badgeColor: "#00BFFF",
    gradient: "linear-gradient(135deg, rgba(0,191,255,0.12), rgba(30,144,255,0.06))",
    border: "rgba(0,191,255,0.3)",
  },
  {
    id: "checkin",
    icon: "📅",
    title: "每日簽到",
    subtitle: "連續 7 天 · 最高 3 USDT",
    desc: "每日簽到獎勵遞增，第 7 天獲得 3 USDT",
    badge: "每日",
    badgeColor: "#00BFFF",
    gradient: "linear-gradient(135deg, rgba(0,191,255,0.1), rgba(255,215,0,0.06))",
    border: "rgba(0,191,255,0.25)",
  },
  {
    id: "tasks",
    icon: "🎯",
    title: "任務中心",
    subtitle: "投注任務 · 邀請任務",
    desc: "完成任務領取獎勵，最高單次 5 USDT",
    badge: "每日",
    badgeColor: "#FFD700",
    gradient: "linear-gradient(135deg, rgba(255,215,0,0.1), rgba(0,191,255,0.06))",
    border: "rgba(255,215,0,0.25)",
  },
  {
    id: "weekend",
    icon: "🎊",
    title: "週末狂歡",
    subtitle: "週六日返水 +30%",
    desc: "VIP2+ 會員週末投注返水額外加碼 30%",
    badge: "週末",
    badgeColor: "#FF8C00",
    gradient: "linear-gradient(135deg, rgba(255,140,0,0.12), rgba(255,215,0,0.06))",
    border: "rgba(255,140,0,0.3)",
  },
];

export default function ActivityPage() {
  const [token, setToken] = useState(null);
  const [summary, setSummary] = useState(null);
  const [checkinStatus, setCheckinStatus] = useState(null);
  const [vip, setVip] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("la1_token");
    setToken(t);
    if (t) {
      const headers = { Authorization: `Bearer ${t}` };
      Promise.all([
        fetch(`${API}/promo/summary`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`${API}/promo/checkin-status`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API}/promo/vip-info`, { headers }).then(r => r.json()).catch(() => null),
      ]).then(([s, c, v]) => { setSummary(s); setCheckinStatus(c); setVip(v); });
    }
  }, []);

  async function quickCheckin(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!token) { window.location.href = "/login"; return; }
    const res = await fetch(`${API}/promo/checkin`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const data = await res.json();
    if (data.ok) { setMsg(`✅ 簽到成功！+${data.reward} USDT`); setCheckinStatus(prev => ({ ...prev, checkedToday: true })); }
    else setMsg(data.error || "今日已簽到");
    setTimeout(() => setMsg(""), 3000);
  }

  const cardStyle = {
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,215,0,0.2)",
    borderRadius: "16px",
    padding: "0",
    marginBottom: "12px",
    overflow: "hidden",
    boxShadow: "0 0 20px rgba(0,191,255,0.06)",
    position: "relative",
  };

  return (
    <div className="fade-in" style={{ padding: "16px", paddingBottom: "100px", maxWidth: "480px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "22px", fontWeight: "bold", textAlign: "center", color: "#FFD700", marginBottom: "6px" }}>
        🔥 活動中心
      </h1>
      <p style={{ textAlign: "center", color: "#888", fontSize: "13px", marginBottom: "20px" }}>點擊活動查看完整規則與說明</p>

      {msg && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.95)", border: "1px solid #FFD700", padding: "12px 24px", borderRadius: "12px", zIndex: 9999, color: "#FFD700", fontWeight: "bold", fontSize: "14px", maxWidth: "90vw", textAlign: "center" }}>
          {msg}
        </div>
      )}

      {/* Activity Cards */}
      {ACTIVITIES.map((act) => (
        <Link key={act.id} href={`/activity/${act.id}`} style={{ textDecoration: "none", display: "block" }}>
          <div style={{ ...cardStyle, border: `1px solid ${act.border}` }}>
            {/* Top gradient bar */}
            <div style={{ height: "3px", background: act.gradient.replace("rgba", "").includes("FFD700") ? "linear-gradient(90deg, #FFD700, #00BFFF)" : "linear-gradient(90deg, #00BFFF, #FFD700)" }} />
            <div style={{ padding: "16px", background: act.gradient }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", flex: 1 }}>
                  <div style={{ fontSize: "36px", lineHeight: 1 }}>{act.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                      <span style={{ fontSize: "16px", fontWeight: "bold", color: "#fff" }}>{act.title}</span>
                      <span style={{ background: act.badgeColor, color: "#000", fontSize: "10px", padding: "2px 7px", borderRadius: "10px", fontWeight: "bold" }}>{act.badge}</span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#FFD700", fontWeight: "bold", marginBottom: "3px" }}>{act.subtitle}</div>
                    <div style={{ fontSize: "12px", color: "#888" }}>{act.desc}</div>
                  </div>
                </div>
                <div style={{ color: "#FFD700", fontSize: "18px", marginLeft: "8px", flexShrink: 0 }}>›</div>
              </div>

              {/* Special inline content for checkin */}
              {act.id === "checkin" && (
                <div style={{ marginTop: "12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "10px" }}>
                    {CHECKIN_REWARDS.map((r, i) => {
                      const streak = checkinStatus?.streak || 0;
                      const checked = i < streak;
                      const isToday = !checkinStatus?.checkedToday && i === streak;
                      return (
                        <div key={i} style={{
                          textAlign: "center", padding: "6px 2px", borderRadius: "8px",
                          background: checked ? "rgba(255,215,0,0.2)" : isToday ? "rgba(0,191,255,0.2)" : "rgba(255,255,255,0.05)",
                          border: checked ? "1px solid rgba(255,215,0,0.4)" : isToday ? "1px solid rgba(0,191,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
                        }}>
                          <div style={{ fontSize: "9px", color: "#666" }}>D{i + 1}</div>
                          <div style={{ fontSize: "11px", fontWeight: "bold", color: checked ? "#FFD700" : isToday ? "#00BFFF" : "#555" }}>
                            {checked ? "✅" : `${r}U`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!checkinStatus?.checkedToday ? (
                    <button onClick={quickCheckin} style={{ width: "100%", padding: "9px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#000", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>
                      立即簽到（第 {(checkinStatus?.streak || 0) + 1} 天）
                    </button>
                  ) : (
                    <div style={{ textAlign: "center", padding: "8px", color: "#FFD700", fontSize: "13px", fontWeight: "bold" }}>✅ 今日已簽到</div>
                  )}
                </div>
              )}

              {/* Special inline content for VIP */}
              {act.id === "vip" && vip && (
                <div style={{ marginTop: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#888", marginBottom: "4px" }}>
                    <span>{vip.vip_name || "普通會員"}</span>
                    <span>投注 {(vip.total_bet || 0).toLocaleString()} / {(vip.next_bet || 0).toLocaleString()} U</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${vip.progress || 0}%`, background: "linear-gradient(90deg, #FFD700, #00BFFF)", borderRadius: "3px" }} />
                  </div>
                </div>
              )}

              {/* Special inline content for referral */}
              {act.id === "referral" && (
                <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
                  <div style={{ flex: 1, textAlign: "center", background: "rgba(255,215,0,0.1)", borderRadius: "10px", padding: "8px", border: "1px solid rgba(255,215,0,0.2)" }}>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: "#FFD700" }}>15%</div>
                    <div style={{ fontSize: "10px", color: "#888" }}>直推佣金</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", background: "rgba(0,191,255,0.1)", borderRadius: "10px", padding: "8px", border: "1px solid rgba(0,191,255,0.2)" }}>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: "#00BFFF" }}>3%</div>
                    <div style={{ fontSize: "10px", color: "#888" }}>二級佣金</div>
                  </div>
                </div>
              )}

              {/* View details hint */}
              <div style={{ marginTop: "10px", textAlign: "right", fontSize: "12px", color: "rgba(255,215,0,0.6)" }}>
                查看完整規則 →
              </div>
            </div>
          </div>
        </Link>
      ))}

      {/* Risk warning */}
      <div style={{ background: "rgba(255,69,0,0.05)", border: "1px solid rgba(255,69,0,0.2)", borderRadius: "12px", padding: "14px", marginTop: "8px" }}>
        <h3 style={{ fontSize: "13px", fontWeight: "bold", color: "#FF6347", marginBottom: "8px" }}>⚠️ 風控提示</h3>
        <div style={{ fontSize: "11px", color: "#888", lineHeight: "1.8" }}>
          <p>• 禁止對打、刷返水、多帳號操作，違規封號</p>
          <p>• 所有優惠金額均帶流水要求，未達標不可提款</p>
          <p>• LA1 保留本活動最終解釋權</p>
        </div>
      </div>
    </div>
  );
}
