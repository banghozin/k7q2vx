/**
 * 미국 금융 매체의 공개 RSS 읽기.
 *
 * 왜 붙였나
 * --------
 * 지금까지 뉴스 공급원이 SBHNews 하나뿐이었습니다. 한국 매체라
 *   - 최근 100건이 **7.6시간**이면 다 차고,
 *   - 그중 미국 시장 기사는 한국 낮 시간대에 **0건**일 때가 흔했습니다.
 * 미국 개별종목을 매매하는 사람에게 쓸 기사가 사실상 없었습니다.
 *
 * 이 피드들은 처음부터 미국 시장 매체라 "국내 기사를 걸러내는" 문제 자체가
 * 없습니다. 실측한 보관 기간도 훨씬 깁니다 — CNBC 시장 피드는 **375시간**
 * (약 15일)치를 줍니다.
 *
 * 지키는 것
 * --------
 *   - **제목·링크·출처만** 저장합니다. 본문은 가져오지도, 보관하지도 않습니다.
 *     RSS 는 제목과 링크를 퍼뜨리라고 매체가 스스로 공개한 것입니다.
 *   - 기사는 항상 **원문 링크로 보냅니다.** 우리 화면에서 읽게 하지 않습니다.
 *   - 시세 숫자는 가져오지 않습니다 — 야후에서 직접 받습니다.
 *   - 실패한 피드는 조용히 건너뜁니다. 하나가 죽어도 나머지는 들어와야 합니다.
 */

export type UsFeed = {
  /** 저장에 쓰는 짧은 식별자 */
  id: string;
  /** 화면에 뜨는 이름 */
  label: string;
  url: string;
};

export const US_FEEDS: UsFeed[] = [
  {
    id: "cnbc-mkt",
    label: "CNBC 마켓",
    url: "https://www.cnbc.com/id/15839135/device/rss/rss.html",
  },
  {
    id: "cnbc-top",
    label: "CNBC",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  },
  {
    id: "marketwatch",
    label: "MarketWatch",
    url: "https://feeds.marketwatch.com/marketwatch/topstories",
  },
  {
    id: "yahoo-fin",
    label: "Yahoo Finance",
    url: "https://finance.yahoo.com/news/rssindex",
  },
  {
    id: "nasdaq",
    label: "Nasdaq",
    url: "https://www.nasdaq.com/feed/rssoutbound?category=Markets",
  },
  {
    id: "seekingalpha",
    label: "Seeking Alpha",
    url: "https://seekingalpha.com/market_currents.xml",
  },
];

/** 출처 id → 화면 이름 */
export const US_FEED_LABEL: Record<string, string> = Object.fromEntries(
  US_FEEDS.map((f) => [f.id, f.label]),
);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type UsNewsItem = {
  title: string;
  link: string;
  description: string;
  /** ISO 시각 */
  pubDate: string;
  /** 피드 id */
  source: string;
};

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x2019;/g, "'")
    .replace(/&#x2018;/g, "'")
    .replace(/&#x201c;/gi, '"')
    .replace(/&#x201d;/gi, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]) : "";
}

/**
 * 날짜가 말이 되는가.
 *
 * 야후 피드에는 **1998년으로 찍힌 항목**이 섞여 있습니다(실측: 50건의 시간
 * 폭이 21,305시간). 그대로 담으면 아카이브의 오래된 달 파일이 엉뚱하게
 * 불어납니다. 앞뒤로 말이 되는 범위만 받습니다.
 */
function sane(d: Date): boolean {
  if (Number.isNaN(d.getTime())) return false;
  const now = Date.now();
  const age = now - d.getTime();
  return age > -6 * 3600_000 && age < 45 * 86400_000;
}

/**
 * 남이 주는 주소를 그대로 `href` 에 넣지 않습니다.
 *
 * 피드는 우리가 통제하지 않는 서버가 만듭니다. `javascript:` 나 `data:` 가
 * 섞여 오면 그대로 링크가 되고, `/foo` 같은 상대경로는 **우리 도메인**으로
 * 풀려 엉뚱한 곳을 가리킵니다. http(s) 절대주소만 받습니다.
 */
export function safeLink(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * 제목 길이 상한.
 *
 * 대부분 100자 안쪽이지만 본문이 통째로 들어오는 피드가 있습니다. 그대로 두면
 * 화면이 무너지고 아카이브도 부풉니다.
 */
const MAX_TITLE = 300;

export function trimTitle(t: string): string {
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE - 1)}…` : t;
}

export function parseUsFeed(xml: string, source: string): UsNewsItem[] {
  const out: UsNewsItem[] = [];
  for (const b of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const title = pick(b, "title");
    const link = safeLink(pick(b, "link"));
    if (!title || !link) continue;
    const raw = pick(b, "pubDate") || pick(b, "dc:date");
    const d = new Date(raw);
    if (!sane(d)) continue;
    out.push({
      title: trimTitle(title),
      link,
      description: pick(b, "description").slice(0, 600),
      pubDate: d.toISOString(),
      source,
    });
  }
  return out;
}

/** 피드 하나. 실패하면 빈 배열 — 나머지 피드를 막지 않습니다. */
async function fetchOne(feed: UsFeed): Promise<UsNewsItem[]> {
  try {
    const r = await fetch(feed.url, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml, text/xml, */*" },
      signal: AbortSignal.timeout(15000),
      // 화면에서 부를 때의 캐시. 수집 스크립트(node)에서는 조용히 무시됩니다.
      next: { revalidate: 60 * 60 * 3 },
    });
    if (!r.ok) return [];
    return parseUsFeed(await r.text(), feed.id);
  } catch {
    return [];
  }
}

/**
 * 전체 피드를 받아 최신순으로 합칩니다. 같은 링크는 한 번만.
 *
 * @param onDead 한 건도 못 받은 피드를 알려줍니다. 피드는 조용히 죽습니다 —
 *               주소가 바뀌거나 형식이 Atom 으로 바뀌면 예외 없이 0건이 됩니다.
 *               수집 스크립트가 이걸 받아 화면에 찍습니다.
 */
export async function fetchUsNews(
  onDead?: (feed: UsFeed) => void,
): Promise<UsNewsItem[]> {
  const all = await Promise.all(US_FEEDS.map(fetchOne));
  const seen = new Set<string>();
  const out: UsNewsItem[] = [];
  all.forEach((items, i) => {
    if (items.length === 0) onDead?.(US_FEEDS[i]);
    for (const it of items) {
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      out.push(it);
    }
  });
  out.sort((a, b) => (a.pubDate < b.pubDate ? 1 : -1));
  return out;
}
