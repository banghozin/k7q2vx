"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { deviceStorage } from "./device-storage";

/**
 * 차트 훈련 기록. **브라우저(localStorage)에만** 저장됩니다. 서버로 가지 않고
 * 다른 기기에서도 보이지 않습니다 — 매매노트·워치리스트와 같은 방식입니다.
 *
 * 왜 남기는가: 한 판이 끝나면 내가 뭘 그었는지 사라집니다. 쌓이면
 * "나는 추세선만 긋고 되돌림은 잘 안 보는구나" 같은 것을 **스스로** 볼 수
 * 있습니다. 잘했다 못했다를 매기지 않습니다 — 그건 CLAUDE.md 6번의 선을
 * 넘습니다. 무엇을 그었고 그 구간에 무슨 일이 있었는지 사실만 적습니다.
 */

/** 한 판에서 그은 것들 — 도구 이름별 개수 */
export type ToolTally = Record<string, number>;

export type PracticeSession = {
  id: string;
  /** 저장한 시각 */
  savedAt: string;
  ticker: string;
  name: string;
  /** 가려져 있던 시점 (이 날짜까지만 보고 그렸습니다) */
  cutDate: string;
  /** 그때 종가 */
  base: number;
  /** 몇 봉을 열어봤는지 */
  opened: number;
  /** 열린 구간의 사실 */
  change: number;
  maxUp: number;
  maxDown: number;
  /** 도구별 몇 번 그었는지 */
  tools: ToolTally;
  /** 내가 그은 수평선 중 실제가 닿은 것 / 전체 */
  levelsTouched: number;
  levelsTotal: number;
  /** 스스로 남기는 한 줄 */
  memo: string;
};

type State = {
  sessions: PracticeSession[];
  hydrated: boolean;
};

type Actions = {
  add: (s: Omit<PracticeSession, "id" | "savedAt">) => void;
  setMemo: (id: string, memo: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  setHydrated: () => void;
};

/** 가장 많이 쓴 도구 순으로. 화면에서 "나는 뭘 자주 긋는가" 를 보는 재료 */
export function toolTotals(sessions: PracticeSession[]): [string, number][] {
  const sum = new Map<string, number>();
  for (const s of sessions) {
    for (const [name, n] of Object.entries(s.tools)) {
      sum.set(name, (sum.get(name) ?? 0) + n);
    }
  }
  return [...sum].sort((a, b) => b[1] - a[1]);
}

const MAX = 200; // 너무 쌓이면 오래된 것부터 버립니다

export const usePractice = create<State & Actions>()(
  persist(
    (set) => ({
      sessions: [],
      hydrated: false,
      add: (s) =>
        set((st) => {
          /*
           * 같은 판(같은 종목·같은 가린 날)을 다시 저장하면 **덮어씁니다.**
           * 봉을 더 열어 보고 다시 남기는 경우가 있는데, 그때 두 줄이 생기면
           * 같은 판을 두 번 훈련한 것처럼 보여 도구 집계가 부풀려집니다.
           */
          const dup = st.sessions.find(
            (x) => x.ticker === s.ticker && x.cutDate === s.cutDate,
          );
          const row = {
            ...s,
            id: dup?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            savedAt: new Date().toISOString(),
            memo: dup?.memo ?? s.memo, // 적어 둔 한 줄은 지키고
          };
          return {
            sessions: [
              row,
              ...st.sessions.filter((x) => x.id !== row.id),
            ].slice(0, MAX),
          };
        }),
      setMemo: (id, memo) =>
        set((st) => ({
          sessions: st.sessions.map((x) => (x.id === id ? { ...x, memo } : x)),
        })),
      remove: (id) =>
        set((st) => ({ sessions: st.sessions.filter((x) => x.id !== id) })),
      clear: () => set({ sessions: [] }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "thememap.practice.v1",
      storage: deviceStorage(),
      partialize: (s) => ({ sessions: s.sessions }) as State & Actions,
      onRehydrateStorage: () => (s) => s?.setHydrated(),
    },
  ),
);
