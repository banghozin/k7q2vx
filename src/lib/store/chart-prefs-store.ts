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
  hydrated: boolean;
};

type Actions = {
  setIndicators: (board: Board, list: string[]) => void;
  setHydrated: () => void;
};

const EMPTY: Record<Board, string[]> = { analyze: [], practice: [] };

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
      hydrated: false,
      setIndicators: (board, list) =>
        set((s) => ({ indicators: { ...s.indicators, [board]: list } })),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "thememap.chartprefs.v1",
      storage: deviceStorage(),
      partialize: (s) => ({ indicators: s.indicators }) as State & Actions,
      merge: (persisted, current) => ({
        ...current,
        indicators: clean((persisted as Partial<State> | undefined)?.indicators),
      }),
      onRehydrateStorage: () => (s) => s?.setHydrated(),
    },
  ),
);
