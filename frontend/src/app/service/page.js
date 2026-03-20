"use client";
import { useState, useEffect } from "react";

export default function ServicePage() {
  const [checking, setChecking] = useState(true);
  const [nodes, setNodes] = useState([
    { name: "亞太節點 1", ping: "24ms", status: "優" },
    { name: "亞太節點 2", ping: "31ms", status: "優" },
    { name: "歐美節點", ping: "156ms", status: "良" }
  ]);

  useEffect(() => {
    const timer = setTimeout(() => setChecking(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fade-in" style={{ padding: "16px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px", textAlign: "center", color: "#FFD700" }}>24H 在線客服</h1>
      
      <div className="glass-panel" style={{
        padding: "24px",
        textAlign: "center",
        marginBottom: "24px",
        background: "linear-gradient(135deg, rgba(255,215,0,0.1), rgba(0,191,255,0.1))"
      }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎧</div>
        <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>需要幫助嗎？</h2>
        <p style={{ fontSize: "14px", color: "#aaa", marginBottom: "24px" }}>我們的客服團隊 24/7 全天候為您服務</p>
        
        <a href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer" className="pulse-gold" style={{
          display: "inline-block",
          padding: "14px 32px",
          background: "linear-gradient(135deg, #FFD700, #FFA500)",
          borderRadius: "30px",
          color: "#000",
          fontWeight: "bold",
          textDecoration: "none",
          fontSize: "16px"
        }}>聯繫 Telegram 客服</a>
      </div>

      <div className="glass-panel" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold" }}>環境檢測</h3>
          {checking && <span style={{ fontSize: "12px", color: "#FFD700" }}>檢測中...</span>}
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {nodes.map((node, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.05)"
            }}>
              <span style={{ fontSize: "14px" }}>{node.name}</span>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#666" }}>{node.ping}</span>
                <span style={{ 
                  fontSize: "12px", 
                  color: node.status === "優" ? "#4CAF50" : "#FFD700",
                  fontWeight: "bold"
                }}>{node.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
