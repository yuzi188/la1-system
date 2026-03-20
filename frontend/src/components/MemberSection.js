export default function MemberSection() {
  return (
    <section id="member" className="section">
      <div className="container member-grid">
        <div className="glass panel">
          <div className="balance">
            <div>
              <p className="muted">Member Center</p>
              <h3 style={{ color: "#FFD700" }}>LA1 VIP Hub</h3>
            </div>
            <strong className="gradient">$ 0.00</strong>
          </div>

          <div className="feature-list">
            <div className="feature-item">
              <span style={{ color: "#FFD700" }}>Member Portal</span>
              <span className="muted">Login / Deposit / Query</span>
            </div>
            <div className="feature-item">
              <span style={{ color: "#FFD700" }}>AI Recommendations</span>
              <span className="muted">Smart content ranking</span>
            </div>
            <div className="feature-item">
              <span style={{ color: "#FFD700" }}>VIP Upgrade</span>
              <span className="muted">Exclusive tier benefits</span>
            </div>
          </div>
        </div>

        <div className="glass panel">
          <p className="muted">Deposit & Support</p>
          <h3 style={{ color: "#FFD700" }}>Contact Us on Telegram</h3>
          <p className="muted" style={{ marginTop: 10, lineHeight: 1.9 }}>
            24/7 customer support via our official Telegram bot. Fast deposits, instant withdrawals, and premium VIP service.
          </p>

          <div style={{ marginTop: 24 }}>
            <a
              className="tg-big"
              href="https://t.me/LA1111_bot"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="tg-icon">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
                  <path d="M21 4L3 11.3l5.8 2.1L18 7.6l-6.9 6.1.1 5L14 15.8l3.1 2.3L21 4Z" fill="#000"/>
                </svg>
              </span>
              @LA1111_bot
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
