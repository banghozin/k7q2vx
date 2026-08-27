"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { deviceStorage } from "./device-storage";
import type { SavedDrawing } from "@/components/practice/kline";

/**
 * 차트 분석 화면에 그려 둔 것.
 *
 * **이 기기의 브라우저에만 저장됩니다.** 서버로 가지 않고 다른 기기에서도
 * 보이지 않습니다 — 매매노트·워치리스트·훈련기록과 같은 방식입니다.
 *
 * 종목과 봉 단위를 묶어 한 벌로 봅니다. NVDA 일봉에 그은 추세선과 NVDA
 * 5분봉에 그은 것은 서로 다른 이야기이므로 따로 남깁니다.
 *
 * 좌표는 화면 위치(px)가 아니라 **시각과 가격**으로 적어 두므로, 나중에
 * 확대·축소를 하거나 창 크기가 달라져도 같은 자리에 다시 그려집니다.
 */

export type Sheet = {
  /** `NVDA:1d` 처럼 종목과 봉 단위를 묶은 열쇠 */
  key: string;
  ticker: string;
  tf: string;
  updatedAt: string;
  drawings: SavedDrawing[];
  /** 스스로 적어 두는 한 줄 */
  memo: string;
};

type State = { sheets: Record<string, Sheet>; hydrated: boolean };

type Actions = {
  save: (
    ticker: string,
    tf: string,
    drawings: SavedDrawing[],
    memo?: string,
  ) => void;
  get: (ticker: string, tf: string) => Sheet | undefined;
  setMemo: (key: string, memo: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  setHydrated: () => void;
};

export const sheetKey = (ticker: string, tf: string) =>
  `${ticker.toUpperCase()}:${tf}`;

/**
 * 보관할 최대 벌 수.
 *
 * localStorage 는 대략 5MB 에서 막히고, 넘치면 저장이 **예외를 던집니다.**
 * 종목 하나에 봉 단위가 여덟이라 이것저것 눌러 보다 보면 생각보다 빨리
 * 늡니다. 훈련 기록(`practice-store`)이 200벌에서 끊는 것과 같은 방식으로
 * 오래 손대지 않은 것부터 버립니다. 그린 것이 없는 빈 벌은 먼저 버립니다.
 */
const MAX_SHEETS = 120;

function capSheets(sheets: Record<string, Sheet>): Record<string, Sheet> {
  const all = Object.values(sheets);
  if (all.length <= MAX_SHEETS) return sheets;
  const keep = all
    .slice()
    .sort((a, b) => {
      const aEmpty = a.drawings.length === 0 && !a.memo.trim();
      const bEmpty = b.drawings.length === 0 && !b.memo.trim();
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      return a.updatedAt < b.updatedAt ? 1 : -1;
    })
    .slice(0, MAX_SHEETS);
  return Object.fromEntries(keep.map((s) => [s.key, s]));
}

/** 최근에 손댄 것부터 */
export function recentSheets(sheets: Record<string, Sheet>): Sheet[] {
  return Object.values(sheets)
    .filter((s) => s.drawings.length > 0 || s.memo.trim().length > 0)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export const useAnalysis = create<State & Actions>()(
  persist(
    (set, get) => ({
      sheets: {},
      hydrated: false,
      save: (ticker, tf, drawings, memo) =>
        set((st) => {
          const key = sheetKey(ticker, tf);
          const prev = st.sheets[key];
          const next: Record<string, Sheet> = {
            ...st.sheets,
            [key]: {
              key,
              ticker: ticker.toUpperCase(),
              tf,
              updatedAt: new Date().toISOString(),
              drawings,
              memo: memo ?? prev?.memo ?? "",
            },
          };
          return { sheets: capSheets(next) };
        }),
      get: (ticker, tf) => get().sheets[sheetKey(ticker, tf)],
      setMemo: (key, memo) =>
        set((st) =>
          st.sheets[key]
            ? {
                sheets: {
                  ...st.sheets,
                  [key]: {
                    ...st.sheets[key],
                    memo,
                    updatedAt: new Date().toISOString(),
                  },
                },
              }
            : st,
        ),
      remove: (key) =>
        set((st) => {
          const next = { ...st.sheets };
          delete next[key];
          return { sheets: next };
        }),
      clear: () => set({ sheets: {} }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "thememap.analysis.v1",
      storage: deviceStorage(),
      partialize: (s) => ({ sheets: s.sheets }) as State & Actions,
      onRehydrateStorage: () => (s) => s?.setHydrated(),
    },
  ),
);
