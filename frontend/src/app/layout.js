import "./globals.css";

export const metadata = {
  title: "LA1 | AI 娛樂平台 - 信任 · 快速 · 頂級",
  description: "LA1 AI 娛樂平台 - 頂級遊戲平台，提供老虎機、輪盤、百家樂、真人娛樂場及 AI 遊戲",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
