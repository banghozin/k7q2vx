"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/analyze", label: "차트 분석" },
  { href: "/practice", label: "차트 훈련" },
  { href: "/notes", label: "매매노트" },
  { href: "/watchlist", label: "워치리스트" },
  { href: "/about", label: "읽는 법" },
];

export function Masthead() {
  const path = usePathname();
  return (
    <header className="masthead">
      <div className="wrap masthead__bar">
        <Link href="/" className="brand">
          {/*
            파비콘과 같은 지층 도형입니다.

            원래 한자 글자(層)를 뒀는데 두 가지가 걸립니다 — 기기에 그 글꼴이
            없으면 네모로 뜨고, 무엇보다 **글자라서 읽으려 들게 됩니다.**
            도형이면 그냥 표식으로 보입니다. 아래로 갈수록 넓고 어둡게(원재료),
            위로 갈수록 좁고 밝게(최종 서비스), 맨 위 한 층만 황동색으로
            "지금 앞선 층" 을 나타냅니다.
          */}
          {/*
            층은 셋만 둡니다. 파비콘은 64px 라 넷이 다 읽히지만 여기는 20px 라
            넷을 넣으면 층마다 3px 밖에 안 되어 그냥 줄무늬로 보입니다.
            대신 폭 차이를 키워 "위로 갈수록 좁아진다" 가 드러나게 합니다.
          */}
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" width="21" height="21">
              <rect x="2" y="26" width="36" height="9" rx="2.5" fill="currentColor" opacity=".34" />
              <rect x="7" y="14" width="26" height="9" rx="2.5" fill="currentColor" opacity=".62" />
              <rect x="12" y="2" width="16" height="9" rx="2.5" fill="currentColor" />
            </svg>
          </span>
          <span className="brand__name">테마 지도</span>
        </Link>
        <nav className="masthead__nav">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="navlink"
              aria-current={path === l.href ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
