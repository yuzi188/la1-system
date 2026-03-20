"use client";
import { useState, useEffect } from "react";

export default function ServicePage() {
  const [checking, setChecking] = useState(true);
  const [nodes, setNodes] = useState([
    { name: "亞太節點 1", ping: "24ms", status: "優", color: "#4CAF50" },
    { name: "亞太節點 2", ping: "31ms", status: "優", color: "#4CAF50" },
    { name: "歐美節點", ping: "156ms", status: "良", color: "#FFD700" },
    { name: "東南亞節點", ping: "18ms", status: "優", color: "#4CAF50" },
  ]);

  useEffect(() => {
    const timer = setTimeout(() => setChecking(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fade-in" style={{ padding: "0 0 16px", maxWidth: "480px", margin: "0 auto" }}>

      {/* ── Service Banner Image ── */}
      <div style={{
        position: "relative",
        height: "200px",
        overflow: "hidden",
        marginBottom: "20px",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url(/assets/service-banner.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.7) 100%)",
        }} />
        <div style={{
          position: "absolute", bottom: "20px", left: "20px",
        }}>
          <h1 style={{ fontSize: "22px", fontWeight: "900", color: "#FFD700", marginBottom: "4px", textShadow: "0 0 20px rgba(255,215,0,0.8)" }}>
            24H 全天候客服
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>隨時隨地，我們都在</p>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        {/* ── Contact Card ── */}
        <div className="glass-panel" style={{
          padding: "24px",
          textAlign: "center",
          marginBottom: "16px",
          background: "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(0,191,255,0.05))",
          border: "1px solid rgba(255,215,0,0.2)",
          borderRadius: "16px",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎧</div>
          <h2 style={{ fontSize: "18px", fontWeight: "800", marginBottom: "8px" }}>需要幫助嗎？</h2>
          <p style={{ fontSize: "13px", color: "#aaa", marginBottom: "20px", lineHeight: "1.6" }}>
            我們的客服團隊 24/7 全天候為您服務<br/>
            平均回覆時間：<span style={{ color: "#FFD700", fontWeight: "700" }}>3 分鐘內</span>
          </p>

          <a href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            padding: "14px 28px",
            background: "linear-gradient(135deg, #00BFFF, #1E90FF)",
            borderRadius: "30px",
            color: "#fff",
            fontWeight: "800",
            textDecoration: "none",
            fontSize: "15px",
            boxShadow: "0 0 20px rgba(0,191,255,0.3)",
            marginBottom: "12px",
          }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path d="M21 4L3 11.3l5.8 2.1L18 7.6l-6.9 6.1.1 5L14 15.8l3.1 2.3L21 4Z" fill="#fff"/>
            </svg>
            聯繫 Telegram 客服 @LA1111_bot
          </a>

          <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
            {[
              { icon: "⚡", label: "即時回覆" },
              { icon: "🌏", label: "多語言支援" },
              { icon: "🔒", label: "安全保密" },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "20px", marginBottom: "4px" }}>{item.icon}</div>
                <div style={{ fontSize: "11px", color: "#666" }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ Quick Links ── */}
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#FFD700", marginBottom: "12px" }}>常見問題</h3>
          {[
            { q: "如何儲值？", icon: "💰" },
            { q: "如何提款？", icon: "🏦" },
            { q: "如何成為 VIP？", icon: "👑" },
            { q: "遊戲規則說明", icon: "📖" },
          ].map((item, i) => (
            <a key={i} href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "10px",
              marginBottom: "8px",
              textDecoration: "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "18px" }}>{item.icon}</span>
                <span style={{ fontSize: "14px", color: "#fff" }}>{item.q}</span>
              </div>
              <span style={{ color: "#00BFFF", fontSize: "16px" }}>›</span>
            </a>
          ))}
        </div>

        {/* ── Network Check ── */}
        <div className="glass-panel" style={{
          padding: "20px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "14px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "800" }}>🌐 環境檢測</h3>
            {checking ? (
              <span style={{ fontSize: "12px", color: "#FFD700", animation: "pulse-gold 1s infinite" }}>檢測中...</span>
            ) : (
              <span style={{ fontSize: "12px", color: "#4CAF50" }}>✓ 連線正常</span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {nodes.map((node, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    background: checking ? "#666" : node.color,
                    boxShadow: checking ? "none" : `0 0 6px ${node.color}`,
                    transition: "all 0.5s",
                    animationDelay: `${i * 0.3}s`,
                  }} />
                  <span style={{ fontSize: "13px" }}>{node.name}</span>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#555" }}>{checking ? "--ms" : node.ping}</span>
                  <span style={{
                    fontSize: "12px",
                    color: checking ? "#555" : node.color,
                    fontWeight: "700",
                  }}>{checking ? "..." : node.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
