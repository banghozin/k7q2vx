import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR, Noto_Serif_KR } from "next/font/google";
import "./globals.css";
import { Masthead } from "@/components/masthead";
import { ThemeRail } from "@/components/theme-rail";
import { ChartModal } from "@/components/chart-modal";
import { SiteFooter } from "@/components/site-footer";

const sans = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "테마 지도 — 미국주식을 산업의 층으로",
    template: "%s · 테마 지도",
  },
  description:
    "미국 상장 종목을 밸류체인의 층으로 세워 보여주는 한국어 산업 구조 지도. 매수·매도 의견을 담지 않습니다.",
};

export const viewport: Viewport = {
  themeColor: "#0a0c0f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="skip">
          본문으로 건너뛰기
        </a>
        <div className="shell">
          <Masthead />
          <ThemeRail />
          <main id="main">{children}</main>
          <SiteFooter />
        </div>
        <ChartModal />
      </body>
    </html>
  );
}
