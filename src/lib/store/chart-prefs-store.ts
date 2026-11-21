"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { deviceStorage } from "./device-storage";

/**
 * 차트 화면에서 켜 둔 것 — 이 기기에만 남습니다.
 *
 * 보조지표는 켜 두고 나면 계속 그 상태이길 바라는 것입니다. 그런데 새로고침
 * 하거나 종목·봉 단위를 바꾸면 차트를 새로 만들기 때문에 **싹 사라졌습니다.**
 * 그릴 때마다 이동평균을 다시 켜야 했습니다.
 *
 * 그린 것(`analysis-store`)과 달리 종목·봉 단위별로 나누지 않습니다. "나는
 * 이동평균을 보고 판단한다" 는 사람의 습관이지 종목의 성질이 아닙니다.
 * 다만 **훈련과 분석은 따로** 둡니다 — 훈련은 가린 채 보는 것이라 평소보다
 * 지표를 적게 켜는 쪽이 자연스럽습니다.
 */

export type Board = "analyze" | "practice";

/** 가격 눈금 — 보통 / 로그 / % (화면 왼쪽 끝 봉 대비) */
export type YScale = "normal" | "logarithm" | "percentage";
/** 그을 때 고가·저가에 붙이기. 끔 / 가까우면 / 늘 */
export type Magnet = "normal" | "weak_magnet" | "strong_magnet";

/**
 * 지표 묶음 — "단타용", "스윙용" 처럼 켜는 지표와 그 설정을 한 번에 저장합니다.
 * 트레이딩뷰의 "지표 템플릿" 과 같습니다.
 */
export type IndTemplate = {
  name: string;
  indicators: string[];
  params: Record<string, number[]>;
};

type State = {
  indicators: Record<Board, string[]>;
  /** 지표별 설정 (이동평균 기간 등). 비어 있으면 기본값 */
  indParams: Record<string, number[]>;
  yScale: YScale;
  magnet: Magnet;
  /** 가격·봉 비율 고정 — 확대·축소해도 차트 모양이 그대로 */
  priceLock: boolean;
  /** 가격 눈금 뒤집기 */
  invertScale: boolean;
  templates: IndTemplate[];
  /** 겹쳐 보는 비교 종목 (최대 3) */
  compare: string[];
  /** 분·시간봉에 장전·장후 거래도 넣을지 */
  prepost: boolean;
  /** 화면 나누기 — 1·2·4 칸 */
  layout: 1 | 2 | 4;
  /** 나눈 칸들에 띄운 종목 (첫 칸은 본 차트라 빼고) */
  layoutTickers: string[];
  /** 마지막으로 쓴 펜 — 들어올 때마다 다시 고르지 않게 */
  pen: { color: string; size: number };
  /** 직접 고른 색 (최근 것부터). 자주 쓰는 색을 다시 찾기 쉽게 */
  recentColors: string[];
  hydrated: boolean;
};

type Actions = {
  setIndicators: (board: Board, list: string[]) => void;
  setIndParams: (key: string, params: number[] | null) => void;
  setYScale: (v: YScale) => void;
  setMagnet: (v: Magnet) => void;
  setPriceLock: (v: boolean) => void;
  setInvertScale: (v: boolean) => void;
  saveTemplate: (t: IndTemplate) => void;
  removeTemplate: (name: string) => void;
  setCompare: (list: string[]) => void;
  setPrepost: (v: boolean) => void;
  setLayout: (v: 1 | 2 | 4) => void;
  setLayoutTickers: (list: string[]) => void;
  setPen: (color: string, size: number) => void;
  rememberColor: (color: string) => void;
  setHydrated: () => void;
};

const MAX_TEMPLATES = 12;
const TICKER_RE = /^[A-Z0-9.\-]{1,10}$/;

function cleanParams(v: unknown): Record<string, number[]> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number[]> = {};
  for (const [k, arr] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[A-Z0-9_]{1,12}$/.test(k) || !Array.isArray(arr)) continue;
    const nums = arr.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (nums.length === arr.length && nums.length <= 8) out[k] = nums;
  }
  return out;
}

function cleanTickers(v: unknown, max: number): string[] {
  return Array.isArray(v)
    ? [...new Set(v.filter((s): s is string => typeof s === "string" && TICKER_RE.test(s)))].slice(0, max)
    : [];
}

function cleanTemplates(v: unknown): IndTemplate[] {
  if (!Array.isArray(v)) return [];
  const out: IndTemplate[] = [];
  for (const t of v) {
    if (!t || typeof t !== "object") continue;
    const o = t as Partial<IndTemplate>;
    if (typeof o.name !== "string" || !o.name.trim()) continue;
    out.push({
      name: o.name.trim().slice(0, 30),
      indicators: Array.isArray(o.indicators)
        ? o.indicators.filter((s): s is string => typeof s === "string").slice(0, 20)
        : [],
      params: cleanParams(o.params),
    });
  }
  return out.slice(0, MAX_TEMPLATES);
}

const EMPTY: Record<Board, string[]> = { analyze: [], practice: [] };
const DEFAULT_PEN = { color: "#c8a15a", size: 2 };
/** 직접 고른 색을 몇 개까지 들고 있을지 */
const MAX_RECENT = 8;

/** `#rrggbb` 만 받습니다 — 남이 넣은 값이 그대로 스타일로 들어가면 안 됩니다 */
export function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

/** 저장돼 있던 값도 믿지 않습니다 — 모양이 어긋나면 차트가 깨집니다 */
function clean(v: unknown): Record<Board, string[]> {
  const o = (v ?? {}) as Partial<Record<Board, unknown>>;
  // 지표가 18개로 늘어서 상한도 올립니다 (예전 12)
  const one = (x: unknown) =>
    Array.isArray(x)
      ? [...new Set(x.filter((s): s is string => typeof s === "string"))].slice(0, 24)
      : [];
  return { analyze: one(o.analyze), practice: one(o.practice) };
}

export const useChartPrefs = create<State & Actions>()(
  persist(
    (set) => ({
      indicators: EMPTY,
      indParams: {},
      yScale: "normal",
      magnet: "normal",
      priceLock: false,
      invertScale: false,
      templates: [],
      compare: [],
      prepost: false,
      layout: 1,
      layoutTickers: [],
      pen: DEFAULT_PEN,
      recentColors: [],
      hydrated: false,
      setIndicators: (board, list) =>
        set((s) => ({ indicators: { ...s.indicators, [board]: list } })),
      setIndParams: (key, params) =>
        set((s) => {
          const next = { ...s.indParams };
          if (params) next[key] = params;
          else delete next[key];
          return { indParams: next };
        }),
      setYScale: (yScale) => set({ yScale }),
      setMagnet: (magnet) => set({ magnet }),
      setPriceLock: (priceLock) => set({ priceLock }),
      setInvertScale: (invertScale) => set({ invertScale }),
      saveTemplate: (t) =>
        set((s) => ({
          templates: [t, ...s.templates.filter((x) => x.name !== t.name)].slice(0, MAX_TEMPLATES),
        })),
      removeTemplate: (name) =>
        set((s) => ({ templates: s.templates.filter((x) => x.name !== name) })),
      setCompare: (list) => set({ compare: cleanTickers(list, 3) }),
      setPrepost: (prepost) => set({ prepost }),
      setLayout: (layout) => set({ layout }),
      setLayoutTickers: (list) => set({ layoutTickers: cleanTickers(list, 3) }),
      setPen: (color, size) =>
        set({
          pen: {
            color: isHex(color) ? color : DEFAULT_PEN.color,
            size: Number.isFinite(size) && size > 0 && size <= 10 ? size : 2,
          },
        }),
      rememberColor: (color) =>
        set((s) =>
          isHex(color)
            ? {
                recentColors: [
                  color,
                  ...s.recentColors.filter((c) => c !== color),
                ].slice(0, MAX_RECENT),
              }
            : s,
        ),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "thememap.chartprefs.v1",
      storage: deviceStorage(),
      partialize: (s) =>
        ({
          indicators: s.indicators,
          indParams: s.indParams,
          yScale: s.yScale,
          magnet: s.magnet,
          priceLock: s.priceLock,
          invertScale: s.invertScale,
          templates: s.templates,
          compare: s.compare,
          prepost: s.prepost,
          layout: s.layout,
          layoutTickers: s.layoutTickers,
          pen: s.pen,
          recentColors: s.recentColors,
        }) as State & Actions,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          indicators: clean(p.indicators),
          indParams: cleanParams(p.indParams),
          yScale: (["normal", "logarithm", "percentage"] as const).includes(p.yScale as YScale)
            ? (p.yScale as YScale)
            : "normal",
          magnet: (["normal", "weak_magnet", "strong_magnet"] as const).includes(p.magnet as Magnet)
            ? (p.magnet as Magnet)
            : "normal",
          priceLock: p.priceLock === true,
          invertScale: p.invertScale === true,
          templates: cleanTemplates(p.templates),
          compare: cleanTickers(p.compare, 3),
          prepost: p.prepost === true,
          layout: p.layout === 2 || p.layout === 4 ? p.layout : 1,
          layoutTickers: cleanTickers(p.layoutTickers, 3),
          pen: {
            color: isHex(p.pen?.color) ? p.pen.color : DEFAULT_PEN.color,
            size:
              typeof p.pen?.size === "number" &&
              Number.isFinite(p.pen.size) &&
              p.pen.size > 0 &&
              p.pen.size <= 10
                ? p.pen.size
                : DEFAULT_PEN.size,
          },
          recentColors: Array.isArray(p.recentColors)
            ? p.recentColors.filter(isHex).slice(0, MAX_RECENT)
            : [],
        };
      },
      onRehydrateStorage: () => (s) => s?.setHydrated(),
    },
  ),
);
