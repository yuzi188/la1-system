export default function Navbar() {
  return (
    <div className="nav">
      <div className="container nav-inner">
        <a href="#" className="brand">
          <div className="brand-mark">LA1</div>
          <div className="brand-copy">
            <strong>LA1</strong>
            <span>AI Entertainment</span>
          </div>
        </a>

        <div className="nav-links">
          <a href="#games">Games</a>
          <a href="#live">Live Casino</a>
          <a href="#member">VIP Hub</a>
          <a href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer">@LA1111_bot</a>
        </div>

        <div className="nav-actions">
          <a className="btn btn-outline" href="#member">Member</a>
          <a className="btn btn-primary" href="https://t.me/LA1111_bot" target="_blank" rel="noopener noreferrer">
            Join Now
          </a>
        </div>
      </div>
    </div>
  );
}
