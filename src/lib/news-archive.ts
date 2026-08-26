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

/** 보관된 기사. 파일 크기를 줄이려고 키를 짧게 뒀습니다. */
export type ArchivedRaw = {
  t: string;
  u: string;
  d: string;
  c: string;
  th: string[];
  tk: string[];
};

export type Archived = {
  title: string;
  link: string;
  /** 발행 시각 (ISO) */
  date: string;
  /** 발행일 (YYYY-MM-DD) */
  day: string;
  category: string;
  themes: string[];
  tickers: string[];
};

/*
 * 갱신 스크립트가 달별 파일을 장기 보관용으로 쌓고, 화면이 쓸 최근분만
 * `recent.json` 하나로 합쳐 둡니다. 경로가 고정이라 달이 바뀌어도 코드를
 * 손댈 일이 없습니다.
 */
import recentJson from "@/data/generated/news/recent.json";

type RecentFile = { updatedAt: string; days: number; items: ArchivedRaw[] };

const recentFile = recentJson as unknown as RecentFile;

function expand(r: ArchivedRaw): Archived {
  return {
    title: r.t,
    link: r.u,
    date: r.d,
    day: r.d.slice(0, 10),
    category: r.c,
    themes: r.th ?? [],
    tickers: r.tk ?? [],
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
 */
export function newsByDay(): { day: string; items: Archived[] }[] {
  const map = new Map<string, Archived[]>();
  for (const a of archive) {
    map.set(a.day, [...(map.get(a.day) ?? []), a]);
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

/** 실시간 피드 항목과 같은 모양으로 바꿉니다 (요약은 없습니다) */
export function toNewsItem(a: Archived): NewsItem {
  return {
    title: a.title,
    link: a.link,
    description: "",
    pubDate: a.date,
    category: a.category,
  };
}
