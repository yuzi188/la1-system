export default function LiveSection() {
  return (
    <section id="live" className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <h2>真人娛樂場</h2>
          </div>
          <p>
            與專業真人荷官即時互動，身臨其境的 VIP 頂級娛樂體驗，盡在 LA1。
          </p>
        </div>
        <div className="dealer-wrap">
          <a
            className="glass dealer-card"
            href="https://t.me/LA1111_bot"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div
              className="dealer-media"
              style={{ backgroundImage: "url('/assets/dealer-1.png')" }}
            ></div>
            <div className="dealer-content">
              <span className="pill">VIP 真人</span>
              <h3>頂級真人體驗</h3>
              <p>
                專業荷官全程陪伴，高清直播畫面，讓您感受最真實的娛樂場氛圍。
              </p>
            </div>
          </a>
          <a
            className="glass dealer-card"
            href="https://t.me/LA1111_bot"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div
              className="dealer-media"
              style={{ backgroundImage: "url('/assets/dealer-2.png')" }}
            ></div>
            <div className="dealer-content">
              <span className="pill">尊享包廂</span>
              <h3>私人 VIP 專屬桌</h3>
              <p>
                高額私人包廂，專屬荷官服務，奢華娛樂體驗的極致之選。
              </p>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
