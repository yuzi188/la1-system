export default function Hero() {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div>
          <span className="eyebrow">Premium Platform</span>
          <h1>
            <span className="gradient">LA1</span><br />
            智能娛樂平台
          </h1>
          <p>
            重新設計整站圖片與 UI，改成更接近高級平台的結構：
            玻璃感導航、品牌主視覺、分區卡片、真人專區、會員入口、TG 導流全部整合。
          </p>

          <div className="hero-actions">
            <a className="btn btn-primary" href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer">
              🔥 立即開始
            </a>
            <a className="btn btn-outline" href="#games">
              查看內容
            </a>
          </div>

          <div className="stats">
            <div className="glass stat">
              <strong>24/7</strong>
              <span>即時服務</span>
            </div>
            <div className="glass stat">
              <strong>VIP</strong>
              <span>會員體驗</span>
            </div>
            <div className="glass stat">
              <strong>AI</strong>
              <span>智能推薦</span>
            </div>
          </div>
        </div>

        <div className="glass showcase">
          <div className="showcase-media"></div>

          <div className="showcase-content">
            <div className="glass showcase-card">
              <div className="showcase-row">
                <div>
                  <span className="mini-badge">LA1 Control Layer</span>
                  <h3>品牌主視覺已重做</h3>
                  <p>黑底、紫藍漸層、玻璃感結構，不再像舊式模板。</p>
                </div>
                <a className="btn btn-outline" href="#member">查看入口</a>
              </div>

              <div className="feed">
                <div className="feed-item">玩家動態：剛完成一筆操作 · 即時更新中</div>
                <div className="feed-item">會員層級：Normal / VIP · 快速切換內容入口</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
