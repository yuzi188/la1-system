const games = [
  {
    title: "Slots",
    desc: "Premium slot machines with massive jackpots and stunning visuals.",
    img: "/assets/game-slot.png",
    tag: "Hot Games"
  },
  {
    title: "Roulette",
    desc: "Classic European & American roulette with live odds tracking.",
    img: "/assets/game-roulette.png",
    tag: "Classic"
  },
  {
    title: "Baccarat",
    desc: "The king of card games — fast, elegant, and high-stakes.",
    img: "/assets/game-baccarat.png",
    tag: "VIP Pick"
  },
  {
    title: "AI Game",
    desc: "AI-powered smart gaming — next-gen entertainment experience.",
    img: "/assets/game-ai.png",
    tag: "AI Powered"
  }
];

export default function GamesSection() {
  return (
    <section id="games" className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <h2>Popular Games</h2>
          </div>
          <p>
            Explore our premium collection of casino games — from classic table games to AI-powered entertainment.
          </p>
        </div>

        <div className="card-grid">
          {games.map((game) => (
            <a key={game.title} className="glass game-card" href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer">
              <div className="thumb" style={{ backgroundImage: `url(${game.img})` }}></div>
              <div className="content">
                <span className="pill">{game.tag}</span>
                <h3>{game.title}</h3>
                <p>{game.desc}</p>
                <span className="card-cta">Play Now</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
