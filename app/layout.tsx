import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "江湖录：卑贱子的逆命",
  description:
    "一款金庸文风的文字武侠RPG：你以农民、乞丐、小流氓、妓女等卑贱之身踏入乱世，在算命先生的卦摊前测字断命，用 10 回抉择挣出一条命、一段缘、一口气。结局以约 800 字战记与一首七律作结。",
  keywords: ["江湖", "武侠", "金庸", "文字RPG", "AI游戏", "DeepSeek", "测字", "命格"],
};

export const viewport: Viewport = {
  themeColor: "#0a0d1f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-dvh font-[system-ui,'Songti_SC','STSong','SimSun','PingFang_SC','Microsoft_YaHei',serif]">
        {children}
      </body>
    </html>
  );
}
