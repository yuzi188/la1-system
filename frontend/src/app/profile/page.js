"use client";
import { useTelegramAuth } from "../../hooks/useTelegramAuth";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { user, loading, isTgEnv, logout } = useTelegramAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#FFD700" }}>載入中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fade-in" style={{ padding: "16px", maxWidth: "480px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "20px", textAlign: "center", color: "#FFD700" }}>個人中心</h1>
        <div className="glass-panel" style={{ padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
          <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>請先登入</h2>
          {isTgEnv ? (
            <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "24px" }}>正在驗證 Telegram 身份...</p>
          ) : (
            <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "24px" }}>
              從 Telegram 打開即可自動登入，或點擊下方按鈕手動登入。
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <a href="/login" style={{
              padding: "14px",
              background: "linear-gradient(135deg, #FFD700, #FFA500)",
              borderRadius: "12px", color: "#000",
              fontWeight: "bold", textAlign: "center", textDecoration: "none",
            }}>手動登入 / 註冊</a>
            <a href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer" style={{
              padding: "14px",
              background: "rgba(0,191,255,0.1)",
              border: "1px solid rgba(0,191,255,0.3)",
              borderRadius: "12px", color: "#00BFFF",
              fontWeight: "bold", textAlign: "center", textDecoration: "none",
            }}>從 Telegram 打開</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: "16px", maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "bold", color: "#FFD700" }}>個人中心</h1>
        <button onClick={handleLogout} style={{
          background: "rgba(255,68,68,0.1)",
          border: "1px solid rgba(255,68,68,0.3)",
          borderRadius: "20px", color: "#ff6666",
          padding: "6px 14px", cursor: "pointer", fontSize: "12px",
        }}>登出</button>
      </div>

      {/* Avatar Card */}
      <div className="glass-panel" style={{
        padding: "24px",
        textAlign: "center",
        marginBottom: "16px",
        background: "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(0,191,255,0.05))",
      }}>
        <div style={{
          width: "72px", height: "72px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #FFD700, #D4AF37)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "32px", margin: "0 auto 12px",
          boxShadow: "0 0 25px rgba(255,215,0,0.4)",
          color: "#000", fontWeight: "900",
        }}>
          {isTgEnv ? "🤖" : "👤"}
        </div>
        <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>
          {user.first_name ? `${user.first_name}${user.last_name ? " " + user.last_name : ""}` : user.username}
        </h2>
        {user.username && user.first_name && (
          <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>@{user.username}</p>
        )}
        {isTgEnv && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "4px 12px",
            background: "rgba(0,191,255,0.1)",
            border: "1px solid rgba(0,191,255,0.3)",
            borderRadius: "20px", color: "#00BFFF", fontSize: "11px",
          }}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
              <path d="M21 4L3 11.3l5.8 2.1L18 7.6l-6.9 6.1.1 5L14 15.8l3.1 2.3L21 4Z" fill="#00BFFF"/>
            </svg>
            Telegram 已驗證
          </div>
        )}
        <div style={{
          display: "inline-block", marginTop: "8px",
          padding: "4px 14px",
          background: "rgba(255,215,0,0.12)",
          border: "1px solid rgba(255,215,0,0.3)",
          borderRadius: "20px", color: "#FFD700", fontSize: "12px", fontWeight: "bold",
        }}>{user.vip || "一般會員"}</div>
      </div>

      {/* Balance */}
      <div className="glass-panel" style={{ padding: "20px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <span style={{ fontSize: "13px", color: "#888" }}>帳戶餘額</span>
          <span style={{ fontSize: "26px", fontWeight: "900", color: "#FFD700" }}>
            $ {(user.balance || 0).toFixed(2)}
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <a href="/deposit" style={{
            flex: 1, padding: "12px",
            background: "linear-gradient(135deg, #FFD700, #FFA500)",
            borderRadius: "10px", color: "#000",
            fontWeight: "bold", textAlign: "center", textDecoration: "none", fontSize: "14px",
          }}>立即儲值</a>
          <a href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer" style={{
            flex: 1, padding: "12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px", color: "#fff",
            fontWeight: "bold", textAlign: "center", textDecoration: "none", fontSize: "14px",
          }}>申請提款</a>
        </div>
      </div>

      {/* Menu */}
      <div className="glass-panel" style={{ padding: "0 20px" }}>
        {[
          { icon: "📋", label: "交易記錄", href: "https://t.me/LA1111_bot" },
          { icon: "🎁", label: "領取優惠", href: "/activity" },
          { icon: "🤝", label: "推薦好友", href: "/activity" },
          { icon: "🔒", label: "安全中心", href: "https://t.me/LA1111_bot" },
          { icon: "📞", label: "聯繫客服", href: "/service" },
        ].map((item, i, arr) => (
          <a key={i} href={item.href} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 0",
            borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
            textDecoration: "none", color: "#fff",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "20px" }}>{item.icon}</span>
              <span style={{ fontSize: "14px" }}>{item.label}</span>
            </div>
            <span style={{ color: "#333", fontSize: "18px" }}>›</span>
          </a>
        ))}
      </div>
    </div>
  );
}
