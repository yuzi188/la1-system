import "./globals.css";

export const metadata = {
  title: "LA1 | Premium Platform",
  description: "LA1 premium landing page",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
