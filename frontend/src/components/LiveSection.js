export default function LiveSection() {
  return (
    <section id="live" className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <h2>Live Casino</h2>
          </div>
          <p>
            Experience the thrill of real-time gaming with our professional live dealers in a premium VIP environment.
          </p>
        </div>

        <div className="dealer-wrap">
          <a className="glass dealer-card" href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer">
            <div className="dealer-media" style={{ backgroundImage: "url('/assets/dealer-1.png')" }}></div>
            <div className="dealer-content">
              <span className="pill">VIP Live</span>
              <h3>Premium Live Experience</h3>
              <p>Professional dealers, real-time interaction, and immersive HD streaming for the ultimate casino experience.</p>
            </div>
          </a>

          <a className="glass dealer-card" href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer">
            <div className="dealer-media" style={{ backgroundImage: "url('/assets/dealer-2.png')" }}></div>
            <div className="dealer-content">
              <span className="pill">Premium Host</span>
              <h3>Exclusive VIP Tables</h3>
              <p>Private high-stakes tables with dedicated hosts — the pinnacle of luxury gaming.</p>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
