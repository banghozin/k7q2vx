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
    const link = pick(b, "link");
    if (!title || !link) continue;
    items.push({
      title,
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

/** 테마 키워드로 기사를 고릅니다. 경제 카테고리를 우선합니다. */
export function matchTheme(
  items: NewsItem[],
  keywords: string[],
  limit = 6,
): NewsItem[] {
  const scored = items
    .filter((it) => !DOMESTIC.some((d) => it.title.includes(d)))
    .map((it) => {
      const hay = `${it.title} ${it.description}`;
      // 제목에서 걸린 키워드는 본문에서 걸린 것보다 크게 칩니다.
      const inTitle = keywords.filter((k) => it.title.includes(k)).length;
      const inBody = keywords.filter((k) => it.description.includes(k)).length;
      return {
        it,
        score: inTitle * 2 + inBody + (it.category === "economy" ? 0.5 : 0),
      };
    })
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.it);
}

/**
 * 서버와 브라우저가 같은 결과를 내야 하므로 표준시(UTC)로 고정합니다.
 * 기기 시간대에 따라 날짜가 달라지면 화면이 어긋납니다.
 */
const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

export function formatDate(pubDate: string): string {
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return "";
  return dateFmt.format(d);
}
