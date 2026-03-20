"use client";

export default function ActivityPage() {
  const activities = [
    { title: "VIP 專屬待遇", sub: "尊享私人客服與高額返水", color: "linear-gradient(135deg, #FFD700, #D4AF37)", icon: "👑" },
    { title: "首充豪禮", sub: "最高贈送 100% 獎金", color: "linear-gradient(135deg, #00BFFF, #1E90FF)", icon: "🎁" },
    { title: "邀請返傭", sub: "賺取永久佣金回報", color: "linear-gradient(135deg, #FF4500, #FF8C00)", icon: "🤝" },
    { title: "每日簽到", sub: "連續簽到領取驚喜禮包", color: "linear-gradient(135deg, #4CAF50, #8BC34A)", icon: "📅" },
    { title: "週末狂歡", sub: "週末遊戲返水加倍", color: "linear-gradient(135deg, #9C27B0, #E91E63)", icon: "🔥" }
  ];

  return (
    <div className="fade-in" style={{ padding: "16px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px", textAlign: "center", color: "#FFD700" }}>熱門活動</h1>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {activities.map((activity, i) => (
          <div key={i} className="game-card glass-panel" style={{
            padding: "24px",
            background: activity.color,
            borderRadius: "16px",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minHeight: "120px"
          }}>
            <h2 style={{ fontSize: "22px", fontWeight: "bold", color: "#000", marginBottom: "4px" }}>{activity.title}</h2>
            <p style={{ fontSize: "14px", color: "rgba(0,0,0,0.7)" }}>{activity.sub}</p>
            <div style={{
              position: "absolute",
              right: "10px",
              bottom: "-10px",
              fontSize: "80px",
              opacity: 0.15
            }}>{activity.icon}</div>
            <div style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              background: "rgba(0,0,0,0.1)",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              color: "#000",
              fontWeight: "bold",
              border: "1px solid rgba(0,0,0,0.1)"
            }}>立即參與 ›</div>
          </div>
        ))}
      </div>
    </div>
  );
}
