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

      {/* Referral Bonus Banner */}
      <div style={{ ...cardStyle, background: "linear-gradient(135deg, rgba(0,191,255,0.1), rgba(255,215,0,0.05))", borderColor: "rgba(0,191,255,0.3)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#FFD700", textAlign: "center", marginBottom: "8px" }}>無上限邀請，長期有效</h2>
        <p style={{ fontSize: "12px", color: "#888", textAlign: "center", marginBottom: "16px" }}>
          好友透過邀請碼儲值成功，次日自動發放回饋紅利
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ textAlign: "center", background: "rgba(255,215,0,0.1)", borderRadius: "12px", padding: "16px 32px", border: "1px solid rgba(255,215,0,0.3)" }}>
            <div style={{ fontSize: "22px", fontWeight: "900", color: "#FFD700", lineHeight: "1.3" }}>每 100U 返 10U</div>
            <div style={{ fontSize: "13px", color: "#FFD700", fontWeight: "bold", marginBottom: "4px", marginTop: "6px" }}>回饋紅利</div>
            <div style={{ fontSize: "11px", color: "#888" }}>好友每儲值 100U，您獲得 10U 回饋</div>
          </div>
        </div>
        <div style={{ marginTop: "12px", background: "rgba(255,165,0,0.08)", borderRadius: "10px", padding: "10px 14px", border: "1px solid rgba(255,165,0,0.2)", fontSize: "12px", color: "#FFA500", textAlign: "center" }}>
          🔒 回饋紅利帶 5 倍流水要求 · 次日自動發放
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
              <div style={{ fontSize: "11px", color: "#888" }}>累計回饋紅利 (U)</div>
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
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>📋 如何賺取回饋紅利</h3>
        {[
          { step: "1", title: "複製邀請連結", desc: "複製您的專屬 TG 邀請連結或邀請碼" },
          { step: "2", title: "分享給好友", desc: "發送給朋友，讓他們透過您的連結加入" },
          { step: "3", title: "好友完成儲值", desc: "好友透過邀請碼註冊並儲值成功" },
          { step: "4", title: "次日自動發放回饋紅利", desc: "好友每儲值 100U，您獲得 10U 回饋紅利，次日自動到帳" },
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
          "好友透過邀請碼註冊並儲值成功，每 100U 即返 10U 回饋紅利",
          "回饋紅利於次日由系統自動發放，無需手動申請",
          "回饋紅利帶 5 倍流水要求（例：獲得 10U → 需完成 50U 流水後方可提款）",
          "邀請人數無上限，長期有效",
          "禁止自我邀請、多帳號套利等違規行為",
          "違規帳號將被封禁並取消所有回饋紅利",
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
