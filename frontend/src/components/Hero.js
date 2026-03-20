/* eslint-disable @next/next/no-img-element */
export default function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-banner">
          <img src="/assets/hero-main.png" alt="LA1 AI Entertainment" />
          <div className="hero-overlay">
            <h1>
              <span className="gradient">LA1</span>{" "}
              <span style={{ color: "#fff" }}>AI Entertainment</span>
            </h1>
            <div className="hero-tagline">Trust · Fast · Premium</div>
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
                Join @LA1111_bot
              </a>
              <a className="btn btn-outline" href="#games">
                Explore Games
              </a>
            </div>
          </div>
        </div>

        <div className="trust-bar">
          <div className="trust-item">
            <span className="trust-icon">🔒</span>
            100% Secure
          </div>
          <div className="trust-item">
            <span className="trust-icon">⚡</span>
            24/7 Online
          </div>
          <div className="trust-item">
            <span className="trust-icon">🌐</span>
            Global
          </div>
        </div>
      </div>
    </section>
  );
}
