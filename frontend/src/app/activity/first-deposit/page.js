"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = "https://la1-backend-production.up.railway.app";

export default function FirstDepositPage() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [claimed, setClaimed] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("la1_token");
    setToken(t);
  }, []);

  async function claimBonus(tier) {
    if (!token) { router.push("/login"); return; }
    const res = await fetch(`${API}/promo/first-deposit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json();
    if (data.ok) { setMsg(`🎁 首充獎勵 +${data.bonus} USDT 已到帳！`); setClaimed(true); }
    else setMsg(data.error || "領取失敗，請聯繫客服");
    setTimeout(() => setMsg(""), 4000);
  }

  const cardStyle = {
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,215,0,0.25)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 0 20px rgba(0,191,255,0.08)",
  };

  return (
    <div className="fade-in" style={{ padding: "16px", paddingBottom: "100px", maxWidth: "480px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "8px 14px", color: "#fff", cursor: "pointer", fontSize: "14px" }}>← 返回</button>
        <h1 style={{ fontSize: "20px", fontWeight: "bold", color: "#FFD700" }}>🎁 首充豪禮</h1>
      </div>

      {msg && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.95)", border: "1px solid #FFD700", padding: "12px 24px", borderRadius: "12px", zIndex: 9999, color: "#FFD700", fontWeight: "bold", fontSize: "14px" }}>{msg}</div>
      )}

      {/* Banner */}
      <div style={{ ...cardStyle, background: "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(0,191,255,0.08))", borderColor: "rgba(255,215,0,0.4)", textAlign: "center", padding: "28px 20px" }}>
        <div style={{ fontSize: "48px", marginBottom: "8px" }}>💰</div>
        <h2 style={{ fontSize: "22px", fontWeight: "bold", color: "#FFD700", marginBottom: "4px" }}>新會員首充大禮包</h2>
        <p style={{ color: "#aaa", fontSize: "13px" }}>僅限首次儲值，錯過不再有</p>
      </div>

      {/* Tier 1 */}
      <div style={{ ...cardStyle, borderColor: "rgba(255,215,0,0.4)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #FFD700, #FFA500)", borderRadius: "16px 16px 0 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#FFD700" }}>充 100 送 38</div>
            <div style={{ fontSize: "13px", color: "#aaa" }}>儲值滿 100 USDT，贈送 38 USDT</div>
          </div>
          <div style={{ textAlign: "center", background: "rgba(255,215,0,0.1)", borderRadius: "12px", padding: "10px 16px", border: "1px solid rgba(255,215,0,0.3)" }}>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#FFD700" }}>38%</div>
            <div style={{ fontSize: "11px", color: "#888" }}>加碼比例</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px", marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>📋 方案詳情</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
            <span style={{ color: "#aaa" }}>最低儲值</span><span style={{ color: "#fff" }}>100 USDT</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
            <span style={{ color: "#aaa" }}>贈送金額</span><span style={{ color: "#FFD700", fontWeight: "bold" }}>38 USDT</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: "#aaa" }}>流水要求</span><span style={{ color: "#FF6347", fontWeight: "bold" }}>10 倍（1,380 USDT）</span>
          </div>
        </div>
        <button onClick={() => claimBonus("100")} disabled={claimed} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "none", fontWeight: "bold", fontSize: "15px", cursor: claimed ? "default" : "pointer", background: claimed ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #FFD700, #FFA500)", color: claimed ? "#555" : "#000" }}>
          {claimed ? "已領取 ✅" : "立即領取 38 USDT"}
        </button>
      </div>

      {/* Tier 2 */}
      <div style={{ ...cardStyle, borderColor: "rgba(0,191,255,0.4)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #00BFFF, #1E90FF)", borderRadius: "16px 16px 0 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#00BFFF" }}>充 30 送 10</div>
            <div style={{ fontSize: "13px", color: "#aaa" }}>儲值滿 30 USDT，贈送 10 USDT</div>
          </div>
          <div style={{ textAlign: "center", background: "rgba(0,191,255,0.1)", borderRadius: "12px", padding: "10px 16px", border: "1px solid rgba(0,191,255,0.3)" }}>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#00BFFF" }}>33%</div>
            <div style={{ fontSize: "11px", color: "#888" }}>加碼比例</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px", marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>📋 方案詳情</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
            <span style={{ color: "#aaa" }}>最低儲值</span><span style={{ color: "#fff" }}>30 USDT</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
            <span style={{ color: "#aaa" }}>贈送金額</span><span style={{ color: "#00BFFF", fontWeight: "bold" }}>10 USDT</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: "#aaa" }}>流水要求</span><span style={{ color: "#FF6347", fontWeight: "bold" }}>8 倍（80 USDT）</span>
          </div>
        </div>
        <button onClick={() => claimBonus("30")} disabled={claimed} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "none", fontWeight: "bold", fontSize: "15px", cursor: claimed ? "default" : "pointer", background: claimed ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #00BFFF, #1E90FF)", color: claimed ? "#555" : "#000" }}>
          {claimed ? "已領取 ✅" : "立即領取 10 USDT"}
        </button>
      </div>

      {/* Rules */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>📜 活動規則</h3>
        {[
          "本活動僅限新會員首次儲值，每個帳號只能領取一次",
          "充 100 方案：需完成 10 倍流水（1,380 USDT）方可提款",
          "充 30 方案：需完成 8 倍流水（80 USDT）方可提款",
          "流水計算：所有遊戲有效投注均計入流水",
          "本活動不可與其他優惠活動疊加使用",
          "如發現對打、刷流水等違規行為，LA1 有權取消獎勵並封號",
          "LA1 保留本活動最終解釋權",
        ].map((rule, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px", fontSize: "13px", color: "#aaa", lineHeight: "1.5" }}>
            <span style={{ color: "#FFD700", flexShrink: 0 }}>{i + 1}.</span>
            <span>{rule}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <a href="/deposit" style={{ display: "block", width: "100%", padding: "14px", background: "linear-gradient(135deg, #FFD700, #FFA500)", borderRadius: "12px", color: "#000", fontWeight: "bold", textAlign: "center", textDecoration: "none", fontSize: "16px", boxSizing: "border-box" }}>
        前往儲值 →
      </a>
    </div>
  );
}
