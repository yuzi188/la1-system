export default function Navbar() {
  return (
    <div className="nav">
      <div className="container nav-inner">
        <a href="#" className="brand">
          <div className="brand-mark">LA1</div>
          <div className="brand-copy">
            <strong>LA1</strong>
            <span>AI 娛樂平台</span>
          </div>
        </a>

        <div className="nav-links">
          <a href="#">首頁</a>
          <a href="#games">遊戲</a>
          <a href="#live">真人娛樂場</a>
          <a href="#member">會員中心</a>
          <a href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer">客服</a>
        </div>

        <div className="nav-actions">
          <a className="btn btn-outline" href="#member">會員中心</a>
          <a className="btn btn-primary" href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer">立即加入</a>
        </div>
      </div>
    </div>
  );
}
