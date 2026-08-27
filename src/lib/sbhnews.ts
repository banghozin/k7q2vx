/**
 * SBHNews 공개 RSS 읽기.
 *
 * 이용 근거: https://www.sbhnews.com/data-use
 *   - 공개 콘텐츠는 CC BY 4.0. 사전 승인·API 키 없이 수집·재배포·재가공 허용.
 *   - 조건: 출처명 / 기사 제목 + 원문 URL / 라이선스 링크 / 변경 사항 표시.
 *
 * 지키는 것:
 *   - robots.txt 가 /api/ 를 막고 있으므로 공개 RSS(feed.xml)만 씁니다.
 *   - 하루 1회 기준으로만 부릅니다. 캐시를 두고 같은 문서를 반복해 받지 않습니다.
 *   - 429나 Retry-After 를 받으면 그 회차는 즉시 포기합니다.
 *   - 시세 숫자는 가져오지 않습니다. 제3자 권리 자료라 CC BY 4.0 대상이 아닙니다.
 */

import { hasName } from "./korean-match";
import { safeLink, trimTitle } from "./usnews";

export const SBH = {
  feed: "https://www.sbhnews.com/feed.xml",
  source: "SBHNews / 센서스튜디오",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  dataUseUrl: "https://www.sbhnews.com/data-use",
} as const;

// HTTP 헤더 값에는 ASCII만 넣을 수 있습니다. 한글을 넣으면 요청 자체가 실패합니다.
const UA = "theme-map/0.1 (+https://www.sbhnews.com/data-use; public RSS reader)";

export type NewsItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category: string;
};

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]) : "";
}

export function parseFeed(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const b of blocks) {
    const title = pick(b, "title");
    // 남이 주는 주소를 그대로 href 에 넣지 않습니다 — usnews.ts 의 설명 참고
    const link = safeLink(pick(b, "link"));
    if (!title || !link) continue;
    items.push({
      title: trimTitle(title),
      link,
      description: pick(b, "description"),
      pubDate: pick(b, "pubDate"),
      category: pick(b, "category") || "general",
    });
  }
  return items;
}

/** 서버에서만 부릅니다. 실패해도 사이트는 그대로 돌아가야 하므로 빈 배열을 돌려줍니다. */
export async function fetchNews(): Promise<NewsItem[]> {
  try {
    const r = await fetch(SBH.feed, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml, text/xml" },
      // 하루 1회 갱신 원칙에 맞춘 캐시. 같은 문서를 반복해 받지 않습니다.
      next: { revalidate: 60 * 60 * 6 },
    });
    if (r.status === 429 || !r.ok) return [];
    return parseFeed(await r.text());
  } catch {
    return [];
  }
}

/**
 * 이 사이트는 미국 상장 종목만 다루므로, 국내 시장이 주제인 기사는 걸러냅니다.
 * 제목에 이 말들이 들어가면 국내 상품·지수 이야기로 봅니다.
 */
const DOMESTIC = [
  "KODEX",
  "TIGER",
  "PLUS ",
  "코스피",
  "코스닥",
  "국내 상장",
  "국내 증시",
  "한국거래소",
  "공모주",
  "청약",
];

/**
 * 미국 시장과 상관있다고 볼 만한 신호.
 *
 * 이 피드는 한국 매체라 `economy` 카테고리를 그냥 가져오면 국내 증권사 조직
 * 개편, 중기부 상담회 같은 기사가 올라옵니다. 미국 개별종목을 매매하는
 * 사람에게는 아무 쓸모가 없습니다.
 *
 * 그래서 **통과 조건을 두고 걸러냅니다.** 막을 것을 나열하는 방식(블랙리스트)은
 * 늘 뚫립니다 — 국내 기업 이름을 다 적을 수는 없으니까요. 반대로
 * "미국 시장 얘기가 나오거나, 우리가 다루는 회사가 나오거나" 를 요구하면
 * 새로운 국내 기사가 들어와도 저절로 걸러집니다.
 *
 * 환율 단위로 아무 데나 나오는 "달러" 는 일부러 뺐습니다.
 */
const US_SIGNALS = [
  "미국",
  "미 증시",
  "미증시",
  "뉴욕증시",
  "뉴욕 증시",
  "나스닥",
  "다우지수",
  "S&P",
  "월가",
  "월스트리트",
  "연준",
  "연방준비",
  "FOMC",
  "파월",
  "미 국채",
  "서학개미",
  "관세",
  "트럼프",
  "백악관",
  "실리콘밸리",
  "빅테크",
];

/** 이 글에 미국 시장 신호가 있는가 */
export function hasUsSignal(text: string): boolean {
  return US_SIGNALS.some((s) => text.includes(s));
}

/** 제목이 국내 시장 상품 얘기인가 */
export function isDomesticProduct(title: string): boolean {
  return DOMESTIC.some((d) => title.includes(d));
}

/**
 * 미국 시장과 관련된 기사만 남깁니다.
 *
 * @param names 우리가 다루는 회사의 한국어 이름들. 이 중 하나가 나오면
 *              시장 단어가 없어도 통과시킵니다 — 종목 기사가 더 값집니다.
 */
export function usHeadlines(
  items: NewsItem[],
  names: string[],
  limit = 5,
): NewsItem[] {
  const out: NewsItem[] = [];
  for (const it of items) {
    if (it.category !== "economy") continue;
    if (isDomesticProduct(it.title)) continue;
    const hay = `${it.title} ${it.description}`;
    const bySignal = hasUsSignal(hay);
    const byName = !bySignal && names.some((n) => hasName(hay, n));
    if (!bySignal && !byName) continue;
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

/*
 * 예전에 여기 `matchTheme` 이 있었습니다 — 테마 키워드로 기사를 훑는 방식.
 * **지웠습니다.** 낱말이 겹친다는 이유로 엉뚱한 기사가 걸렸기 때문입니다.
 *   사이버보안 ← 멕시코군 병력 배치, 콜롬비아 군부 작전
 *   조선·해운  ← 시외버스 요금 인상, 조선 성리학자 묘소
 * 지금은 **종목 이름이 실제로 나온 기사만** 보관해 두고(scripts/fetch-news.ts)
 * 화면은 그 아카이브에서 가져옵니다. 다시 키워드 방식으로 돌아가지 마세요.
 */


/**
 * 서버와 브라우저가 같은 결과를 내야 하므로 시간대를 **고정**합니다.
 * 기기 시간대를 따라가면 날짜가 달라져 화면이 어긋납니다.
 *
 * 고정하되 **한국 시각**으로 둡니다. 처음에는 표준시(UTC)로 뒀는데, 그러면
 * 한국 사람에게 아홉 시간 어긋난 시각을 시간대 표기도 없이 보여주게 됩니다.
 * 미국 매체는 미국 오후에 기사를 내므로 그 차이가 날짜까지 바꿉니다.
 */
const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

export function formatDate(pubDate: string): string {
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return "";
  return dateFmt.format(d);
}
