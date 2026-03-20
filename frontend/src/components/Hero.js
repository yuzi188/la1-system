/* eslint-disable @next/next/no-img-element */
export default function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-banner">
          <img src="/assets/hero-main.png" alt="LA1 AI 娛樂平台" />
          <div className="hero-overlay">
            <h1>
              <span className="gradient">LA1</span>{" "}
              <span style={{ color: "#fff" }}>AI 娛樂平台</span>
            </h1>
            <div className="hero-tagline">信任 · 快速 · 頂級</div>
            <div className="hero-actions">
              <a
                className="btn btn-primary"
                href="https://t.me/LA1111_bot"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <path
                    d="M21 4L3 11.3l5.8 2.1L18 7.6l-6.9 6.1.1 5L14 15.8l3.1 2.3L21 4Z"
                    fill="#000"
                  />
                </svg>
                立即開始
              </a>
              <a className="btn btn-outline" href="#games">
                探索遊戲
              </a>
            </div>
          </div>
        </div>

        <div className="trust-bar">
          <div className="trust-item">
            <span className="trust-icon">🔒</span>
            100% 安全
          </div>
          <div className="trust-item">
            <span className="trust-icon">⚡</span>
            全天候在線
          </div>
          <div className="trust-item">
            <span className="trust-icon">🌐</span>
            全球服務
          </div>
        </div>
      </div>
    </section>
  );
}
