import "./globals.css";

export const metadata = {
  title: "LA1 | AI Entertainment - Trust · Fast · Premium",
  description: "LA1 AI Entertainment - Premium gaming platform with Slots, Roulette, Baccarat, Live Casino & AI Games",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
