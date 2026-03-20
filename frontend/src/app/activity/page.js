"use client";
import { useState, useEffect } from "react";

const API = "https://la1-backend-production.up.railway.app";
const CHECKIN_REWARDS = [0.5, 0.5, 1, 1, 1.5, 1.5, 3];

export default function ActivityPage() {
  const [token, setToken] = useState(null);
  const [summary, setSummary] = useState(null);
  const [checkinStatus, setCheckinStatus] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [vip, setVip] = useState(null);
  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("la1_token");
    setToken(t);
    if (t) fetchAll(t);
    else setLoading(false);
  }, []);

  async function fetchAll(t) {
    const headers = { Authorization: `Bearer ${t}` };
    try {
      const [s, c, tk, v, r] = await Promise.all([
        fetch(`${API}/promo/summary`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`${API}/promo/checkin-status`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API}/promo/tasks`, { headers }).then(r => r.json()).catch(() => ({ tasks: [] })),
        fetch(`${API}/promo/vip-info`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API}/promo/referral-info`, { headers }).then(r => r.json()).catch(() => null),
      ]);
      setSummary(s); setCheckinStatus(c); setTasks(tk.tasks || []); setVip(v); setReferral(r);
    } catch (e) {}
    setLoading(false);
  }

  async function doCheckin() {
    if (!token) return;
    const res = await fetch(`${API}/promo/checkin`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const data = await res.json();
    if (data.ok) { setMsg(`✅ 簽到成功！獲得 ${data.reward} USDT`); fetchAll(token); }
    else setMsg(data.error || "簽到失敗");
    setTimeout(() => setMsg(""), 3000);
  }

  async function claimFirstDeposit() {
    if (!token) return;
    const res = await fetch(`${API}/promo/first-deposit`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const data = await res.json();
    if (data.ok) { setMsg(`🎁 首充獎勵已到帳！+${data.bonus} USDT`); fetchAll(token); }
    else setMsg(data.error || "領取失敗");
    setTimeout(() => setMsg(""), 3000);
  }

  async function claimTask(taskId) {
    if (!token) return;
    const res = await fetch(`${API}/promo/claim-task`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ taskId }) });
    const data = await res.json();
    if (data.ok) { setMsg(`🏆 任務獎勵已到帳！+${data.reward} USDT`); fetchAll(token); }
    else setMsg(data.error || "領取失敗");
    setTimeout(() => setMsg(""), 3000);
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).then(() => { setMsg("✅ 已複製到剪貼板"); setTimeout(() => setMsg(""), 2000); });
  }

  const cardStyle = {
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,215,0,0.3)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "16px",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 0 20px rgba(0,191,255,0.1)",
  };

  const badgeStyle = (active) => ({
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "bold",
    background: active ? "linear-gradient(135deg, #FFD700, #D4AF37)" : "rgba(255,255,255,0.1)",
    color: active ? "#000" : "#888",
    border: active ? "none" : "1px solid rgba(255,255,255,0.1)",
  });

  const btnStyle = (enabled) => ({
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    fontWeight: "bold",
    fontSize: "14px",
    cursor: enabled ? "pointer" : "default",
    background: enabled ? "linear-gradient(135deg, #FFD700, #D4AF37)" : "rgba(255,255,255,0.1)",
    color: enabled ? "#000" : "#555",
    opacity: enabled ? 1 : 0.6,
    width: "100%",
    marginTop: "12px",
  });

  if (!token) {
    return (
      <div className="fade-in" style={{ padding: "16px", textAlign: "center", paddingTop: "60px" }}>
        <div style={{ fontSize: "60px", marginBottom: "16px" }}>🔒</div>
        <h2 style={{ color: "#FFD700", marginBottom: "8px" }}>請先登入</h2>
        <p style={{ color: "#888", marginBottom: "20px" }}>登入後即可參與所有活動</p>
        <a href="/login" style={{ ...btnStyle(true), display: "inline-block", textDecoration: "none", width: "auto", padding: "12px 40px" }}>前往登入</a>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: "16px", paddingBottom: "100px" }}>
      <h1 style={{ fontSize: "22px", fontWeight: "bold", textAlign: "center", color: "#FFD700", marginBottom: "20px" }}>
        🔥 活動中心
      </h1>

      {msg && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.9)", border: "1px solid #FFD700", padding: "12px 24px", borderRadius: "12px", zIndex: 9999, color: "#FFD700", fontWeight: "bold", fontSize: "14px" }}>
          {msg}
        </div>
      )}

      {/* ── 首充獎勵 ── */}
      <div style={cardStyle}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #FFD700, #00BFFF, #FFD700)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#FFD700" }}>🎁 首充豪禮</h2>
          <span style={badgeStyle(!summary?.first_deposit_claimed)}>
            {summary?.first_deposit_claimed ? "已領取" : "可領取"}
          </span>
        </div>
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
          <div style={{ flex: 1, background: "rgba(255,215,0,0.1)", borderRadius: "12px", padding: "12px", textAlign: "center", border: "1px solid rgba(255,215,0,0.2)" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#FFD700" }}>充 100</div>
            <div style={{ fontSize: "14px", color: "#00BFFF", fontWeight: "bold" }}>送 38 USDT</div>
            <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>10 倍流水</div>
          </div>
          <div style={{ flex: 1, background: "rgba(0,191,255,0.1)", borderRadius: "12px", padding: "12px", textAlign: "center", border: "1px solid rgba(0,191,255,0.2)" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#00BFFF" }}>充 30</div>
            <div style={{ fontSize: "14px", color: "#FFD700", fontWeight: "bold" }}>送 10 USDT</div>
            <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>8 倍流水</div>
          </div>
        </div>
        {!summary?.first_deposit_claimed ? (
          <button onClick={claimFirstDeposit} style={btnStyle(true)}>立即領取首充獎勵</button>
        ) : (
          <button disabled style={btnStyle(false)}>已領取</button>
        )}
      </div>

      {/* ── 每日簽到 ── */}
      <div style={cardStyle}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #00BFFF, #FFD700, #00BFFF)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#FFD700" }}>📅 每日簽到</h2>
          <span style={badgeStyle(!checkinStatus?.checkedToday)}>
            {checkinStatus?.checkedToday ? "今日已簽" : "可簽到"}
          </span>
        </div>
        <p style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>連續簽到 7 天，獎勵遞增！斷簽重來。所有獎勵需 2 倍流水。</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", marginBottom: "12px" }}>
          {CHECKIN_REWARDS.map((r, i) => {
            const streak = checkinStatus?.streak || 0;
            const checked = checkinStatus?.checkedToday ? i < streak : i < streak;
            const isToday = checkinStatus?.checkedToday ? i === streak - 1 : i === streak;
            return (
              <div key={i} style={{
                textAlign: "center",
                padding: "8px 2px",
                borderRadius: "10px",
                background: checked ? "rgba(255,215,0,0.2)" : isToday ? "rgba(0,191,255,0.2)" : "rgba(255,255,255,0.05)",
                border: checked ? "1px solid #FFD700" : isToday ? "1px solid #00BFFF" : "1px solid rgba(255,255,255,0.1)",
              }}>
                <div style={{ fontSize: "10px", color: "#888" }}>Day{i + 1}</div>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: checked ? "#FFD700" : isToday ? "#00BFFF" : "#555" }}>
                  {checked ? "✅" : `${r}U`}
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={doCheckin} disabled={checkinStatus?.checkedToday} style={btnStyle(!checkinStatus?.checkedToday)}>
          {checkinStatus?.checkedToday ? "今日已簽到 ✅" : "立即簽到"}
        </button>
      </div>

      {/* ── VIP 等級 ── */}
      <div style={cardStyle}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #FFD700, #FFD700)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#FFD700" }}>👑 VIP 等級</h2>
          <span style={{ ...badgeStyle(true), background: "linear-gradient(135deg, #FFD700, #FF8C00)" }}>
            {vip?.vip_name || "普通會員"}
          </span>
        </div>
        {/* Progress bar */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#888", marginBottom: "4px" }}>
            <span>{vip?.vip_name}</span>
            <span>{vip?.next_level}</span>
          </div>
          <div style={{ height: "8px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${vip?.progress || 0}%`, background: "linear-gradient(90deg, #FFD700, #00BFFF)", borderRadius: "4px", transition: "width 0.5s" }} />
          </div>
          <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
            累計投注：{(vip?.total_bet || 0).toLocaleString()} / {(vip?.next_bet || 0).toLocaleString()} USDT
          </div>
        </div>
        {/* VIP table */}
        <div style={{ fontSize: "12px" }}>
          {[
            { name: "VIP1", bet: "1,000", rebate: "0.5%" },
            { name: "VIP2", bet: "5,000", rebate: "0.8%" },
            { name: "VIP3", bet: "20,000", rebate: "1.2%" },
            { name: "VIP4", bet: "50,000", rebate: "1.5%" },
            { name: "VIP5", bet: "100,000", rebate: "1.8%" },
          ].map((v, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", padding: "8px 12px", marginBottom: "4px",
              background: vip?.vip_level === i + 1 ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.03)",
              borderRadius: "8px",
              border: vip?.vip_level === i + 1 ? "1px solid rgba(255,215,0,0.3)" : "1px solid transparent",
            }}>
              <span style={{ color: vip?.vip_level === i + 1 ? "#FFD700" : "#aaa" }}>{vip?.vip_level === i + 1 ? "👉 " : ""}{v.name}</span>
              <span style={{ color: "#888" }}>投注 {v.bet}</span>
              <span style={{ color: "#00BFFF", fontWeight: "bold" }}>返水 {v.rebate}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 邀請返傭 ── */}
      <div style={cardStyle}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #00BFFF, #1E90FF, #00BFFF)" }} />
        <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>🤝 邀請返傭</h2>
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
          <div style={{ flex: 1, background: "rgba(255,215,0,0.1)", borderRadius: "12px", padding: "12px", textAlign: "center", border: "1px solid rgba(255,215,0,0.2)" }}>
            <div style={{ fontSize: "28px", fontWeight: "bold", color: "#FFD700" }}>15%</div>
            <div style={{ fontSize: "12px", color: "#888" }}>直推佣金</div>
          </div>
          <div style={{ flex: 1, background: "rgba(0,191,255,0.1)", borderRadius: "12px", padding: "12px", textAlign: "center", border: "1px solid rgba(0,191,255,0.2)" }}>
            <div style={{ fontSize: "28px", fontWeight: "bold", color: "#00BFFF" }}>3%</div>
            <div style={{ fontSize: "12px", color: "#888" }}>二級佣金</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "12px", marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>您的邀請碼</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "18px", fontWeight: "bold", color: "#FFD700", letterSpacing: "2px" }}>{referral?.invite_code || "---"}</span>
            <button onClick={() => copyText(referral?.invite_code)} style={{ background: "rgba(255,215,0,0.2)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: "8px", padding: "4px 12px", color: "#FFD700", fontSize: "12px", cursor: "pointer" }}>複製</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#FFD700" }}>{referral?.invite_count || 0}</div>
            <div style={{ fontSize: "11px", color: "#888" }}>已邀請人數</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#00BFFF" }}>{(referral?.invite_earnings || 0).toFixed(2)}</div>
            <div style={{ fontSize: "11px", color: "#888" }}>累計佣金 (USDT)</div>
          </div>
        </div>
        <button onClick={() => copyText(referral?.tg_link || "")} style={btnStyle(true)}>複製邀請連結</button>
      </div>

      {/* ── 任務中心 ── */}
      <div style={cardStyle}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #FFD700, #00BFFF)" }} />
        <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>🏆 任務中心</h2>
        <p style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>完成任務領取獎勵，所有獎勵需 3 倍流水。</p>
        {tasks.map((task, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px", marginBottom: "8px",
            background: task.claimed ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.03)",
            borderRadius: "10px",
            border: task.claimed ? "1px solid rgba(255,215,0,0.2)" : "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: "bold", color: task.claimed ? "#FFD700" : "#fff" }}>{task.name}</div>
              <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                進度：{task.progress}/{task.target} | 獎勵：{task.reward}U
              </div>
              {/* Mini progress bar */}
              <div style={{ height: "3px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", marginTop: "6px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (task.progress / task.target) * 100)}%`, background: task.completed ? "#FFD700" : "#00BFFF", borderRadius: "2px" }} />
              </div>
            </div>
            <button
              onClick={() => !task.claimed && task.completed && claimTask(task.id)}
              disabled={task.claimed || !task.completed}
              style={{
                marginLeft: "12px", padding: "6px 14px", borderRadius: "8px", border: "none",
                fontSize: "12px", fontWeight: "bold", cursor: task.completed && !task.claimed ? "pointer" : "default",
                background: task.claimed ? "rgba(255,215,0,0.2)" : task.completed ? "linear-gradient(135deg, #FFD700, #D4AF37)" : "rgba(255,255,255,0.1)",
                color: task.claimed ? "#FFD700" : task.completed ? "#000" : "#555",
              }}
            >
              {task.claimed ? "已領" : task.completed ? "領取" : "未完成"}
            </button>
          </div>
        ))}
      </div>

      {/* ── 週末活動 ── */}
      <div style={cardStyle}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #FF4500, #FFD700, #FF4500)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#FFD700" }}>🎊 週末狂歡</h2>
          <span style={badgeStyle(summary?.is_weekend && summary?.weekend_eligible)}>
            {summary?.is_weekend ? (summary?.weekend_eligible ? "已激活" : "需 VIP2+") : "僅週末"}
          </span>
        </div>
        <p style={{ fontSize: "14px", color: "#ccc", marginBottom: "8px" }}>週六日返水額外 <span style={{ color: "#FFD700", fontWeight: "bold" }}>+30%</span></p>
        <p style={{ fontSize: "12px", color: "#888" }}>僅限 VIP2 以上會員參加，自動結算無需申請。</p>
      </div>

      {/* ── 風控說明 ── */}
      <div style={{ ...cardStyle, borderColor: "rgba(255,69,0,0.3)" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#FF6347", marginBottom: "8px" }}>⚠️ 活動規則</h2>
        <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.8" }}>
          <p>• 所有優惠金額均帶流水要求，未達流水不可提款</p>
          <p>• 首充獎勵：10 倍 / 8 倍流水</p>
          <p>• 簽到獎勵：2 倍流水</p>
          <p>• 任務獎勵：3 倍流水</p>
          <p>• 禁止對打、刷返水、多帳號操作</p>
          <p>• 違規將標記封鎖帳戶，LA1 保留最終解釋權</p>
        </div>
      </div>
    </div>
  );
}
