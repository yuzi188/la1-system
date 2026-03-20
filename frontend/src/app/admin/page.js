"use client";
import { useState, useEffect, useCallback } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://la1-backend-production.up.railway.app";

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    paddingBottom: "40px",
  },
  header: {
    background: "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(0,191,255,0.05))",
    borderBottom: "1px solid rgba(255,215,0,0.15)",
    padding: "16px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  logoBadge: {
    width: "36px",
    height: "36px",
    background: "linear-gradient(135deg, #FFD700, #D4AF37)",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
    color: "#000",
    fontSize: "11px",
    boxShadow: "0 0 15px rgba(255,215,0,0.3)",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,215,0,0.15)",
    borderRadius: "16px",
    padding: "24px",
    backdropFilter: "blur(10px)",
  },
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,215,0,0.2)",
    borderRadius: "10px",
    padding: "12px 16px",
    color: "#fff",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  },
  btnGold: {
    background: "linear-gradient(135deg, #FFD700, #FFA500)",
    border: "none",
    borderRadius: "10px",
    padding: "12px 24px",
    color: "#000",
    fontWeight: "800",
    fontSize: "15px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  btnBlue: {
    background: "linear-gradient(135deg, #00BFFF, #1E90FF)",
    border: "none",
    borderRadius: "8px",
    padding: "6px 14px",
    color: "#fff",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
  },
  btnRed: {
    background: "linear-gradient(135deg, #FF4444, #CC0000)",
    border: "none",
    borderRadius: "8px",
    padding: "6px 14px",
    color: "#fff",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
  },
  tag: (color) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: "700",
    background: `rgba(${color},0.15)`,
    color: `rgb(${color})`,
    border: `1px solid rgba(${color},0.3)`,
  }),
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.8)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "20px",
  },
  modal: {
    background: "#0a0a0a",
    border: "1px solid rgba(255,215,0,0.3)",
    borderRadius: "20px",
    padding: "28px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 0 60px rgba(255,215,0,0.1)",
  },
};

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!pw) return setErr("請輸入密碼");
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${BACKEND}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.token) {
        sessionStorage.setItem("la1_admin_token", data.token);
        onLogin(data.token);
      } else {
        setErr(data.error || "登入失敗");
      }
    } catch (e) {
      setErr("無法連接後端，請稍後再試");
    }
    setLoading(false);
  };

  return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...S.card, width: "100%", maxWidth: "380px", textAlign: "center" }}>
        <div style={{ ...S.logoBadge, margin: "0 auto 20px", width: "56px", height: "56px", fontSize: "18px", borderRadius: "14px" }}>LA1</div>
        <h1 style={{ fontSize: "22px", fontWeight: "900", marginBottom: "6px" }}>後台管理系統</h1>
        <p style={{ color: "#666", fontSize: "13px", marginBottom: "28px" }}>LA1 AI 娛樂平台 · 管理員入口</p>

        <input
          type="password"
          placeholder="請輸入管理員密碼"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          style={{ ...S.input, marginBottom: "12px", textAlign: "center", letterSpacing: "4px" }}
        />
        {err && <p style={{ color: "#FF4444", fontSize: "13px", marginBottom: "12px" }}>{err}</p>}
        <button onClick={handleLogin} disabled={loading} style={{ ...S.btnGold, width: "100%" }}>
          {loading ? "驗證中..." : "🔐 登入後台"}
        </button>
      </div>
    </div>
  );
}

// ── Adjust Balance Modal ──────────────────────────────────────────────────────
function AdjustModal({ user, type, token, onClose, onSuccess }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return setErr("請輸入有效金額");
    }
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${BACKEND}/admin/adjust-balance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.id, amount: parseFloat(amount), type, reason }),
      });
      const data = await res.json();
      if (data.ok) {
        onSuccess(data);
      } else {
        setErr(data.error || "操作失敗");
      }
    } catch (e) {
      setErr("網路錯誤，請重試");
    }
    setLoading(false);
  };

  const isAdd = type === "add";
  const displayName = user.tg_first_name || user.tg_username || user.username;

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "900", color: isAdd ? "#FFD700" : "#FF4444" }}>
            {isAdd ? "⬆️ 手動上分" : "⬇️ 手動扣分"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: "20px", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "12px 16px",
          marginBottom: "20px",
        }}>
          <div style={{ fontSize: "13px", color: "#888", marginBottom: "4px" }}>操作對象</div>
          <div style={{ fontWeight: "700" }}>{displayName}</div>
          {user.tg_username && <div style={{ fontSize: "12px", color: "#00BFFF" }}>@{user.tg_username}</div>}
          <div style={{ fontSize: "13px", color: "#FFD700", marginTop: "4px" }}>
            當前餘額：<strong>${parseFloat(user.balance || 0).toFixed(2)} USDT</strong>
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ fontSize: "13px", color: "#888", display: "block", marginBottom: "6px" }}>
            {isAdd ? "上分金額 (USDT)" : "扣分金額 (USDT)"}
          </label>
          <input
            type="number"
            placeholder="例：100"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={S.input}
            min="0"
            step="0.01"
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontSize: "13px", color: "#888", display: "block", marginBottom: "6px" }}>備註（可選）</label>
          <input
            type="text"
            placeholder="例：首充獎勵、活動獎金..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={S.input}
          />
        </div>

        {err && <p style={{ color: "#FF4444", fontSize: "13px", marginBottom: "12px" }}>{err}</p>}

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px", color: "#fff",
            fontWeight: "700", cursor: "pointer", fontSize: "14px",
          }}>取消</button>
          <button onClick={handleSubmit} disabled={loading} style={{
            flex: 2, padding: "12px",
            background: isAdd ? "linear-gradient(135deg, #FFD700, #FFA500)" : "linear-gradient(135deg, #FF4444, #CC0000)",
            border: "none", borderRadius: "10px",
            color: isAdd ? "#000" : "#fff",
            fontWeight: "800", cursor: "pointer", fontSize: "14px",
          }}>
            {loading ? "處理中..." : (isAdd ? `確認上分 ${amount ? `$${amount}` : ""}` : `確認扣分 ${amount ? `$${amount}` : ""}`)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Admin Panel ──────────────────────────────────────────────────────────
function AdminPanel({ token, onLogout }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // { user, type }
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState({ total: 0, tg: 0, totalBalance: 0 });

  const showToast = (msg, color = "#4CAF50") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const url = q
        ? `${BACKEND}/admin/users?q=${encodeURIComponent(q)}`
        : `${BACKEND}/admin/users`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      setUsers(data);
      setStats({
        total: data.length,
        tg: data.filter(u => u.tg_id).length,
        totalBalance: data.reduce((s, u) => s + (u.balance || 0), 0),
      });
    } catch (e) {
      showToast("無法載入用戶列表", "#FF4444");
    }
    setLoading(false);
  }, [token, onLogout]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    const timer = setTimeout(() => fetchUsers(q), 400);
    return () => clearTimeout(timer);
  };

  const handleAdjustSuccess = (data) => {
    setModal(null);
    showToast(`✅ ${data.message}`);
    fetchUsers(search);
  };

  const formatDate = (dt) => {
    if (!dt) return "-";
    return new Date(dt).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={S.page}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)",
          background: toast.color, color: "#fff", padding: "12px 24px",
          borderRadius: "30px", fontWeight: "700", fontSize: "14px",
          zIndex: 10000, boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          animation: "fadeIn 0.3s ease",
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>
          <div style={S.logoBadge}>LA1</div>
          <div>
            <div style={{ fontWeight: "900", fontSize: "16px" }}>後台管理系統</div>
            <div style={{ fontSize: "11px", color: "#00BFFF" }}>LA1 AI 娛樂平台</div>
          </div>
        </div>
        <button onClick={onLogout} style={{
          background: "rgba(255,68,68,0.1)",
          border: "1px solid rgba(255,68,68,0.3)",
          borderRadius: "20px", color: "#ff6666",
          padding: "6px 16px", cursor: "pointer", fontSize: "13px",
        }}>登出</button>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "總用戶數", value: stats.total, icon: "👥", color: "255,215,0" },
            { label: "TG 用戶", value: stats.tg, icon: "🤖", color: "0,191,255" },
            { label: "總餘額", value: `$${stats.totalBalance.toFixed(0)}`, icon: "💰", color: "255,215,0" },
          ].map((s, i) => (
            <div key={i} style={{
              background: `rgba(${s.color},0.05)`,
              border: `1px solid rgba(${s.color},0.15)`,
              borderRadius: "12px", padding: "16px 12px", textAlign: "center",
            }}>
              <div style={{ fontSize: "24px", marginBottom: "4px" }}>{s.icon}</div>
              <div style={{ fontSize: "20px", fontWeight: "900", color: `rgb(${s.color})` }}>{s.value}</div>
              <div style={{ fontSize: "11px", color: "#666" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: "20px" }}>
          <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "16px" }}>🔍</span>
          <input
            type="text"
            placeholder="搜尋用戶名、TG ID、TG 用戶名..."
            value={search}
            onChange={handleSearch}
            style={{ ...S.input, paddingLeft: "40px" }}
          />
        </div>

        {/* User List */}
        <div style={{ ...S.card, padding: "0" }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontWeight: "800", fontSize: "15px" }}>
              用戶列表 {loading ? "⏳" : `(${users.length})`}
            </span>
            <button onClick={() => fetchUsers(search)} style={{
              background: "rgba(255,215,0,0.1)",
              border: "1px solid rgba(255,215,0,0.2)",
              borderRadius: "8px", color: "#FFD700",
              padding: "6px 12px", cursor: "pointer", fontSize: "12px",
            }}>🔄 刷新</button>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>載入中...</div>
          ) : users.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
              {search ? "找不到符合的用戶" : "暫無用戶"}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              {/* Desktop Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {["ID", "用戶名", "TG 資訊", "TG ID", "餘額", "等級", "註冊時間", "操作"].map(h => (
                      <th key={h} style={{
                        padding: "12px 16px", textAlign: "left",
                        fontSize: "12px", color: "#666", fontWeight: "700",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, i) => (
                    <tr key={user.id} style={{
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                      transition: "background 0.2s",
                    }}>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#666" }}>#{user.id}</td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: "600" }}>
                        {user.username}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {user.tg_first_name ? (
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: "600" }}>{user.tg_first_name}{user.tg_last_name ? " " + user.tg_last_name : ""}</div>
                            {user.tg_username && <div style={{ fontSize: "11px", color: "#00BFFF" }}>@{user.tg_username}</div>}
                          </div>
                        ) : <span style={{ color: "#444", fontSize: "12px" }}>—</span>}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {user.tg_id ? (
                          <span style={S.tag("0,191,255")}>{user.tg_id}</span>
                        ) : <span style={{ color: "#444", fontSize: "12px" }}>—</span>}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: "800", color: "#FFD700", fontSize: "14px" }}>
                          ${parseFloat(user.balance || 0).toFixed(2)}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={S.tag(user.level === "vip" ? "255,215,0" : "100,100,100")}>
                          {user.level === "vip" ? "VIP" : "一般"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "12px", color: "#666" }}>
                        {formatDate(user.created_at)}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => setModal({ user, type: "add" })}
                            style={S.btnBlue}
                          >⬆️ 上分</button>
                          <button
                            onClick={() => setModal({ user, type: "deduct" })}
                            style={S.btnRed}
                          >⬇️ 扣分</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Adjust Balance Modal */}
      {modal && (
        <AdjustModal
          user={modal.user}
          type={modal.type}
          token={token}
          onClose={() => setModal(null)}
          onSuccess={handleAdjustSuccess}
        />
      )}
    </div>
  );
}

// ── Root Component ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [token, setToken] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("la1_admin_token");
    if (stored) setToken(stored);
    setChecked(true);
  }, []);

  const handleLogin = (t) => setToken(t);
  const handleLogout = () => {
    sessionStorage.removeItem("la1_admin_token");
    setToken(null);
  };

  if (!checked) return null;
  if (!token) return <LoginScreen onLogin={handleLogin} />;
  return <AdminPanel token={token} onLogout={handleLogout} />;
}
