"use client";

export default function MemberSection() {
  const handleMemberClick = (href) => {
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("la1_user");
      window.location.href = user ? href : "/login";
    }
  };

  return (
    <section id="member" className="section">
      <div className="container member-grid">
        <div className="glass panel">
          <div className="balance">
            <div>
              <p className="muted">會員中心</p>
              <h3 style={{ color: "#FFD700" }}>LA1 VIP 會員</h3>
            </div>
            <strong className="gradient">$ 0.00</strong>
          </div>
          <div className="feature-list">
            <div className="feature-item" style={{ cursor: "pointer" }}
              onClick={() => handleMemberClick("/dashboard")}>
              <span style={{ color: "#FFD700" }}>會員入口</span>
              <span className="muted">登入 / 儲值 / 查詢 ›</span>
            </div>
            <div className="feature-item" style={{ cursor: "pointer" }}
              onClick={() => handleMemberClick("/dashboard")}>
              <span style={{ color: "#FFD700" }}>AI 智能推薦</span>
              <span className="muted">個人化遊戲排序 ›</span>
            </div>
            <div className="feature-item" style={{ cursor: "pointer" }}
              onClick={() => handleMemberClick("/dashboard")}>
              <span style={{ color: "#FFD700" }}>VIP 升級</span>
              <span className="muted">專屬尊享福利 ›</span>
            </div>
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button onClick={() => handleMemberClick("/login")} style={{
              flex: 1,
              padding: "12px",
              background: "linear-gradient(135deg, #FFD700, #D4AF37)",
              border: "none",
              borderRadius: 10,
              color: "#000",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              letterSpacing: 1,
            }}>登入 / 註冊</button>
            <button onClick={() => handleMemberClick("/deposit")} style={{
              flex: 1,
              padding: "12px",
              background: "linear-gradient(135deg, rgba(0,191,255,0.2), rgba(30,144,255,0.1))",
              border: "1px solid rgba(0,191,255,0.4)",
              borderRadius: 10,
              color: "#00BFFF",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              letterSpacing: 1,
            }}>立即儲值</button>
          </div>
        </div>

        <div className="glass panel">
          <p className="muted">儲值與客服</p>
          <h3 style={{ color: "#FFD700" }}>Telegram 聯繫我們</h3>
          <p className="muted" style={{ marginTop: 10, lineHeight: 1.9 }}>
            全天候客服支援，快速儲值、即時提款，頂級 VIP 服務隨時待命。
          </p>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <a className="tg-big" href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer">
              <span className="tg-icon">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
                  <path d="M21 4L3 11.3l5.8 2.1L18 7.6l-6.9 6.1.1 5L14 15.8l3.1 2.3L21 4Z" fill="#000"/>
                </svg>
              </span>
              @LA1111_bot 聯繫客服
            </a>
            <button onClick={() => handleMemberClick("/deposit")} style={{
              width: "100%",
              padding: "14px",
              background: "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(30,144,255,0.1))",
              border: "1px solid rgba(255,215,0,0.3)",
              borderRadius: 10,
              color: "#FFD700",
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
              letterSpacing: 1,
            }}>💰 立即儲值入金</button>
          </div>
        </div>
      </div>
    </section>
  );
}
