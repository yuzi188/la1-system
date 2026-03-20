"use client";
import { useState, useEffect } from "react";

export default function ProfilePage() {
  const [user, setUser] = useState({
    username: "user_8888",
    balance: 0.00,
    vip: "VIP 1",
    phone: "138****8888"
  });

  useEffect(() => {
    const stored = localStorage.getItem("la1_user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  return (
    <div className="fade-in" style={{ padding: "16px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px", textAlign: "center", color: "#FFD700" }}>個人中心</h1>
      
      <div className="glass-panel" style={{
        padding: "24px",
        textAlign: "center",
        marginBottom: "24px",
        background: "linear-gradient(135deg, rgba(255,215,0,0.1), rgba(0,191,255,0.1))"
      }}>
        <div style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #FFD700, #D4AF37)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "40px",
          margin: "0 auto 16px",
          boxShadow: "0 0 30px rgba(255, 215, 0, 0.4)",
          color: "#000",
          fontWeight: "bold"
        }}>LA1</div>
        <h2 style={{ fontSize: "20px", marginBottom: "4px" }}>{user.username}</h2>
        <p style={{ fontSize: "14px", color: "#aaa", marginBottom: "16px" }}>{user.phone}</p>
        
        <div style={{
          display: "inline-block",
          padding: "4px 16px",
          background: "rgba(255, 215, 0, 0.15)",
          borderRadius: "20px",
          color: "#FFD700",
          fontSize: "12px",
          fontWeight: "bold",
          border: "1px solid rgba(255, 215, 0, 0.3)"
        }}>{user.vip}</div>
      </div>

      <div className="glass-panel" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <span style={{ fontSize: "14px", color: "#aaa" }}>帳戶餘額</span>
          <span style={{ fontSize: "24px", fontWeight: "bold", color: "#FFD700" }}>$ {user.balance.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <a href="/deposit" style={{
            flex: 1,
            padding: "12px",
            background: "linear-gradient(135deg, #FFD700, #FFA500)",
            borderRadius: "12px",
            color: "#000",
            fontWeight: "bold",
            textAlign: "center",
            textDecoration: "none",
            fontSize: "14px"
          }}>立即儲值</a>
          <a href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer" style={{
            flex: 1,
            padding: "12px",
            background: "rgba(255,255,255,0.05)",
            borderRadius: "12px",
            color: "#fff",
            fontWeight: "bold",
            textAlign: "center",
            textDecoration: "none",
            fontSize: "14px",
            border: "1px solid rgba(255,255,255,0.1)"
          }}>申請提款</a>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: "0 20px" }}>
        {[
          { icon: "📋", label: "交易記錄", href: "https://t.me/LA1111_bot" },
          { icon: "🎁", label: "領取優惠", href: "/activity" },
          { icon: "🤝", label: "推薦好友", href: "/activity" },
          { icon: "🔒", label: "安全中心", href: "https://t.me/LA1111_bot" },
          { icon: "📞", label: "聯繫客服", href: "/service" }
        ].map((item, i) => (
          <a key={i} href={item.href} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 0",
            borderBottom: i === 4 ? "none" : "1px solid rgba(255,255,255,0.05)",
            textDecoration: "none",
            color: "#fff"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "20px" }}>{item.icon}</span>
              <span style={{ fontSize: "14px" }}>{item.label}</span>
            </div>
            <span style={{ color: "#444" }}>›</span>
          </a>
        ))}
      </div>
    </div>
  );
}
