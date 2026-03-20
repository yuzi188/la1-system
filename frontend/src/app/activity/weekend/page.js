"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WeekendPage() {
  const router = useRouter();
  const [isWeekend, setIsWeekend] = useState(false);
  const [dayName, setDayName] = useState("");

  useEffect(() => {
    const now = new Date();
    const day = now.getDay();
    setIsWeekend(day === 0 || day === 6);
    setDayName(["週日", "週一", "週二", "週三", "週四", "週五", "週六"][day]);
  }, []);

  const cardStyle = {
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,215,0,0.2)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "16px",
  };

  const vipData = [
    { level: "VIP2", base: "0.8%", bonus: "+30%", total: "1.04%", color: "#FFD700" },
    { level: "VIP3", base: "1.2%", bonus: "+30%", total: "1.56%", color: "#00BFFF" },
    { level: "VIP4", base: "1.5%", bonus: "+30%", total: "1.95%", color: "#FF8C00" },
    { level: "VIP5", base: "1.8%", bonus: "+30%", total: "2.34%", color: "#FF4500" },
  ];

  return (
    <div className="fade-in" style={{ padding: "16px", paddingBottom: "100px", maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "8px 14px", color: "#fff", cursor: "pointer", fontSize: "14px" }}>← 返回</button>
        <h1 style={{ fontSize: "20px", fontWeight: "bold", color: "#FFD700" }}>🎊 週末狂歡</h1>
      </div>

      {/* Status banner */}
      <div style={{
        ...cardStyle,
        background: isWeekend ? "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(0,191,255,0.1))" : "rgba(0,0,0,0.6)",
        borderColor: isWeekend ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.1)",
        textAlign: "center",
        padding: "28px 20px",
        boxShadow: isWeekend ? "0 0 30px rgba(255,215,0,0.2)" : "none",
      }}>
        <div style={{ fontSize: "48px", marginBottom: "8px" }}>{isWeekend ? "🎉" : "⏳"}</div>
        <h2 style={{ fontSize: "22px", fontWeight: "bold", color: isWeekend ? "#FFD700" : "#888", marginBottom: "4px" }}>
          {isWeekend ? "週末活動進行中！" : "週末活動未開始"}
        </h2>
        <p style={{ color: "#aaa", fontSize: "13px" }}>
          {isWeekend ? `今天是${dayName}，VIP2+ 返水額外 +30%！` : `今天是${dayName}，週六日才開始`}
        </p>
        {isWeekend && (
          <div style={{ marginTop: "12px", background: "rgba(255,215,0,0.1)", borderRadius: "10px", padding: "8px 20px", display: "inline-block", border: "1px solid rgba(255,215,0,0.3)" }}>
            <span style={{ color: "#FFD700", fontWeight: "bold", fontSize: "15px" }}>🔥 活動進行中</span>
          </div>
        )}
      </div>

      {/* VIP Rebate Table */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", marginBottom: "14px" }}>💰 週末返水加碼表</h3>
        <div style={{ overflow: "hidden", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "rgba(255,215,0,0.1)", padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {["等級", "基礎返水", "週末加碼", "週末合計"].map(h => (
              <div key={h} style={{ fontSize: "11px", color: "#888", textAlign: "center", fontWeight: "bold" }}>{h}</div>
            ))}
          </div>
          {vipData.map((row, i) => (
            <div key={row.level} style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              padding: "12px",
              borderBottom: i < vipData.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
            }}>
              <div style={{ textAlign: "center", fontWeight: "bold", color: row.color, fontSize: "13px" }}>{row.level}</div>
              <div style={{ textAlign: "center", color: "#aaa", fontSize: "13px" }}>{row.base}</div>
              <div style={{ textAlign: "center", color: "#00BFFF", fontSize: "13px", fontWeight: "bold" }}>{row.bonus}</div>
              <div style={{ textAlign: "center", color: "#FFD700", fontSize: "13px", fontWeight: "bold" }}>{row.total}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "11px", color: "#666", marginTop: "10px", textAlign: "center" }}>* VIP1 及普通會員不參與週末加碼</p>
      </div>

      {/* How it works */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700", marginBottom: "12px" }}>📋 活動說明</h3>
        {[
          { icon: "🗓️", title: "活動時間", desc: "每週六、週日（UTC+8 00:00 - 23:59）" },
          { icon: "👑", title: "參與資格", desc: "VIP2 及以上等級會員自動參與" },
          { icon: "💰", title: "返水計算", desc: "週末投注 × 對應 VIP 等級的週末返水比例" },
          { icon: "📅", title: "結算時間", desc: "每週一自動結算上週週末返水，直接到帳" },
        ].map((item) => (
          <div key={item.title} style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "flex-start" }}>
            <div style={{ fontSize: "22px", flexShrink: 0 }}>{item.icon}</div>
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
          "週末加碼返水僅限 VIP2 及以上等級會員",
          "返水計算基於週末期間的所有有效投注",
          "返水直接到帳，無需申請，無流水要求",
          "如發現對打、刷返水等違規行為，取消資格並封號",
          "LA1 保留本活動最終解釋權",
        ].map((rule, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px", fontSize: "13px", color: "#aaa", lineHeight: "1.5" }}>
            <span style={{ color: "#FFD700", flexShrink: 0 }}>•</span>
            <span>{rule}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <a href="/deposit" style={{ display: "block", width: "100%", padding: "14px", background: "linear-gradient(135deg, #FFD700, #FFA500)", borderRadius: "12px", color: "#000", fontWeight: "bold", textAlign: "center", textDecoration: "none", fontSize: "16px", boxSizing: "border-box" }}>
        升級 VIP 享受週末加碼 →
      </a>
    </div>
  );
}
