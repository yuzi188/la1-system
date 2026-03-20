const games = [
  {
    title: "老虎機",
    desc: "高對比視覺卡片，讓內容入口不再像廉價按鈕。",
    img: "/assets/game-slot.png",
    tag: "熱門入口"
  },
  {
    title: "輪盤",
    desc: "卡片 hover 發光與浮起，整體更像產品平台。",
    img: "/assets/game-roulette.png",
    tag: "即時互動"
  },
  {
    title: "百家樂",
    desc: "保留娛樂感，但把色系與節奏統一成高級版。",
    img: "/assets/game-baccarat.png",
    tag: "經典內容"
  },
  {
    title: "AI 推薦",
    desc: "把 AI 放成獨立入口，強化 LA1 品牌記憶點。",
    img: "/assets/game-ai.png",
    tag: "智能推薦"
  }
];

export default function GamesSection() {
  return (
    <section id="games" className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <h2>熱門入口重做</h2>
          </div>
          <p>
            這一區直接重做成高級平台卡片，不再是單純貼圖。每張卡片都有圖片、遮罩、標題與 CTA。
          </p>
        </div>

        <div className="card-grid">
          {games.map((game) => (
            <div key={game.title} className="glass game-card">
              <div className="thumb" style={{ backgroundImage: `url(${game.img})` }}></div>
              <div className="content">
                <span className="pill">{game.tag}</span>
                <h3>{game.title}</h3>
                <p>{game.desc}</p>
                <span className="card-cta">立即進入</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
