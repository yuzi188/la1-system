export default function LiveSection() {
  return (
    <section id="live" className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <h2>真人專區</h2>
          </div>
          <p>
            下方真人區保留人物照片，但改成更乾淨、更高級的展示方式，不再做成舊式拼貼感。
          </p>
        </div>

        <div className="dealer-wrap">
          <div className="glass dealer-card">
            <div className="dealer-media" style={{ backgroundImage: "url('/assets/dealer-1.png')" }}></div>
            <div className="dealer-content">
              <span className="pill">VIP Live</span>
              <h3>專屬真人體驗</h3>
              <p>畫面更乾淨，人物更聚焦，整體接近高級平台視覺，不再像過時廣告站。</p>
            </div>
          </div>

          <div className="glass dealer-card">
            <div className="dealer-media" style={{ backgroundImage: "url('/assets/dealer-2.png')" }}></div>
            <div className="dealer-content">
              <span className="pill">Premium Host</span>
              <h3>品牌風格一致</h3>
              <p>人物區保留照片，但用更強的留白、遮罩與版面節奏去提升質感。</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
