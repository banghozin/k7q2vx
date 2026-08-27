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

type State = {
  indicators: Record<Board, string[]>;
  /** 마지막으로 쓴 펜 — 들어올 때마다 다시 고르지 않게 */
  pen: { color: string; size: number };
  /** 직접 고른 색 (최근 것부터). 자주 쓰는 색을 다시 찾기 쉽게 */
  recentColors: string[];
  hydrated: boolean;
};

type Actions = {
  setIndicators: (board: Board, list: string[]) => void;
  setPen: (color: string, size: number) => void;
  rememberColor: (color: string) => void;
  setHydrated: () => void;
};

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
  const one = (x: unknown) =>
    Array.isArray(x)
      ? [...new Set(x.filter((s): s is string => typeof s === "string"))].slice(0, 12)
      : [];
  return { analyze: one(o.analyze), practice: one(o.practice) };
}

export const useChartPrefs = create<State & Actions>()(
  persist(
    (set) => ({
      indicators: EMPTY,
      pen: DEFAULT_PEN,
      recentColors: [],
      hydrated: false,
      setIndicators: (board, list) =>
        set((s) => ({ indicators: { ...s.indicators, [board]: list } })),
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
          pen: s.pen,
          recentColors: s.recentColors,
        }) as State & Actions,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          indicators: clean(p.indicators),
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
