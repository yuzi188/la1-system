"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = "https://la1-backend-production.up.railway.app";

export default function ReferralPage() {
  const router = useRouter();
  const [referral, setReferral] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("la1_token");
    if (token) {
      fetch(`${API}/promo/referral-info`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setReferral(d)).catch(() => {});
    }
  }, []);

  function copyText(text) {
    navigator.clipboard.writeText(text).then(() => { setMsg("✅ 已複製到剪貼板"); setTimeout(() => setMsg(""), 2000); });
  }

  const cardStyle = {
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,215,0,0.2)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 0 15px rgba(0,191,255,0.06)",
  };

  return (
    <div className="fade-in" style={{ padding: "16px", paddingBottom: "100px", maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "8px 14px", color: "#fff", cursor: "pointer", fontSize: "14px" }}>← 返回</button>
        <h1 style={{ fontSize: "20px", fontWeight: "bold", color: "#FFD700" }}>🤝 邀請返傭</h1>
      </div>

      {msg && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.95)", border: "1px solid #FFD700", padding: "12px 24px", borderRadius: "12px", zIndex: 9999, color: "#FFD700", fontWeight: "bold", fontSize: "14px" }}>{msg}</div>
      )}

      {/* Commission rates */}
      <div style={{ ...cardStyle, background: "linear-gradient(135deg, rgba(0,191,255,0.1), rgba(255,215,0,0.05))", borderColor: "rgba(0,191,255,0.3)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#FFD700", textAlign: "center", marginBottom: "16px" }}>永久佣金，無上限</h2>
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ flex: 1, textAlign: "center", background: "rgba(255,215,0,0.1)", borderRadius: "12px", padding: "16px", border: "1px solid rgba(255,215,0,0.3)" }}>
            <div style={{ fontSize: "36px", fontWeight: "900", color: "#FFD700" }}>15%</div>
            <div style={{ fontSize: "13px", color: "#FFD700", fontWeight: "bold", marginBottom: "4px" }}>直推佣金</div>
            <div style={{ fontSize: "11px", color: "#888" }}>好友首充金額的 15%</div>
          </div>
          <div style={{ flex: 1, textAlign: "center", background: "rgba(0,191,255,0.1)", borderRadius: "12px", padding: "16px", border: "1px solid rgba(0,191,255,0.3)" }}>
            <div style={{ fontSize: "36px", fontWeight: "900", color: "#00BFFF" }}>3%</div>
            <div style={{ fontSize: "13px", color: "#00BFFF", fontWeight: "bold", marginBottom: "4px" }}>二級佣金</div>
            <div style={{ fontSize: "11px", color: "#888" }}>好友的好友首充的 3%</div>
          </div>
        </div>
      </div>

      {/* Invite code */}
      {referral ? (
        <div style={cardStyle}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>🔗 您的專屬邀請碼</h3>
          <div style={{ background: "rgba(255,215,0,0.08)", borderRadius: "12px", padding: "16px", marginBottom: "12px", border: "1px solid rgba(255,215,0,0.2)" }}>
            <div style={{ fontSize: "11px", color: "#888", marginBottom: "6px" }}>邀請碼</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "22px", fontWeight: "bold", color: "#FFD700", letterSpacing: "3px" }}>{referral.invite_code}</span>
              <button onClick={() => copyText(referral.invite_code)} style={{ background: "rgba(255,215,0,0.2)", border: "1px solid rgba(255,215,0,0.4)", borderRadius: "8px", padding: "6px 14px", color: "#FFD700", fontSize: "12px", cursor: "pointer", fontWeight: "bold" }}>複製</button>
            </div>
          </div>
          <div style={{ background: "rgba(0,191,255,0.06)", borderRadius: "12px", padding: "12px", marginBottom: "12px", border: "1px solid rgba(0,191,255,0.2)" }}>
            <div style={{ fontSize: "11px", color: "#888", marginBottom: "6px" }}>TG 邀請連結</div>
            <div style={{ fontSize: "12px", color: "#00BFFF", wordBreak: "break-all", marginBottom: "8px" }}>{referral.tg_link}</div>
            <button onClick={() => copyText(referral.tg_link)} style={{ background: "rgba(0,191,255,0.15)", border: "1px solid rgba(0,191,255,0.3)", borderRadius: "8px", padding: "6px 14px", color: "#00BFFF", fontSize: "12px", cursor: "pointer", fontWeight: "bold", width: "100%" }}>複製 TG 連結</button>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1, textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#FFD700" }}>{referral.invite_count || 0}</div>
              <div style={{ fontSize: "11px", color: "#888" }}>已邀請人數</div>
            </div>
            <div style={{ flex: 1, textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#00BFFF" }}>{(referral.invite_earnings || 0).toFixed(2)}</div>
              <div style={{ fontSize: "11px", color: "#888" }}>累計佣金 (U)</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <p style={{ color: "#888" }}>登入後查看您的邀請碼</p>
          <a href="/login" style={{ display: "inline-block", marginTop: "12px", padding: "10px 24px", background: "linear-gradient(135deg, #FFD700, #FFA500)", borderRadius: "10px", color: "#000", fontWeight: "bold", textDecoration: "none" }}>前往登入</a>
        </div>
      )}

      {/* How it works */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>📋 如何賺取佣金</h3>
        {[
          { step: "1", title: "複製邀請連結", desc: "複製您的專屬 TG 邀請連結或邀請碼" },
          { step: "2", title: "分享給好友", desc: "發送給朋友，讓他們通過您的連結加入" },
          { step: "3", title: "好友首充", desc: "好友完成首次儲值後，佣金自動計算" },
          { step: "4", title: "佣金到帳", desc: "直推 15% 佣金即時到帳，無需申請" },
        ].map((item) => (
          <div key={item.step} style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "flex-start" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #FFD700, #FFA500)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "13px", fontWeight: "bold", color: "#000" }}>{item.step}</div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "bold", color: "#fff", marginBottom: "2px" }}>{item.title}</div>
              <div style={{ fontSize: "12px", color: "#888" }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Rules */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>📜 活動規則</h3>
        {[
          "佣金按好友首充金額計算，直推 15%，二級 3%",
          "佣金即時到帳，無最低提取限制",
          "邀請佣金永久有效，好友每次首充均計算",
          "禁止自我邀請、多帳號套利等違規行為",
          "違規帳號將被封禁並取消所有佣金",
          "LA1 保留本活動最終解釋權",
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
