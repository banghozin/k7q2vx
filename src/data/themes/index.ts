import type { Layer, Placement, Stock, Theme } from "../types";
import { ai } from "./ai";
import { autonomous } from "./autonomous";
import { crypto } from "./crypto";
import { ev } from "./ev";
import { obesity } from "./obesity";
import { power } from "./power";
import { quantum } from "./quantum";
import { robot } from "./robot";
import { security } from "./security";
import { shipping } from "./shipping";
import { space } from "./space";

/**
 * 테마를 추가하는 방법:
 *   1. themes/ 아래에 파일 하나를 만들고 Theme 모양대로 채웁니다.
 *   2. 여기 import 하고 아래 배열에 넣습니다.
 * 태그·검색·역방향 색인은 전부 이 배열에서 자동으로 만들어집니다.
 */
export const THEMES: Theme[] = [
  ai,
  power,
  robot,
  quantum,
  space,
  obesity,
  security,
  autonomous,
  ev,
  shipping,
  crypto,
];

export function getTheme(slug: string): Theme | undefined {
  return THEMES.find((t) => t.slug === slug);
}

/** 화면에 그릴 순서. 최상층이 위로 오도록 뒤집습니다. */
export function layersTopDown(theme: Theme): Layer[] {
  return [...theme.layers].sort((a, b) => b.n - a.n);
}

/* ------------------------------------------------------------------ *
 * 자동 태깅 — 역방향 색인
 *
 * 테마 파일만 보고 "이 티커가 어느 테마 어느 층에 있는가"를 전부 모읍니다.
 * 종목을 파일에 하나 추가하면 태그는 알아서 따라 생깁니다.
 * ------------------------------------------------------------------ */

const index: Map<string, Placement[]> = (() => {
  const m = new Map<string, Placement[]>();
  for (const theme of THEMES) {
    for (const layer of theme.layers) {
      for (const stock of layer.stocks) {
        const key = stock.ticker.toUpperCase();
        const list = m.get(key) ?? [];
        list.push({
          themeSlug: theme.slug,
          themeName: theme.name,
          layerN: layer.n,
          layerName: layer.name,
          stock,
        });
        m.set(key, list);
      }
    }
  }
  return m;
})();

/** 이 티커가 걸쳐 있는 모든 테마·층. 없으면 빈 배열. */
export function placementsOf(ticker: string): Placement[] {
  return index.get(ticker.trim().toUpperCase()) ?? [];
}

/** 지금 보고 있는 테마를 뺀 나머지 태그. 카드에 "또 어디에 있나"를 보여줄 때 씁니다. */
export function crossTagsOf(ticker: string, exceptSlug?: string): Placement[] {
  return placementsOf(ticker).filter((p) => p.themeSlug !== exceptSlug);
}

/** 티커 하나로 회사명을 찾습니다. 매매노트에서 종목을 고를 때 씁니다. */
export function nameOf(ticker: string): string | undefined {
  return placementsOf(ticker)[0]?.stock.name;
}

export type SearchHit = Placement & { ticker: string };

/** 티커·한글 회사명·테마명 어느 쪽으로 쳐도 찾히는 검색. */
export function searchStocks(query: string, limit = 20): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const [ticker, places] of index) {
    const p = places[0];
    const hay = `${ticker} ${p.stock.name} ${places
      .map((x) => x.themeName)
      .join(" ")}`.toLowerCase();
    if (!hay.includes(q)) continue;
    if (seen.has(ticker)) continue;
    seen.add(ticker);
    hits.push({ ...p, ticker });
    if (hits.length >= limit) break;
  }
  // 티커가 정확히 맞는 것을 맨 앞으로
  hits.sort((a, b) => {
    const ax = a.ticker.toLowerCase() === q ? 0 : 1;
    const bx = b.ticker.toLowerCase() === q ? 0 : 1;
    return ax - bx;
  });
  return hits;
}

/** 여러 테마에 동시에 올라 있는 종목들. 홈에서 "겹치는 종목"으로 보여줍니다. */
export function multiThemeStocks(): { ticker: string; places: Placement[] }[] {
  const out: { ticker: string; places: Placement[] }[] = [];
  for (const [ticker, places] of index) {
    const themes = new Set(places.map((p) => p.themeSlug));
    if (themes.size >= 2) out.push({ ticker, places });
  }
  return out.sort(
    (a, b) =>
      new Set(b.places.map((p) => p.themeSlug)).size -
        new Set(a.places.map((p) => p.themeSlug)).size ||
      a.ticker.localeCompare(b.ticker),
  );
}

export function allTickers(): string[] {
  return [...index.keys()].sort();
}

export type { Layer, Placement, Stock, Theme };
