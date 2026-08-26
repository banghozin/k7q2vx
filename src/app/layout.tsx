import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";
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

/*
 * 제목용 글꼴.
 *
 * 처음에는 명조(Noto Serif KR)를 썼습니다. "지층 단면도" 라는 컨셉에 맞고
 * 본문 고딕과 대비도 컸지만, **화면 전체를 고딕으로 해 달라**는 요청에 따라
 * 바꿨습니다. 대신 제목은 굵기(600)와 자간을 좁혀 본문과 구분합니다 —
 * 글꼴로 주던 대비를 굵기와 크기로 옮긴 셈입니다.
 */
const display = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
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
    <html lang="ko" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
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
