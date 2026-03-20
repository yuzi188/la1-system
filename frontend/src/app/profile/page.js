"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = "https://la1-backend-production.up.railway.app";
const VIP_NAMES = ["普通會員", "VIP1", "VIP2", "VIP3", "VIP4", "VIP5"];
const CHECKIN_REWARDS = [0.5, 0.5, 1, 1, 1.5, 1.5, 3];

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [vip, setVip] = useState(null);
  const [referral, setReferral] = useState(null);
  const [checkin, setCheckin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("la1_token");
    if (!token) { setLoading(false); return; }
    fetchAll(token);
  }, []);

  async function fetchAll(token) {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [me, v, r, c] = await Promise.all([
        fetch(`${API}/me`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API}/promo/vip-info`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API}/promo/referral-info`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API}/promo/checkin-status`, { headers }).then(r => r.json()).catch(() => null),
      ]);
      if (me && !me.error) setUser(me);
      setVip(v); setReferral(r); setCheckin(c);
    } catch (e) {}
    setLoading(false);
  }

  function handleLogout() {
    localStorage.removeItem("la1_token");
    localStorage.removeItem("la1_user");
    router.push("/");
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).then(() => { setMsg("✅ 已複製"); setTimeout(() => setMsg(""), 2000); });
  }

  async function doCheckin() {
    const token = localStorage.getItem("la1_token");
    if (!token) return;
    const res = await fetch(`${API}/promo/checkin`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const data = await res.json();
    if (data.ok) { setMsg(`✅ 簽到成功！+${data.reward}U`); fetchAll(token); }
    else setMsg(data.error || "簽到失敗");
    setTimeout(() => setMsg(""), 3000);
  }

  const cardStyle = {
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,215,0,0.2)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 0 15px rgba(0,191,255,0.08)",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#FFD700" }}>載入中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fade-in" style={{ padding: "16px", textAlign: "center", paddingTop: "60px" }}>
        <div style={{ fontSize: "60px", marginBottom: "16px" }}>🔒</div>
        <h2 style={{ color: "#FFD700", marginBottom: "8px" }}>請先登入</h2>
        <p style={{ color: "#888", marginBottom: "20px" }}>登入後查看個人資訊</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "300px", margin: "0 auto" }}>
          <a href="/login" style={{ padding: "14px", background: "linear-gradient(135deg, #FFD700, #FFA500)", borderRadius: "12px", color: "#000", fontWeight: "bold", textAlign: "center", textDecoration: "none" }}>手動登入 / 註冊</a>
          <a href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer" style={{ padding: "14px", background: "rgba(0,191,255,0.1)", border: "1px solid rgba(0,191,255,0.3)", borderRadius: "12px", color: "#00BFFF", fontWeight: "bold", textAlign: "center", textDecoration: "none" }}>從 Telegram 打開</a>
        </div>
      </div>
    );
  }

  const vipLevel = vip?.vip_level || 0;
  const vipName = VIP_NAMES[vipLevel] || "普通會員";

  return (
    <div className="fade-in" style={{ padding: "16px", paddingBottom: "100px" }}>
      {msg && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.9)", border: "1px solid #FFD700", padding: "12px 24px", borderRadius: "12px", zIndex: 9999, color: "#FFD700", fontWeight: "bold", fontSize: "14px" }}>
          {msg}
        </div>
      )}

      {/* ── 頭像 + 基本資訊 ── */}
      <div style={{ ...cardStyle, textAlign: "center", background: "linear-gradient(180deg, rgba(255,215,0,0.08), rgba(0,0,0,0.6))" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "-10px" }}>
          <button onClick={handleLogout} style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: "20px", color: "#ff6666", padding: "4px 12px", cursor: "pointer", fontSize: "11px" }}>登出</button>
        </div>
        <div style={{
          width: "72px", height: "72px", borderRadius: "50%",
          background: "linear-gradient(135deg, #FFD700, #D4AF37)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "32px", margin: "0 auto 12px",
          boxShadow: "0 0 25px rgba(255,215,0,0.4)", color: "#000", fontWeight: "900",
        }}>
          {user.first_name ? user.first_name.charAt(0).toUpperCase() : "👤"}
        </div>
        <h2 style={{ fontSize: "18px", color: "#fff", marginBottom: "4px" }}>
          {user.first_name || user.username}
        </h2>
        {user.tg_id && (
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>@{user.username} | TG ID: {user.tg_id}</p>
        )}
        <div style={{
          display: "inline-block", padding: "4px 16px",
          background: vipLevel > 0 ? "linear-gradient(135deg, #FFD700, #FF8C00)" : "rgba(255,255,255,0.1)",
          borderRadius: "20px", color: vipLevel > 0 ? "#000" : "#888",
          fontSize: "12px", fontWeight: "bold",
        }}>
          👑 {vipName}
        </div>
      </div>

      {/* ── 餘額卡片 ── */}
      <div style={{ ...cardStyle, background: "linear-gradient(135deg, rgba(255,215,0,0.1), rgba(0,191,255,0.05))" }}>
        <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>帳戶餘額 (USDT)</div>
        <div style={{ fontSize: "36px", fontWeight: "900", color: "#FFD700", marginBottom: "4px" }}>
          $ {(user.balance || 0).toFixed(2)}
        </div>
        {user.wager_requirement > 0 && (
          <div style={{ fontSize: "11px", color: "#FF6347", marginBottom: "12px" }}>
            🎯 流水要求：{(user.wager_requirement || 0).toFixed(0)} USDT
          </div>
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <a href="/deposit" style={{ flex: 1, padding: "12px", background: "linear-gradient(135deg, #FFD700, #FFA500)", borderRadius: "10px", color: "#000", fontWeight: "bold", textAlign: "center", textDecoration: "none", fontSize: "14px" }}>儲值</a>
          <a href="https://t.me/LA1111_bot" target="_blank" style={{ flex: 1, padding: "12px", background: "rgba(0,191,255,0.1)", border: "1px solid rgba(0,191,255,0.3)", borderRadius: "10px", color: "#00BFFF", fontWeight: "bold", textAlign: "center", textDecoration: "none", fontSize: "14px" }}>提款</a>
        </div>
      </div>

      {/* ── VIP 進度 ── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700" }}>👑 VIP 進度</h3>
          <span style={{ fontSize: "12px", color: "#00BFFF" }}>返水 {((vip?.rebate || 0) * 100).toFixed(1)}%</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#888", marginBottom: "4px" }}>
          <span>{vipName}</span>
          <span>{vip?.next_level || "VIP1"}</span>
        </div>
        <div style={{ height: "10px", background: "rgba(255,255,255,0.1)", borderRadius: "5px", overflow: "hidden", marginBottom: "8px" }}>
          <div style={{
            height: "100%", width: `${vip?.progress || 0}%`,
            background: "linear-gradient(90deg, #FFD700, #00BFFF)",
            borderRadius: "5px", transition: "width 0.8s ease",
            boxShadow: "0 0 10px rgba(255,215,0,0.5)",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#888" }}>
          <span>累計投注：{(vip?.total_bet || 0).toLocaleString()}</span>
          <span>還需：{(vip?.remaining || 0).toLocaleString()} USDT</span>
        </div>
      </div>

      {/* ── 每日簽到 ── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700" }}>📅 每日簽到</h3>
          <span style={{ fontSize: "12px", color: checkin?.checkedToday ? "#4CAF50" : "#00BFFF" }}>
            {checkin?.checkedToday ? "今日已簽" : "可簽到"}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", marginBottom: "12px" }}>
          {CHECKIN_REWARDS.map((r, i) => {
            const streak = checkin?.streak || 0;
            const checked = checkin?.checkedToday ? i < streak : i < streak;
            const isToday = checkin?.checkedToday ? i === streak - 1 : i === streak;
            return (
              <div key={i} style={{
                textAlign: "center", padding: "6px 2px", borderRadius: "8px",
                background: checked ? "rgba(255,215,0,0.15)" : isToday ? "rgba(0,191,255,0.15)" : "rgba(255,255,255,0.03)",
                border: checked ? "1px solid rgba(255,215,0,0.4)" : isToday ? "1px solid rgba(0,191,255,0.4)" : "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ fontSize: "9px", color: "#666" }}>D{i + 1}</div>
                <div style={{ fontSize: "12px", fontWeight: "bold", color: checked ? "#FFD700" : isToday ? "#00BFFF" : "#444" }}>
                  {checked ? "✅" : `${r}U`}
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={doCheckin} disabled={checkin?.checkedToday} style={{
          width: "100%", padding: "10px", borderRadius: "10px", border: "none", fontWeight: "bold", fontSize: "14px", cursor: checkin?.checkedToday ? "default" : "pointer",
          background: checkin?.checkedToday ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #FFD700, #D4AF37)",
          color: checkin?.checkedToday ? "#555" : "#000",
        }}>
          {checkin?.checkedToday ? "明天再來 ✅" : "立即簽到"}
        </button>
      </div>

      {/* ── 邀請返傭 ── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>🤝 邀請返傭</h3>
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
          <div style={{ flex: 1, textAlign: "center", background: "rgba(255,215,0,0.08)", borderRadius: "10px", padding: "12px" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#FFD700" }}>{referral?.invite_count || 0}</div>
            <div style={{ fontSize: "11px", color: "#888" }}>已邀請</div>
          </div>
          <div style={{ flex: 1, textAlign: "center", background: "rgba(0,191,255,0.08)", borderRadius: "10px", padding: "12px" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#00BFFF" }}>{(referral?.invite_earnings || 0).toFixed(2)}</div>
            <div style={{ fontSize: "11px", color: "#888" }}>累計佣金</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px" }}>
          <div style={{ fontSize: "11px", color: "#888", marginBottom: "4px" }}>邀請碼</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", letterSpacing: "2px" }}>{referral?.invite_code || "---"}</span>
            <button onClick={() => copyText(referral?.tg_link || referral?.invite_link || "")} style={{ background: "rgba(255,215,0,0.2)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: "8px", padding: "4px 12px", color: "#FFD700", fontSize: "11px", cursor: "pointer" }}>複製連結</button>
          </div>
        </div>
      </div>

      {/* ── 帳戶統計 ── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>📊 帳戶統計</h3>
        {[
          { label: "累計儲值", value: `${(user.total_deposit || 0).toFixed(2)} USDT`, color: "#FFD700" },
          { label: "累計投注", value: `${(user.total_bet || 0).toLocaleString()} USDT`, color: "#00BFFF" },
          { label: "首充獎勵", value: user.first_deposit_claimed ? "已領取 ✅" : "未領取", color: user.first_deposit_claimed ? "#4CAF50" : "#888" },
          { label: "流水要求", value: `${(user.wager_requirement || 0).toFixed(0)} USDT`, color: "#FF6347" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <span style={{ fontSize: "13px", color: "#888" }}>{item.label}</span>
            <span style={{ fontSize: "13px", fontWeight: "bold", color: item.color }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* ── 功能選單 ── */}
      <div style={cardStyle}>
        {[
          { icon: "🎁", label: "活動中心", href: "/activity" },
          { icon: "📋", label: "交易記錄", href: "https://t.me/LA1111_bot" },
          { icon: "🔒", label: "安全中心", href: "https://t.me/LA1111_bot" },
          { icon: "📞", label: "聯繫客服", href: "/service" },
        ].map((item, i, arr) => (
          <a key={i} href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0",
            borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
            textDecoration: "none", color: "#fff",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "18px" }}>{item.icon}</span>
              <span style={{ fontSize: "14px" }}>{item.label}</span>
            </div>
            <span style={{ color: "#333", fontSize: "16px" }}>›</span>
          </a>
        ))}
      </div>
    </div>
  );
}
