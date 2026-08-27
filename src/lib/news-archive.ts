/**
 * 보관해 둔 뉴스를 읽습니다.
 *
 * `scripts/fetch-news.ts` 가 달별 파일(`generated/news/2026-08.json`)로 쌓아
 * 둔 것을 읽어, 종목·테마·날짜로 되찾을 수 있게 합니다.
 *
 * 달별로 나눈 이유: 한 파일에 다 넣으면 시간이 갈수록 감당이 안 됩니다.
 * 화면에서 쓰는 것은 최근 몇 달치면 충분하므로 그만큼만 가져옵니다.
 *
 * 보관된 기사에는 요약(description)이 없습니다. 목록에 요약이 필요한 화면은
 * 실시간 피드(`lib/sbhnews.ts`)가 담당하고, 아카이브는 "언제 무슨 제목의
 * 기사가 있었나"에 답하는 역할입니다.
 */

import type { NewsItem } from "./sbhnews";
import { SBH } from "./sbhnews";
import { US_FEED_LABEL } from "./usnews";
import { kstDay } from "./kst";

/** 보관된 기사. 파일 크기를 줄이려고 키를 짧게 뒀습니다. */
export type ArchivedRaw = {
  t: string;
  u: string;
  d: string;
  c: string;
  th: string[];
  tk: string[];
  /** 출처 id. 없으면 영문 피드를 붙이기 전에 쌓인 것이라 SBHNews 입니다. */
  s?: string;
};

export type Archived = {
  title: string;
  link: string;
  /** 발행 시각 (ISO) */
  date: string;
  /**
   * 발행일 (YYYY-MM-DD, **UTC 기준**).
   *
   * 차트에 점을 찍는 자리를 정하는 데 씁니다. 일봉의 시각이 거래일 자정
   * 기준이라 여기에 맞춰 둡니다. **사람에게 보여주는 날짜가 아닙니다** —
   * 그건 `dayKst` 입니다.
   */
  day: string;
  /**
   * 발행일 (YYYY-MM-DD, **한국 시각 기준**) — 화면에 보여주는 날짜.
   *
   * 미국 매체는 미국 오후에 기사를 냅니다. 그것이 한국에서는 이미 다음 날
   * 아침입니다. 실제로 재어 보니 **보관된 기사의 62%가 UTC 와 한국 시각에서
   * 서로 다른 날짜**였습니다. 한국 사람이 보는 "날짜별 보관함" 이므로
   * 한국 날짜로 묶습니다.
   */
  dayKst: string;
  category: string;
  themes: string[];
  tickers: string[];
  /** 출처 id */
  source: string;
  /** 화면에 뜨는 출처 이름 */
  sourceLabel: string;
  /** 영문 기사인가 — 제목을 원문 그대로 보여주므로 화면에서 표시합니다 */
  english: boolean;
};

/** 출처 id → 화면 이름 */
export function sourceLabel(id: string): string {
  if (id === "sbh") return "SBHNews";
  return US_FEED_LABEL[id] ?? id;
}

/** 한국어 매체는 SBHNews 하나뿐입니다 */
export function isEnglishSource(id: string): boolean {
  return id !== "sbh";
}

/** CC BY 4.0 표기가 필요한 것은 SBHNews 뿐입니다 */
export { SBH };

/*
 * 갱신 스크립트가 달별 파일을 장기 보관용으로 쌓고, 화면이 쓸 최근분만
 * `recent.json` 하나로 합쳐 둡니다. 경로가 고정이라 달이 바뀌어도 코드를
 * 손댈 일이 없습니다.
 */
import recentJson from "@/data/generated/news/recent.json";

type RecentFile = { updatedAt: string; days: number; items: ArchivedRaw[] };

const recentFile = recentJson as unknown as RecentFile;

function expand(r: ArchivedRaw): Archived {
  const s = r.s ?? "sbh";
  return {
    title: r.t,
    link: r.u,
    date: r.d,
    day: r.d.slice(0, 10),
    dayKst: kstDay(r.d),
    category: r.c,
    themes: r.th ?? [],
    tickers: r.tk ?? [],
    source: s,
    sourceLabel: sourceLabel(s),
    english: isEnglishSource(s),
  };
}

/** 보관된 기사(최근 90일), 최신순 */
export const archive: Archived[] = (recentFile?.items ?? [])
  .map(expand)
  .sort((a, b) => (a.date < b.date ? 1 : -1));

export const archiveUpdatedAt: string | null = recentFile?.updatedAt || null;

export const hasArchive = archive.length > 0;

/**
 * 날짜별로 묶어 돌려줍니다 — 지난 기사를 넘겨 보는 화면용.
 *
 * 최신 날짜가 앞에 옵니다. 기사가 하나도 없는 날은 아예 나오지 않습니다.
 * 보는 사람이 한국에 있으므로 **한국 날짜**로 묶습니다.
 */
export function newsByDay(): { day: string; items: Archived[] }[] {
  const map = new Map<string, Archived[]>();
  for (const a of archive) {
    map.set(a.dayKst, [...(map.get(a.dayKst) ?? []), a]);
  }
  return [...map.entries()]
    .map(([day, items]) => ({ day, items }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}

/** 이 종목이 걸린 기사 */
export function newsForTicker(ticker: string, limit = 8): Archived[] {
  const t = ticker.toUpperCase();
  return archive.filter((a) => a.tickers.includes(t)).slice(0, limit);
}

/** 이 테마가 걸린 기사 */
export function newsForTheme(slug: string, limit = 8): Archived[] {
  return archive.filter((a) => a.themes.includes(slug)).slice(0, limit);
}

/** 이 층에 속한 종목들이 걸린 기사 — 층이 왜 움직였는지 힌트 */
export function newsForTickers(tickers: string[], limit = 5): Archived[] {
  const set = new Set(tickers.map((t) => t.toUpperCase()));
  return archive
    .filter((a) => a.tickers.some((t) => set.has(t)))
    .slice(0, limit);
}

/**
 * 어느 날 그 종목에 무슨 기사가 있었나.
 * 매매노트의 "내가 이 날 왜 샀지"에 답하는 데 씁니다.
 * 하루 앞뒤로 여유를 둡니다 — 미국장 기사는 한국 날짜와 하루 어긋납니다.
 */
export function newsOnDay(
  ticker: string,
  day: string,
  spread = 1,
): Archived[] {
  const t = ticker.toUpperCase();
  const target = new Date(`${day}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return [];
  const window = spread * 86400000;
  return archive.filter((a) => {
    if (!a.tickers.includes(t)) return false;
    const d = new Date(a.date).getTime();
    return Math.abs(d - target) <= window + 86400000;
  });
}

/** 차트에 점을 찍기 위한 날짜 목록 (unix seconds) */
export function newsDaysForTicker(ticker: string): {
  day: string;
  time: number;
  titles: string[];
}[] {
  const byDay = new Map<string, string[]>();
  for (const a of newsForTicker(ticker, 200)) {
    byDay.set(a.day, [...(byDay.get(a.day) ?? []), a.title]);
  }
  return [...byDay.entries()]
    .map(([day, titles]) => ({
      day,
      time: Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 1000),
      titles,
    }))
    .sort((a, b) => a.time - b.time);
}

/**
 * 실시간 피드 항목과 같은 모양으로 바꿉니다 (요약은 없습니다).
 *
 * **출처를 반드시 함께 넘깁니다.** 예전에는 여기서 출처를 버렸는데, 그러면
 * 받는 쪽이 어느 매체인지 알 수 없어 한국어 매체 하나로 뭉뚱그려 표기하게
 * 됩니다. 실제로 CNBC 기사만 있는 테마 화면에 "출처 SBHNews · CC BY 4.0" 이
 * 붙어 있었습니다 — 잘못된 저작자 표시입니다.
 */
export function toNewsItem(
  a: Archived,
): NewsItem & { sourceLabel: string; tickers: string[] } {
  return {
    title: a.title,
    link: a.link,
    description: "",
    pubDate: a.date,
    category: a.category,
    sourceLabel: a.sourceLabel,
    tickers: a.tickers,
  };
}
