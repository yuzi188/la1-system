"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = "https://la1-backend-production.up.railway.app";

const VIP_LEVELS = [
  { level: 1, name: "VIP1", minBet: 1000, rebate: 0.5, color: "#C0C0C0", benefits: ["專屬客服通道", "每週返水結算", "生日禮金"] },
  { level: 2, name: "VIP2", minBet: 5000, rebate: 0.8, color: "#FFD700", benefits: ["VIP1 所有權益", "週末返水 +30%", "優先提款通道"] },
  { level: 3, name: "VIP3", minBet: 20000, rebate: 1.2, color: "#00BFFF", benefits: ["VIP2 所有權益", "專屬 VIP 包廂", "月度豪禮"] },
  { level: 4, name: "VIP4", minBet: 50000, rebate: 1.5, color: "#FF8C00", benefits: ["VIP3 所有權益", "私人客服經理", "高額提款限額"] },
  { level: 5, name: "VIP5", minBet: 100000, rebate: 1.8, color: "#FF4500", benefits: ["VIP4 所有權益", "頂級 VIP 專屬活動", "無限提款額度"] },
];

export default function VipPage() {
  const router = useRouter();
  const [vip, setVip] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("la1_token");
    if (token) {
      fetch(`${API}/promo/vip-info`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setVip(d)).catch(() => {});
    }
  }, []);

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
        <h1 style={{ fontSize: "20px", fontWeight: "bold", color: "#FFD700" }}>👑 VIP 專屬待遇</h1>
      </div>

      {/* Current VIP status */}
      {vip && (
        <div style={{ ...cardStyle, background: "linear-gradient(135deg, rgba(255,215,0,0.1), rgba(0,191,255,0.05))", borderColor: "rgba(255,215,0,0.4)", textAlign: "center" }}>
          <div style={{ fontSize: "13px", color: "#888", marginBottom: "4px" }}>當前等級</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#FFD700", marginBottom: "8px" }}>{vip.vip_name || "普通會員"}</div>
          <div style={{ height: "8px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden", marginBottom: "8px" }}>
            <div style={{ height: "100%", width: `${vip.progress || 0}%`, background: "linear-gradient(90deg, #FFD700, #00BFFF)", borderRadius: "4px" }} />
          </div>
          <div style={{ fontSize: "12px", color: "#888" }}>累計投注 {(vip.total_bet || 0).toLocaleString()} / 下一等級需 {(vip.next_bet || 0).toLocaleString()} USDT</div>
        </div>
      )}

      {/* VIP Level Cards */}
      {VIP_LEVELS.map((v) => (
        <div key={v.level} style={{
          ...cardStyle,
          borderColor: vip?.vip_level === v.level ? v.color : "rgba(255,255,255,0.08)",
          boxShadow: vip?.vip_level === v.level ? `0 0 20px ${v.color}30` : "none",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: v.color, borderRadius: "16px 16px 0 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "20px", fontWeight: "bold", color: v.color }}>{v.name}</span>
                {vip?.vip_level === v.level && (
                  <span style={{ background: v.color, color: "#000", fontSize: "10px", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold" }}>當前</span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "#888" }}>累計有效投注 {v.minBet.toLocaleString()} USDT</div>
            </div>
            <div style={{ textAlign: "center", background: `${v.color}15`, borderRadius: "10px", padding: "8px 14px", border: `1px solid ${v.color}40` }}>
              <div style={{ fontSize: "22px", fontWeight: "bold", color: v.color }}>{v.rebate}%</div>
              <div style={{ fontSize: "10px", color: "#888" }}>每週返水</div>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {v.benefits.map((b, i) => (
              <span key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "4px 10px", fontSize: "11px", color: "#ccc" }}>✓ {b}</span>
            ))}
          </div>
        </div>
      ))}

      {/* How it works */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>📋 升級說明</h3>
        {[
          "VIP 等級根據帳號累計有效投注金額自動升級",
          "每週系統自動結算返水，直接到帳無需申請",
          "VIP2 及以上會員享有週末返水額外 +30%",
          "返水計算：當週有效投注 × 對應返水比例",
          "VIP 等級一旦升級，永久保留，不會降級",
          "VIP5 頂級會員享有專屬客服經理一對一服務",
        ].map((rule, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px", fontSize: "13px", color: "#aaa", lineHeight: "1.5" }}>
            <span style={{ color: "#FFD700", flexShrink: 0 }}>•</span>
            <span>{rule}</span>
          </div>
        ))}
      </div>

      <a href="https://t.me/LA1111_bot" target="_blank" style={{ display: "block", width: "100%", padding: "14px", background: "linear-gradient(135deg, #FFD700, #FFA500)", borderRadius: "12px", color: "#000", fontWeight: "bold", textAlign: "center", textDecoration: "none", fontSize: "16px", boxSizing: "border-box" }}>
        聯繫客服了解更多 →
      </a>
    </div>
  );
}
