import './globals.css'

export const metadata = {
  title: 'LA1 AI 娛樂平台 | 信任 · 快速 · 頂級',
  description: 'LA1 AI 娛樂平台提供最頂級的遊戲體驗，包括老虎機、輪盤、百家樂及 AI 智能遊戲。',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <head>
        {/* Telegram Web App SDK */}
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body className="no-scrollbar">
        <main style={{ minHeight: '100vh', paddingBottom: '80px' }}>
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="bottom-nav">
          <a href="/deposit" className="bottom-nav-item">
            <div className="icon-wrapper">💰</div>
            <span>存提款</span>
          </a>
          <a href="/service" className="bottom-nav-item">
            <div className="icon-wrapper">💬</div>
            <span>客服</span>
          </a>
          <a href="/" className="bottom-nav-item active">
            <div className="icon-wrapper">🏠</div>
            <span>首頁</span>
          </a>
          <a href="/activity" className="bottom-nav-item">
            <div className="icon-wrapper">🎁</div>
            <span>活動</span>
          </a>
          <a href="/profile" className="bottom-nav-item">
            <div className="icon-wrapper">👤</div>
            <span>我的</span>
          </a>
        </nav>

        {/* Floating Daily Match Button */}
        <a href="/activity" style={{
          position: 'fixed',
          right: '16px',
          bottom: '90px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FFD700, #FFA500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          boxShadow: '0 4px 20px rgba(255, 215, 0, 0.4)',
          zIndex: 900,
          cursor: 'pointer',
          animation: 'float 3s ease-in-out infinite',
          textDecoration: 'none',
        }}>
          🏆
          <div style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#ff4444',
            color: '#fff',
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '10px',
            fontWeight: 'bold',
            border: '2px solid #000',
            whiteSpace: 'nowrap',
          }}>每日賽</div>
        </a>
      </body>
    </html>
  )
}
