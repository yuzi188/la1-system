const games = [
  {
    title: "老虎機",
    desc: "超高倍率老虎機，海量獎池等你來贏，視覺震撼、操作流暢。",
    img: "/assets/game-slot.png",
    tag: "熱門遊戲",
  },
  {
    title: "輪盤",
    desc: "歐式與美式輪盤即時對戰，賠率透明，刺激感十足。",
    img: "/assets/game-roulette.png",
    tag: "經典必玩",
  },
  {
    title: "百家樂",
    desc: "牌桌之王——快節奏、高雅氣派，VIP 玩家首選。",
    img: "/assets/game-baccarat.png",
    tag: "VIP 精選",
  },
  {
    title: "AI 遊戲",
    desc: "AI 智能驅動，下一代娛樂體驗，讓每一局都與眾不同。",
    img: "/assets/game-ai.png",
    tag: "AI 智能",
  },
];

export default function GamesSection() {
  return (
    <section id="games" className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <h2>熱門遊戲</h2>
          </div>
          <p>
            探索我們的頂級遊戲陣容——從經典桌遊到 AI 智能娛樂，應有盡有。
          </p>
        </div>
        <div className="card-grid">
          {games.map((game) => (
            <a
              key={game.title}
              className="glass game-card"
              href="https://t.me/LA1111_bot"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div
                className="thumb"
                style={{ backgroundImage: `url(${game.img})` }}
              ></div>
              <div className="content">
                <span className="pill">{game.tag}</span>
                <h3>{game.title}</h3>
                <p>{game.desc}</p>
                <span className="card-cta">立即遊玩</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
