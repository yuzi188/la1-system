"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DepositPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("usdt");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("la1_user");
    if (!stored) { router.push("/login"); return; }
    setUser(JSON.parse(stored));
  }, [router]);

  const presets = [100, 300, 500, 1000, 3000, 5000];

  const methods = [
    { id: "usdt", icon: "💎", label: "USDT", sub: "TRC20 / ERC20", badge: "推薦" },
    { id: "bank", icon: "🏦", label: "銀行轉帳", sub: "即時到帳", badge: "" },
    { id: "crypto", icon: "₿", label: "加密貨幣", sub: "BTC / ETH", badge: "" },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) < 50) return;
    setSubmitted(true);
  };

  if (!user) return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#FFD700" }}>載入中...</div>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #050510 0%, #0a0a0a 100%)",
      fontFamily: "'Segoe UI', sans-serif",
      color: "#fff",
      maxWidth: 480,
      margin: "0 auto",
      paddingBottom: 100,
    }}>
      {/* Top Bar */}
      <div style={{
        background: "rgba(0,0,0,0.95)",
        borderBottom: "1px solid rgba(255,215,0,0.15)",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <a href="/dashboard" style={{ color: "#FFD700", textDecoration: "none", fontSize: 20, lineHeight: 1 }}>‹</a>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>儲值入金</span>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#555" }}>
          餘額：<span style={{ color: "#FFD700", fontWeight: 700 }}>$ {(user.balance || 0).toFixed(2)}</span>
        </div>
      </div>

      {submitted ? (
        /* ── Success Screen ── */
        <div style={{ padding: "60px 24px", textAlign: "center" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(0,191,255,0.1))",
            border: "2px solid rgba(255,215,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, margin: "0 auto 20px",
            boxShadow: "0 0 40px rgba(255,215,0,0.2)",
          }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#FFD700", marginBottom: 8 }}>儲值申請已提交</div>
          <div style={{ color: "#888", fontSize: 14, lineHeight: 1.8, marginBottom: 32 }}>
            金額：<span style={{ color: "#fff", fontWeight: 700 }}>$ {Number(amount).toLocaleString()}</span><br/>
            方式：<span style={{ color: "#fff" }}>{methods.find(m => m.id === method)?.label}</span><br/>
            預計到帳：<span style={{ color: "#4CAF50" }}>5-15 分鐘</span>
          </div>
          <a href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "16px 24px",
            background: "linear-gradient(135deg, #FFD700, #1E90FF)",
            borderRadius: 14, color: "#000", fontWeight: 900, fontSize: 16,
            textDecoration: "none", marginBottom: 16,
            boxShadow: "0 0 30px rgba(255,215,0,0.3)",
          }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path d="M21 4L3 11.3l5.8 2.1L18 7.6l-6.9 6.1.1 5L14 15.8l3.1 2.3L21 4Z" fill="#000"/>
            </svg>
            聯繫客服確認入款
          </a>
          <button onClick={() => { setSubmitted(false); setAmount(""); }} style={{
            background: "none", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, color: "#666", padding: "12px 24px",
            cursor: "pointer", fontSize: 14, width: "100%",
          }}>再次儲值</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ padding: "16px" }}>

          {/* ── Method Select ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 10, letterSpacing: 1 }}>選擇儲值方式</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {methods.map((m) => (
                <button key={m.id} type="button" onClick={() => setMethod(m.id)} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px",
                  background: method === m.id
                    ? "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(30,144,255,0.06))"
                    : "rgba(255,255,255,0.03)",
                  border: method === m.id
                    ? "1px solid rgba(255,215,0,0.45)"
                    : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12, cursor: "pointer", textAlign: "left",
                }}>
                  <span style={{ fontSize: 26 }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: method === m.id ? "#FFD700" : "#fff", fontWeight: 700, fontSize: 15 }}>{m.label}</span>
                      {m.badge && (
                        <span style={{
                          fontSize: 10, padding: "2px 7px",
                          background: "rgba(255,215,0,0.2)", borderRadius: 10, color: "#FFD700",
                        }}>{m.badge}</span>
                      )}
                    </div>
                    <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>{m.sub}</div>
                  </div>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%",
                    border: method === m.id ? "5px solid #FFD700" : "2px solid #333",
                    transition: "all 0.2s",
                  }} />
                </button>
              ))}
            </div>
          </div>

          {/* ── Amount ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 10, letterSpacing: 1 }}>儲值金額（最低 $50）</div>
            {/* Preset buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              {presets.map((p) => (
                <button key={p} type="button" onClick={() => setAmount(String(p))} style={{
                  padding: "10px 4px",
                  background: amount === String(p)
                    ? "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(30,144,255,0.1))"
                    : "rgba(255,255,255,0.04)",
                  border: amount === String(p)
                    ? "1px solid rgba(255,215,0,0.5)"
                    : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, cursor: "pointer",
                  color: amount === String(p) ? "#FFD700" : "#aaa",
                  fontWeight: 700, fontSize: 14,
                }}>$ {p.toLocaleString()}</button>
              ))}
            </div>
            {/* Custom input */}
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                color: "#FFD700", fontWeight: 700, fontSize: 18,
              }}>$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="自定義金額"
                min="50"
                style={{
                  width: "100%",
                  padding: "14px 16px 14px 36px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,215,0,0.25)",
                  borderRadius: 10,
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          {/* ── Info Card ── */}
          <div style={{
            background: "rgba(0,191,255,0.05)",
            border: "1px solid rgba(0,191,255,0.15)",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 20,
          }}>
            {[
              ["到帳時間", "5-15 分鐘"],
              ["手續費", "免費"],
              ["最低儲值", "$ 50"],
              ["每日上限", "無限制"],
            ].map(([k, v]) => (
              <div key={k} style={{
                display: "flex", justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{ color: "#666", fontSize: 13 }}>{k}</span>
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* ── Submit ── */}
          <button type="submit" disabled={!amount || Number(amount) < 50} style={{
            width: "100%",
            padding: "17px",
            background: (!amount || Number(amount) < 50)
              ? "rgba(255,215,0,0.2)"
              : "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #1E90FF 100%)",
            border: "none",
            borderRadius: 14,
            color: (!amount || Number(amount) < 50) ? "#666" : "#000",
            fontWeight: 900,
            fontSize: 17,
            cursor: (!amount || Number(amount) < 50) ? "not-allowed" : "pointer",
            letterSpacing: 2,
            boxShadow: (!amount || Number(amount) < 50) ? "none" : "0 0 30px rgba(255,215,0,0.35)",
            transition: "all 0.2s",
            boxSizing: "border-box",
          }}>
            確認儲值 {amount && Number(amount) >= 50 ? `$ ${Number(amount).toLocaleString()}` : ""}
          </button>

          <div style={{ marginTop: 16, textAlign: "center" }}>
            <a href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer"
              style={{ color: "#00BFFF", fontSize: 13, textDecoration: "none" }}>
              需要協助？聯繫客服 @LA1111_bot
            </a>
          </div>
        </form>
      )}

      {/* ── Bottom Nav ── */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
        background: "rgba(5,5,16,0.97)",
        borderTop: "1px solid rgba(255,215,0,0.15)",
        display: "flex",
        zIndex: 200,
      }}>
        {[
          { icon: "🏠", label: "首頁", href: "/" },
          { icon: "🎮", label: "遊戲", href: "/#games" },
          { icon: "💰", label: "儲值", href: "/deposit", active: true },
          { icon: "👤", label: "會員", href: "/dashboard" },
          { icon: "💬", label: "客服", href: "https://t.me/LA1111_bot", external: true },
        ].map((item) => (
          <a key={item.label}
            href={item.href}
            target={item.external ? "_blank" : "_self"}
            rel={item.external ? "noopener noreferrer" : undefined}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", padding: "10px 4px 12px",
              textDecoration: "none", gap: 3,
            }}>
            <span style={{ fontSize: item.active ? 22 : 18 }}>{item.icon}</span>
            <span style={{ fontSize: 10, color: item.active ? "#FFD700" : "#555", fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
