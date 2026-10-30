import type { Metadata, Viewport } from "next";
import "./globals.css";
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#245de3", viewportFit: "cover" };

export const metadata: Metadata = {
  title: "轻记 · 电子错题本",
  description: "用图片和标题记录错题，可添加分类，在手机和电脑上查看。",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "轻记错题本", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
