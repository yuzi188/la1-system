"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "https://la1-backend-production.up.railway.app";

const STATUS_MAP = {
  done: { label: "成功", color: "#4CAF50" },
  waiting: { label: "等待中", color: "#FFA500" },
  pending: { label: "審核中", color: "#FFA500" },
  approved: { label: "已批准", color: "#4CAF50" },
  rejected: { label: "已拒絕", color: "#FF4444" },
  failed: { label: "失敗", color: "#FF4444" },
};

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | deposit | withdrawal

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("la1_token") : null;
    if (!token) {
      setLoading(false);
      setError("請先登入");
      return;
    }
    fetch(`${API}/api/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTransactions(data);
        } else {
          setError(data.error || "載入失敗");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("網路錯誤，請稍後再試");
        setLoading(false);
      });
  }, []);

  const cardStyle = {
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,215,0,0.2)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 0 15px rgba(0,191,255,0.06)",
  };

  const filtered = filter === "all"
    ? transactions
    : transactions.filter((t) => t.type === filter);

  function formatDate(str) {
    if (!str) return "—";
    const d = new Date(str);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <div
      className="fade-in"
      style={{ padding: "16px", paddingBottom: "100px", maxWidth: "480px", margin: "0 auto" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={() => router.back()}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            padding: "8px 14px",
            color: "#fff",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          ← 返回
        </button>
        <h1 style={{ fontSize: "20px", fontWeight: "bold", color: "#FFD700" }}>
          📋 交易紀錄
        </h1>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          background: "rgba(0,0,0,0.4)",
          borderRadius: "12px",
          padding: "4px",
          border: "1px solid rgba(255,215,0,0.1)",
        }}
      >
        {[
          { key: "all", label: "全部" },
          { key: "deposit", label: "充值" },
          { key: "withdrawal", label: "提款" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "bold",
              background: filter === tab.key
                ? "linear-gradient(135deg, #FFD700, #D4AF37)"
                : "transparent",
              color: filter === tab.key ? "#000" : "#888",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#FFD700" }}>
          載入中...
        </div>
      ) : error ? (
        <div
          style={{
            ...cardStyle,
            textAlign: "center",
            padding: "40px 20px",
            color: "#FF6347",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
          <div>{error}</div>
          {error === "請先登入" && (
            <a
              href="/login"
              style={{
                display: "inline-block",
                marginTop: "16px",
                padding: "10px 24px",
                background: "linear-gradient(135deg, #FFD700, #FFA500)",
                borderRadius: "10px",
                color: "#000",
                fontWeight: "bold",
                textDecoration: "none",
              }}
            >
              前往登入
            </a>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            ...cardStyle,
            textAlign: "center",
            padding: "60px 20px",
            color: "#555",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
          <div style={{ fontSize: "14px" }}>暫無交易紀錄</div>
        </div>
      ) : (
        <div style={cardStyle}>
          {/* Summary Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              marginBottom: "16px",
              paddingBottom: "16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                background: "rgba(255,215,0,0.08)",
                borderRadius: "10px",
                padding: "12px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "10px", color: "#888", marginBottom: "4px" }}>
                充值總額
              </div>
              <div style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700" }}>
                {transactions
                  .filter((t) => t.type === "deposit" && (t.status === "done" || t.status === "approved"))
                  .reduce((s, t) => s + (t.amount || 0), 0)
                  .toFixed(2)}{" "}
                U
              </div>
            </div>
            <div
              style={{
                background: "rgba(0,191,255,0.08)",
                borderRadius: "10px",
                padding: "12px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "10px", color: "#888", marginBottom: "4px" }}>
                提款總額
              </div>
              <div style={{ fontSize: "16px", fontWeight: "bold", color: "#00BFFF" }}>
                {transactions
                  .filter((t) => t.type === "withdrawal" && t.status === "approved")
                  .reduce((s, t) => s + (t.amount || 0), 0)
                  .toFixed(2)}{" "}
                U
              </div>
            </div>
          </div>

          {/* Transaction List */}
          {filtered.map((tx, i) => {
            const isDeposit = tx.type === "deposit";
            const statusInfo = STATUS_MAP[tx.status] || { label: tx.status, color: "#888" };
            return (
              <div
                key={`${tx.type}-${tx.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom:
                    i < filtered.length - 1
                      ? "1px solid rgba(255,255,255,0.05)"
                      : "none",
                }}
              >
                {/* Left: Icon + Info */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      background: isDeposit
                        ? "rgba(255,215,0,0.12)"
                        : "rgba(0,191,255,0.12)",
                      border: isDeposit
                        ? "1px solid rgba(255,215,0,0.25)"
                        : "1px solid rgba(0,191,255,0.25)",
                      flexShrink: 0,
                    }}
                  >
                    {isDeposit ? "💰" : "📤"}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#fff",
                        marginBottom: "2px",
                      }}
                    >
                      {isDeposit ? "充值" : "提款"}
                    </div>
                    <div style={{ fontSize: "11px", color: "#555" }}>
                      {formatDate(tx.created_at)}
                    </div>
                  </div>
                </div>

                {/* Right: Amount + Status */}
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: "bold",
                      color: isDeposit ? "#FFD700" : "#00BFFF",
                      marginBottom: "2px",
                    }}
                  >
                    {isDeposit ? "+" : "-"}
                    {(tx.amount || 0).toFixed(2)} U
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: statusInfo.color,
                      fontWeight: "bold",
                    }}
                  >
                    {statusInfo.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
