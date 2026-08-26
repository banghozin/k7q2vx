/**
 * 계산된 시장 데이터를 읽습니다.
 *
 * `scripts/compute.ts` 가 만든 JSON 을 그대로 가져와 빌드에 굽습니다.
 * 하루 1회 갱신이라 배포도 하루 1회면 충분해, 원격에서 실시간으로 읽는
 * 복잡한 구조를 쓰지 않습니다. (갱신 주기를 늘리게 되면 이 파일 하나만
 * raw.githubusercontent.com 을 읽도록 바꾸면 됩니다.)
 *
 * 파일이 아직 없을 수도 있으므로 — 처음 클론했거나 계산을 안 돌린 경우 —
 * 모든 조회 함수는 값이 없으면 null 을 돌려주고, 화면은 "—" 로 표시합니다.
 */

import stocksJson from "@/data/generated/stocks.json";
import layersJson from "@/data/generated/layers.json";
import syncJson from "@/data/generated/sync.json";
import leadersJson from "@/data/generated/leaders.json";
import briefingJson from "@/data/generated/briefing.json";
import rotationJson from "@/data/generated/rotation.json";
import historyJson from "@/data/generated/briefing-history.json";

export type StockMetrics = {
  last: number | null;
  ret1: number | null;
  ret5: number | null;
  ret20: number | null;
  ret60: number | null;
  rs20: number | null;
  dollarVol: number | null;
  volRatio: number | null;
  pos52: number | null;
  bars: number;
};

export type LayerHeat = {
  n: number;
  key: string;
  name: string;
  ret5: number | null;
  ret20: number | null;
  up: number;
  total: number;
  rank20: number | null;
  best: string | null;
  worst: string | null;
};

export type SyncMember = {
  ticker: string;
  hits: number;
  events: number;
  rate: number | null;
  avgReturn: number | null;
  response: number | null;
  partial: boolean;
};

/** 기준 종목 하나에 대한 동조율 */
export type OneSync = {
  leader: string;
  threshold: number;
  events: number;
  window: number;
  leaderAvg: number | null;
  members: SyncMember[];
};

/**
 * 한 테마의 동조율. 기준 종목을 여러 개 미리 계산해 두어
 * 화면에서 "NVDA 기준으로 보면?" 같은 질문에 바로 답할 수 있게 합니다.
 */
export type ThemeSync = {
  default: string;
  candidates: string[];
  byLeader: Record<string, OneSync>;
  note: string;
};

export type LeaderRow = {
  ticker: string;
  score: number;
  pull: number | null;
  lead: number | null;
  rs: number | null;
  flow: number | null;
  pullDays: number;
  peripheral: boolean;
};

export type ThemeLeaders = {
  ranked: LeaderRow[];
  handover: { from: string; to: string; agoDays: number } | null;
  margin: number | null;
  close: boolean;
  note: string;
};

/** 층 사이의 자리바꿈 */
export type LayerMove = {
  n: number;
  key: string;
  name: string;
  delta: number;
  rank20: number;
  rank5: number;
  ret5: number;
  ret20: number;
};

export type ThemeBriefing = {
  hottest: { n: number; name: string; ret20: number } | null;
  coldest: { n: number; name: string; ret20: number } | null;
  riser: LayerMove | null;
  faller: LayerMove | null;
  rotated: boolean;
};

/** 한 층의 순위 궤적 */
export type RotationLayer = {
  n: number;
  key: string;
  name: string;
  ranks: (number | null)[];
  rets: (number | null)[];
};

export type ThemeRotation = {
  dates: string[];
  layers: RotationLayer[];
  riser: string | null;
  faller: string | null;
};

type Meta = { generatedAt: string; asOf: string; source: string };

const stocksData = stocksJson as unknown as Meta & {
  stocks: Record<string, StockMetrics>;
};
const layersData = layersJson as unknown as Meta & {
  themes: Record<string, { layers: LayerHeat[] }>;
};
const syncData = syncJson as unknown as Meta & {
  minEvents: number;
  themes: Record<string, ThemeSync>;
};
const leadersData = leadersJson as unknown as Meta & {
  themes: Record<string, ThemeLeaders>;
};
const briefingData = briefingJson as unknown as Meta & {
  themes: Record<string, ThemeBriefing>;
};

const rotationData = rotationJson as unknown as Meta & {
  themes: Record<string, ThemeRotation>;
};

/* ── 지난 브리핑 ─────────────────────────────────────────────────── */

/** 하루치 기록. briefing.json 에서 뒤에 다시 볼 것만 남긴 것 */
export type BriefingDay = {
  asOf: string;
  themes: Record<
    string,
    {
      hottest: { n: number; name: string; ret20: number } | null;
      riser: { n: number; name: string; delta: number } | null;
      faller: { n: number; name: string; delta: number } | null;
      rotated: boolean;
    }
  >;
};

const historyData = historyJson as unknown as {
  generatedAt: string;
  asOf: string;
  days: BriefingDay[];
};

/**
 * 최근 며칠치 기록. 오래된 것이 앞, 최근 것이 뒤입니다.
 *
 * 2026-08-26 부터 쌓기 시작했으므로 처음에는 짧습니다. 화면은 며칠치인지를
 * 밝히고, 너무 짧으면 아직 쌓는 중이라고 말합니다 — 없는 것을 있는 척하지
 * 않기 위해서입니다.
 */
export function briefingHistory(days = 7): BriefingDay[] {
  const all = historyData?.days ?? [];
  return all.slice(-days);
}

export function getBriefing(themeSlug: string): ThemeBriefing | null {
  return briefingData?.themes?.[themeSlug] ?? null;
}

export function getRotation(themeSlug: string): ThemeRotation | null {
  const r = rotationData?.themes?.[themeSlug];
  return r?.dates?.length ? r : null;
}

/** 자리바꿈이 뚜렷한 테마들 — 홈의 한 줄 브리핑 재료 */
export function rotations(): { slug: string; b: ThemeBriefing }[] {
  const out: { slug: string; b: ThemeBriefing }[] = [];
  for (const [slug, b] of Object.entries(briefingData?.themes ?? {})) {
    if (b.rotated && b.riser && b.faller) out.push({ slug, b });
  }
  // 많이 움직인 순
  return out.sort(
    (a, b) =>
      (b.b.riser?.delta ?? 0) -
      (b.b.faller?.delta ?? 0) -
      ((a.b.riser?.delta ?? 0) - (a.b.faller?.delta ?? 0)),
  );
}

/** 데이터 기준일 (미국장 마지막 거래일) */
export const asOf: string | null = stocksData?.asOf ?? null;
export const generatedAt: string | null = stocksData?.generatedAt ?? null;
export const hasMarketData = Boolean(
  stocksData?.stocks && Object.keys(stocksData.stocks).length > 0,
);

export function getStock(ticker: string): StockMetrics | null {
  return stocksData?.stocks?.[ticker.toUpperCase()] ?? null;
}

export function getLayerHeat(themeSlug: string): LayerHeat[] {
  return layersData?.themes?.[themeSlug]?.layers ?? [];
}

export function getLayerHeatOne(
  themeSlug: string,
  layerN: number,
): LayerHeat | null {
  return getLayerHeat(themeSlug).find((l) => l.n === layerN) ?? null;
}

export function getSync(themeSlug: string): ThemeSync | null {
  return syncData?.themes?.[themeSlug] ?? null;
}

export function getLeaders(themeSlug: string): ThemeLeaders | null {
  return leadersData?.themes?.[themeSlug] ?? null;
}

/** 이 테마에서 계산된 대장주 (곁다리 제외). 없으면 null */
export function getLeaderTicker(themeSlug: string): string | null {
  const l = getLeaders(themeSlug);
  if (!l) return null;
  return l.ranked.find((r) => !r.peripheral)?.ticker ?? null;
}

/** 손바뀜이 감지된 테마들 */
export function handovers(): {
  slug: string;
  from: string;
  to: string;
  agoDays: number;
}[] {
  const out: { slug: string; from: string; to: string; agoDays: number }[] = [];
  for (const [slug, v] of Object.entries(leadersData?.themes ?? {})) {
    if (v.handover) out.push({ slug, ...v.handover });
  }
  return out;
}

/** 전 테마를 가로질러 20일 성과 상·하위 층 */
export function hottestLayers(limit = 3): {
  slug: string;
  layer: LayerHeat;
}[] {
  const all: { slug: string; layer: LayerHeat }[] = [];
  for (const [slug, v] of Object.entries(layersData?.themes ?? {})) {
    for (const layer of v.layers) {
      if (layer.ret20 != null) all.push({ slug, layer });
    }
  }
  all.sort((a, b) => (b.layer.ret20 as number) - (a.layer.ret20 as number));
  return all.slice(0, limit);
}

export function coldestLayers(limit = 3): {
  slug: string;
  layer: LayerHeat;
}[] {
  const all: { slug: string; layer: LayerHeat }[] = [];
  for (const [slug, v] of Object.entries(layersData?.themes ?? {})) {
    for (const layer of v.layers) {
      if (layer.ret20 != null) all.push({ slug, layer });
    }
  }
  all.sort((a, b) => (a.layer.ret20 as number) - (b.layer.ret20 as number));
  return all.slice(0, limit);
}

/* 표기 도우미는 lib/format.ts 에 있습니다 — 브라우저 쪽 컴포넌트가
   이 파일(시세 JSON 포함)을 통째로 끌어가지 않도록 분리했습니다. */
export { pct, tone, money } from "./format";
