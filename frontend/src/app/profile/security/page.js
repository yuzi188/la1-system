"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "https://la1-backend-production.up.railway.app";

export default function SecurityPage() {
  const router = useRouter();

  // Profile state
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Nickname state
  const [nickname, setNickname] = useState("");
  const [nicknameMsg, setNicknameMsg] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarMsg, setAvatarMsg] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Backup login state
  const [backupUsername, setBackupUsername] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [backupConfirmPassword, setBackupConfirmPassword] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const [backupSaving, setBackupSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState("");

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("la1_token") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API}/api/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setProfile(data);
          setNickname(data.nickname || "");
          setAvatarPreview(data.avatar || "");
          if (data.backup_username) setBackupUsername(data.backup_username);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleNicknameSave() {
    if (!nickname.trim()) {
      setNicknameMsg("❌ 暱稱不能為空");
      return;
    }
    if (nickname.trim().length < 2 || nickname.trim().length > 20) {
      setNicknameMsg("❌ 暱稱長度需在 2~20 個字元之間");
      return;
    }
    const token = localStorage.getItem("la1_token");
    if (!token) return;
    setNicknameSaving(true);
    setNicknameMsg("");
    try {
      const res = await fetch(`${API}/api/user/nickname`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setProfile((prev) => ({ ...prev, nickname: data.nickname, nickname_changed: 1 }));
        setNicknameMsg("✅ 已修改");
        showToast("✅ 暱稱已成功更新！");
      } else {
        setNicknameMsg("❌ " + (data.error || "修改失敗"));
      }
    } catch {
      setNicknameMsg("❌ 網路錯誤，請稍後再試");
    }
    setNicknameSaving(false);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarMsg("❌ 請選擇圖片檔案");
      return;
    }
    if (file.size > 500 * 1024) {
      setAvatarMsg("❌ 圖片過大，請選擇小於 500KB 的圖片");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarPreview(ev.target.result);
      setAvatarMsg("");
    };
    reader.readAsDataURL(file);
  }

  async function handleAvatarSave() {
    if (!avatarPreview || !avatarPreview.startsWith("data:image/")) {
      setAvatarMsg("❌ 請先選擇圖片");
      return;
    }
    const token = localStorage.getItem("la1_token");
    if (!token) return;
    setAvatarSaving(true);
    setAvatarMsg("");
    try {
      const res = await fetch(`${API}/api/user/avatar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: avatarPreview }),
      });
      const data = await res.json();
      if (data.ok) {
        setProfile((prev) => ({ ...prev, avatar: avatarPreview }));
        setAvatarMsg("✅ 頭像已更新");
        showToast("✅ 頭像已成功更新！");
      } else {
        setAvatarMsg("❌ " + (data.error || "更新失敗"));
      }
    } catch {
      setAvatarMsg("❌ 網路錯誤，請稍後再試");
    }
    setAvatarSaving(false);
  }

  const cardStyle = {
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,215,0,0.2)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 0 15px rgba(0,191,255,0.06)",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,215,0,0.2)",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const btnPrimaryStyle = {
    padding: "12px 24px",
    background: "linear-gradient(135deg, #FFD700, #D4AF37)",
    border: "none",
    borderRadius: "10px",
    color: "#000",
    fontWeight: "bold",
    fontSize: "14px",
    cursor: "pointer",
  };

  const btnDisabledStyle = {
    ...btnPrimaryStyle,
    background: "rgba(255,255,255,0.08)",
    color: "#555",
    cursor: "not-allowed",
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFD700",
        }}
      >
        載入中...
      </div>
    );
  }

  if (!profile) {
    return (
      <div
        className="fade-in"
        style={{ padding: "16px", textAlign: "center", paddingTop: "80px" }}
      >
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>🔒</div>
        <h2 style={{ color: "#FFD700", marginBottom: "8px" }}>請先登入</h2>
        <a
          href="/login"
          style={{
            display: "inline-block",
            marginTop: "12px",
            padding: "12px 32px",
            background: "linear-gradient(135deg, #FFD700, #FFA500)",
            borderRadius: "12px",
            color: "#000",
            fontWeight: "bold",
            textDecoration: "none",
          }}
        >
          前往登入
        </a>
      </div>
    );
  }

  const nicknameChanged = profile?.nickname_changed === 1;
  const currentAvatar = profile?.avatar || "";
  const displayName = profile?.display_name || "";

  return (
    <div
      className="fade-in"
      style={{ padding: "16px", paddingBottom: "100px", maxWidth: "480px", margin: "0 auto" }}
    >
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.95)",
            border: "1px solid #FFD700",
            padding: "12px 24px",
            borderRadius: "12px",
            zIndex: 9999,
            color: "#FFD700",
            fontWeight: "bold",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}

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
          🔒 安全中心
        </h1>
      </div>

      {/* ── Section 1: 修改暱稱 ── */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(255,215,0,0.12)",
              border: "1px solid rgba(255,215,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            ✏️
          </div>
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: "bold", color: "#FFD700", margin: 0 }}>
              修改暱稱
            </h3>
            <p style={{ fontSize: "11px", color: "#666", margin: "2px 0 0" }}>
              暱稱只能修改一次，請謹慎填寫
            </p>
          </div>
        </div>

        {/* Current nickname display */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: "10px",
            padding: "10px 14px",
            marginBottom: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "12px", color: "#888" }}>目前暱稱</span>
          <span style={{ fontSize: "14px", fontWeight: "bold", color: "#fff" }}>
            {profile?.nickname || displayName || "（未設定）"}
          </span>
        </div>

        {nicknameChanged ? (
          /* Already changed — show locked state */
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: "10px",
              padding: "14px",
              textAlign: "center",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>🔒</div>
            <div
              style={{
                fontSize: "13px",
                color: "#888",
                marginBottom: "4px",
              }}
            >
              已修改
            </div>
            <div style={{ fontSize: "11px", color: "#555" }}>
              暱稱已鎖定，無法再次更改
            </div>
          </div>
        ) : (
          /* Can still change */
          <div>
            <div style={{ marginBottom: "10px" }}>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="輸入新暱稱（2~20 個字元）"
                maxLength={20}
                style={inputStyle}
                onKeyDown={(e) => e.key === "Enter" && handleNicknameSave()}
              />
              <div
                style={{
                  fontSize: "11px",
                  color: "#555",
                  textAlign: "right",
                  marginTop: "4px",
                }}
              >
                {nickname.length}/20
              </div>
            </div>
            {nicknameMsg && (
              <div
                style={{
                  fontSize: "13px",
                  color: nicknameMsg.startsWith("✅") ? "#4CAF50" : "#FF6347",
                  marginBottom: "10px",
                  fontWeight: "bold",
                }}
              >
                {nicknameMsg}
              </div>
            )}
            <button
              onClick={handleNicknameSave}
              disabled={nicknameSaving}
              style={nicknameSaving ? btnDisabledStyle : btnPrimaryStyle}
            >
              {nicknameSaving ? "儲存中..." : "確認修改"}
            </button>
            <div
              style={{
                fontSize: "11px",
                color: "#FF8C00",
                marginTop: "8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ⚠️ 注意：暱稱修改後無法再次更改
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: 更換大頭照 ── */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(0,191,255,0.12)",
              border: "1px solid rgba(0,191,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            🖼️
          </div>
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: "bold", color: "#FFD700", margin: 0 }}>
              更換大頭照
            </h3>
            <p style={{ fontSize: "11px", color: "#666", margin: "2px 0 0" }}>
              支援 JPG、PNG、GIF，最大 500KB
            </p>
          </div>
        </div>

        {/* Avatar Preview */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <div
            style={{
              width: "90px",
              height: "90px",
              borderRadius: "50%",
              margin: "0 auto 12px",
              overflow: "hidden",
              border: "3px solid rgba(255,215,0,0.4)",
              boxShadow: "0 0 20px rgba(255,215,0,0.2)",
              background: "linear-gradient(135deg, #FFD700, #D4AF37)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              color: "#000",
              fontWeight: "900",
            }}
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              displayName?.charAt(0)?.toUpperCase() || "👤"
            )}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            {avatarPreview && avatarPreview !== currentAvatar
              ? "預覽（尚未儲存）"
              : currentAvatar
              ? "目前頭像"
              : "尚未設定頭像"}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />

        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: "100%",
            padding: "12px",
            background: "rgba(0,191,255,0.1)",
            border: "1px solid rgba(0,191,255,0.3)",
            borderRadius: "10px",
            color: "#00BFFF",
            fontWeight: "bold",
            fontSize: "14px",
            cursor: "pointer",
            marginBottom: "10px",
          }}
        >
          📁 選擇圖片
        </button>

        {avatarMsg && (
          <div
            style={{
              fontSize: "13px",
              color: avatarMsg.startsWith("✅") ? "#4CAF50" : "#FF6347",
              marginBottom: "10px",
              fontWeight: "bold",
            }}
          >
            {avatarMsg}
          </div>
        )}

        {/* Save avatar button — only show if a new image is selected */}
        {avatarPreview && avatarPreview !== currentAvatar && (
          <button
            onClick={handleAvatarSave}
            disabled={avatarSaving}
            style={avatarSaving ? { ...btnDisabledStyle, width: "100%" } : { ...btnPrimaryStyle, width: "100%" }}
          >
            {avatarSaving ? "儲存中..." : "💾 儲存頭像"}
          </button>
        )}
      </div>

      {/* ── Section 3: 設定備用帳號密碼 ── */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(0,255,136,0.12)",
              border: "1px solid rgba(0,255,136,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            🔑
          </div>
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: "bold", color: "#FFD700", margin: 0 }}>
              設定備用帳號密碼
            </h3>
            <p style={{ fontSize: "11px", color: "#666", margin: "2px 0 0" }}>
              當 TG 帳號遺失時，可用備用帳號登入
            </p>
          </div>
        </div>

        {/* Current backup username display */}
        {profile?.has_backup_login && (
          <div
            style={{
              background: "rgba(0,255,136,0.06)",
              border: "1px solid rgba(0,255,136,0.2)",
              borderRadius: "10px",
              padding: "10px 14px",
              marginBottom: "14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "12px", color: "#888" }}>目前備用帳號</span>
            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#00FF88" }}>
              {profile?.backup_username}
            </span>
          </div>
        )}

        <div style={{ marginBottom: "10px" }}>
          <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>帳號（3~30 個字元）</label>
          <input
            type="text"
            value={backupUsername}
            onChange={(e) => setBackupUsername(e.target.value)}
            placeholder="設定備用登入帳號"
            maxLength={30}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>密碼（至少 6 個字元）</label>
          <input
            type="password"
            value={backupPassword}
            onChange={(e) => setBackupPassword(e.target.value)}
            placeholder="設定備用登入密碼"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>確認密碼</label>
          <input
            type="password"
            value={backupConfirmPassword}
            onChange={(e) => setBackupConfirmPassword(e.target.value)}
            placeholder="再次輸入密碼"
            style={inputStyle}
          />
        </div>

        {backupMsg && (
          <div
            style={{
              fontSize: "13px",
              color: backupMsg.startsWith("✅") ? "#4CAF50" : "#FF6347",
              marginBottom: "10px",
              fontWeight: "bold",
            }}
          >
            {backupMsg}
          </div>
        )}

        <button
          onClick={async () => {
            if (!backupUsername.trim()) { setBackupMsg("❌ 請輸入備用帳號"); return; }
            if (backupUsername.trim().length < 3 || backupUsername.trim().length > 30) { setBackupMsg("❌ 帳號長度需在 3~30 個字元之間"); return; }
            if (!backupPassword || backupPassword.length < 6) { setBackupMsg("❌ 密碼至少需要 6 個字元"); return; }
            if (backupPassword !== backupConfirmPassword) { setBackupMsg("❌ 兩次輸入的密碼不一致"); return; }
            const token = localStorage.getItem("la1_token");
            if (!token) return;
            setBackupSaving(true);
            setBackupMsg("");
            try {
              const res = await fetch(`${API}/api/user/backup-login`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ backup_username: backupUsername.trim(), backup_password: backupPassword }),
              });
              const data = await res.json();
              if (data.ok) {
                setProfile((prev) => ({ ...prev, backup_username: data.backup_username, has_backup_login: true }));
                setBackupPassword("");
                setBackupConfirmPassword("");
                setBackupMsg("✅ 備用帳號密碼已設定");
                showToast("✅ 備用帳號密碼設定成功！");
              } else {
                setBackupMsg("❌ " + (data.error || "設定失敗"));
              }
            } catch {
              setBackupMsg("❌ 網路錯誤，請稍後再試");
            }
            setBackupSaving(false);
          }}
          disabled={backupSaving}
          style={backupSaving
            ? { ...btnDisabledStyle, width: "100%" }
            : { ...btnPrimaryStyle, width: "100%", background: "linear-gradient(135deg, #00FF88, #00CC66)", color: "#000" }
          }
        >
          {backupSaving ? "儲存中..." : (profile?.has_backup_login ? "🔄 更新備用帳號密碼" : "🔑 設定備用帳號密碼")}
        </button>

        <div style={{ fontSize: "11px", color: "#666", marginTop: "10px", lineHeight: "1.5" }}>
          ⚠️ 備用帳號可隨時更改。請妙善保管帳號密碼，勿與他人分享。
        </div>
      </div>
    </div>
  );
}
