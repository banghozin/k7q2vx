"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/*
 * 뉴스가 맨 앞인 이유: 아래 넷은 "내가 쓰는 도구"(차트를 긋고, 연습하고,
 * 기록하고, 담아 두는 것)인데 뉴스 보관함만 성격이 다릅니다 — 테마 화면과
 * 같은 **읽을 거리**입니다. 도구 사이에 끼우면 그 성격이 안 보입니다.
 *
 * 그동안 꼬리말에만 링크가 있었습니다. 기사 천 건 넘게 모아 두고 화면
 * 맨 아래까지 내려가야 닿는 상태였습니다.
 */
/*
 * `drop` 은 **좁은 화면에서만 감추는 앞머리**입니다.
 *
 * 여섯 개를 390px 에 그대로 넣으면 61px 넘칩니다. 그런데 재 보니 뉴스를
 * 넣기 전 다섯 개일 때도 **이미 28px 넘쳐 "읽는 법" 이 잘리고 있었습니다**
 * (라이브에서 확인). 아래 CSS 주석은 "메뉴 넷" 기준으로 쓰인 것이라, 그 뒤
 * 하나가 늘면서 조용히 깨져 있었습니다.
 *
 * 글자를 더 줄이거나 간격을 더 좁히는 대신 **겹치는 앞머리**를 접습니다.
 * "차트 분석"·"차트 훈련" 은 나란히 있어서 "차트" 가 두 번 나오는데, 둘이
 * 붙어 있으면 "분석"·"훈련" 만으로도 무엇의 분석인지 읽힙니다.
 * 넓은 화면에서는 온전한 이름 그대로 둡니다.
 *
 * 그래도 여섯은 안 들어가서 `deskOnly` 로 "읽는 법" 하나를 폰에서 뺍니다.
 * 무엇을 뺄지는 **얼마나 자주 보는가**로 갈랐습니다 — 읽는 법은 한 번 읽고
 * 마는 안내문이고, 뉴스는 매일 보는 것입니다. 뺀 자리는 꼬리말
 * "둘러보기" 에 그대로 있습니다(`site-footer.tsx`).
 */
const LINKS = [
  { href: "/news", label: "뉴스" },
  { href: "/analyze", drop: "차트 ", label: "분석" },
  { href: "/practice", drop: "차트 ", label: "훈련" },
  { href: "/notes", label: "매매노트" },
  { href: "/watchlist", label: "워치리스트" },
  { href: "/about", label: "읽는 법", deskOnly: true },
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
              className={l.deskOnly ? "navlink navlink--desk" : "navlink"}
              aria-current={path === l.href ? "page" : undefined}
            >
              {l.drop && <span className="navlink__wide">{l.drop}</span>}
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
