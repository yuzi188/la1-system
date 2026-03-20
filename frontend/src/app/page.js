"use client";
import { useState, useEffect } from "react";

export default function HomePage() {
  const [balance, setBalance] = useState(0.0);
  const [activeTab, setActiveTab] = useState("最愛");

  const players = [
    "賭神小明", "歐皇附體", "梭哈戰士", "一夜暴富", "幸運鯨魚", "百家樂之王", "輪盤殺手", "金幣獵人", "不賭不行", "佛系玩家",
    "暴走老虎機", "提款王者", "反水達人", "VIP大佬", "今晚吃雞", "翻倍狂人", "運氣爆棚", "零元購神", "逆風翻盤", "穩如老狗",
    "單手開法拉利", "全場我最靚", "發財手", "幸運女神眷顧", "賭聖阿星", "龍抬頭", "大吉大利", "財源滾滾", "躺著也賺錢", "橫財就手",
    "賭場清道夫", "提款機本人", "歐氣滿滿", "天選之子", "暴富小能手", "金庫管理員", "幸運錦鯉", "財神爺敲門", "發財夢想家", "贏到手軟"
  ];

  const actions = [
    "贏了", "儲值了", "提款了", "獲得獎金"
  ];

  const amounts = [100, 500, 1000, 5000, 10000, 50000];

  const marqueeItems = Array.from({ length: 40 }).map((_, i) => {
    const player = players[i % players.length];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const amount = amounts[Math.floor(Math.random() * amounts.length)];
    return `🎉 ${player} ${action} $${amount.toLocaleString()} | `;
  });

  const gameTabs = ["最愛", "電子", "真人", "捕魚"];

  const banners = [
    { title: "VIP 專屬待遇", sub: "尊享私人客服與高額返水", color: "linear-gradient(135deg, #FFD700, #D4AF37)" },
    { title: "首充豪禮", sub: "最高贈送 100% 獎金", color: "linear-gradient(135deg, #00BFFF, #1E90FF)" },
    { title: "邀請好友", sub: "賺取永久佣金回報", color: "linear-gradient(135deg, #FF4500, #FF8C00)" }
  ];

  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fade-in" style={{ padding: "16px" }}>
      {/* --- Top Bar --- */}
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            background: "linear-gradient(135deg, #FFD700, #D4AF37)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            color: "#000"
          }}>LA1</div>
          <span style={{ fontWeight: "bold", fontSize: "18px", letterSpacing: "1px" }}>LA1 AI</span>
        </div>
        <div style={{
          background: "rgba(255,255,255,0.1)",
          padding: "6px 12px",
          borderRadius: "20px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          border: "1px solid rgba(255,215,0,0.3)"
        }}>
          <span style={{ color: "#FFD700", fontWeight: "bold" }}>$ {balance.toFixed(2)}</span>
          <button 
            onClick={() => setBalance(prev => prev + 100)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}
          >🔄</button>
        </div>
      </header>

      {/* --- Banner Carousel --- */}
      <div className="banner-carousel" style={{ marginBottom: "20px" }}>
        <div className="banner-item" style={{
          background: banners[currentBanner].color,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "20px",
          position: "relative",
          overflow: "hidden"
        }}>
          <h2 style={{ fontSize: "24px", marginBottom: "8px", color: "#000" }}>{banners[currentBanner].title}</h2>
          <p style={{ fontSize: "14px", color: "rgba(0,0,0,0.7)" }}>{banners[currentBanner].sub}</p>
          <div style={{
            position: "absolute",
            right: "-20px",
            bottom: "-20px",
            fontSize: "100px",
            opacity: 0.2
          }}>🐼</div>
        </div>
      </div>

      {/* --- Marquee --- */}
      <div className="marquee-container" style={{
        background: "rgba(255,215,0,0.05)",
        padding: "8px 0",
        borderRadius: "8px",
        marginBottom: "20px",
        border: "1px solid rgba(255,215,0,0.1)"
      }}>
        <div className="marquee-content" style={{ fontSize: "12px", color: "#FFD700" }}>
          {marqueeItems.join("")}{marqueeItems.join("")}
        </div>
      </div>

      {/* --- Quick Actions --- */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "10px",
        marginBottom: "24px"
      }}>
        {[
          { icon: "💰", label: "存提款", href: "/deposit" },
          { icon: "📈", label: "我的收入", href: "/profile" },
          { icon: "🤝", label: "邀請好友", href: "/activity" },
          { icon: "📋", label: "任務中心", href: "/activity" },
          { icon: "👑", label: "VIP", href: "/activity" }
        ].map((item, i) => (
          <a key={i} href={item.href} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            textDecoration: "none"
          }}>
            <div className="pulse-gold" style={{
              width: "48px",
              height: "48px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              border: "1px solid rgba(255,215,0,0.2)"
            }}>{item.icon}</div>
            <span style={{ fontSize: "11px", color: "#aaa" }}>{item.label}</span>
          </a>
        ))}
      </div>

      {/* --- Game Tabs --- */}
      <div style={{
        display: "flex",
        gap: "24px",
        marginBottom: "16px",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        paddingBottom: "8px"
      }}>
        {gameTabs.map(tab => (
          <span 
            key={tab}
            className={`nav-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
            style={{ fontSize: "16px", fontWeight: "bold", cursor: "pointer", color: activeTab === tab ? "#FFD700" : "#666" }}
          >{tab}</span>
        ))}
      </div>

      {/* --- Game Cards --- */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "16px",
        marginBottom: "20px"
      }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="game-card glass-panel" style={{
            height: "180px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "12px",
            background: `linear-gradient(to bottom, transparent, rgba(0,0,0,0.8)), url('https://via.placeholder.com/200x180/111/FFD700?text=Game+${i}')`,
            backgroundSize: "cover"
          }}>
            <span style={{ fontWeight: "bold", fontSize: "14px" }}>熱門遊戲 {i}</span>
            <span style={{ fontSize: "10px", color: "#FFD700" }}>立即遊玩 ›</span>
          </div>
        ))}
      </div>

      {/* --- Horizontal Scroll Section --- */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
          <span style={{ fontWeight: "bold", color: "#FFD700" }}>推薦遊戲</span>
          <span style={{ fontSize: "12px", color: "#666" }}>查看更多</span>
        </div>
        <div className="no-scrollbar" style={{
          display: "flex",
          gap: "12px",
          overflowX: "auto",
          paddingBottom: "10px"
        }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="game-card glass-panel" style={{
              minWidth: "120px",
              height: "150px",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: "10px",
              background: `linear-gradient(to bottom, transparent, rgba(0,0,0,0.8)), url('https://via.placeholder.com/120x150/111/00BFFF?text=Hot+${i}')`,
              backgroundSize: "cover"
            }}>
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>推薦 {i}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
