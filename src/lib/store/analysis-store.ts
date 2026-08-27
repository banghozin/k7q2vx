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
 * **종목 하나에 한 벌입니다. 봉 단위로 나누지 않습니다.**
 *
 * 처음에는 `NVDA:1d` 처럼 봉 단위까지 묶어 나눴습니다. "일봉에 그은 추세선과
 * 5분봉에 그은 것은 다른 이야기" 라고 봤기 때문입니다. 그런데 쓰다 보니
 * **봉 단위를 바꾸는 순간 그린 것이 통째로 사라졌습니다.** 주봉으로 큰 그림을
 * 보고 일봉으로 내려오면 방금 그은 선이 없어지는 셈입니다.
 *
 * 트레이딩뷰를 비롯한 차트 도구들은 그렇게 하지 않습니다. 선은 **시각과
 * 가격에 박혀 있고**, 봉 단위를 바꾸면 그 좌표 그대로 다시 그려집니다. 주봉의
 * 추세선이 일봉에서도 같은 자리를 지나가는 것이 당연하고, 오히려 그래야
 * "큰 흐름과 지금 자리" 를 겹쳐 볼 수 있습니다.
 *
 * 우리도 좌표를 처음부터 화면 위치(px)가 아니라 **시각과 가격**으로 적어
 * 뒀으므로, 열쇠에서 봉 단위만 빼면 그대로 됩니다. 확대·축소를 하거나 창
 * 크기가 달라져도 자리가 어긋나지 않는 것과 같은 이유입니다.
 */

export type Sheet = {
  /** 종목 티커. 봉 단위는 열쇠에 넣지 않습니다 — 아래 참고 */
  key: string;
  ticker: string;
  /** 마지막으로 보던 봉 단위. 열쇠가 아니라 그냥 기록입니다 */
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
  get: (ticker: string) => Sheet | undefined;
  setMemo: (key: string, memo: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  setHydrated: () => void;
};

/** 열쇠는 종목뿐입니다. 봉 단위는 들어가지 않습니다 — 위 설명 참고 */
export const sheetKey = (ticker: string) => ticker.trim().toUpperCase();

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

/**
 * 예전에 봉 단위별로 나눠 저장해 둔 것을 종목 하나로 합칩니다.
 *
 * 열쇠를 `NVDA:1d` 에서 `NVDA` 로 바꿨으므로, 그냥 두면 **이미 그려 둔 것이
 * 통째로 안 보이게 됩니다.** 저장된 값은 멀쩡한데 찾지를 못하는 것이라
 * 더 나쁩니다 — "지웠나?" 하게 되니까요.
 *
 * 같은 종목에 여러 봉 단위로 그려 둔 것이 있으면 **전부 합칩니다.** 어차피
 * 이제는 봉 단위와 무관하게 다 보이는 것이 맞고, 버리는 것보다 낫습니다.
 * 똑같은 선이 두 번 들어가는 것만 걸러냅니다.
 */
function migrate(raw: unknown): Record<string, Sheet> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, Sheet> = {};

  for (const s of Object.values(raw as Record<string, Sheet>)) {
    if (!s || typeof s !== "object" || typeof s.ticker !== "string") continue;
    const key = sheetKey(s.ticker);
    if (!key) continue;
    const drawings = Array.isArray(s.drawings) ? s.drawings : [];
    const prev = out[key];

    if (!prev) {
      out[key] = {
        key,
        ticker: key,
        tf: typeof s.tf === "string" ? s.tf : "1d",
        updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : "",
        drawings,
        memo: typeof s.memo === "string" ? s.memo : "",
      };
      continue;
    }

    // 같은 종목이 여러 벌로 나뉘어 있던 경우 — 합칩니다
    const seen = new Set(prev.drawings.map((d) => JSON.stringify(d)));
    for (const d of drawings) {
      const sig = JSON.stringify(d);
      if (seen.has(sig)) continue;
      seen.add(sig);
      prev.drawings.push(d);
    }
    const newer = (s.updatedAt ?? "") > prev.updatedAt;
    if (newer) {
      prev.updatedAt = s.updatedAt;
      prev.tf = typeof s.tf === "string" ? s.tf : prev.tf;
    }
    if (!prev.memo && typeof s.memo === "string") prev.memo = s.memo;
  }

  return capSheets(out);
}

export const useAnalysis = create<State & Actions>()(
  persist(
    (set, get) => ({
      sheets: {},
      hydrated: false,
      save: (ticker, tf, drawings, memo) =>
        set((st) => {
          const key = sheetKey(ticker);
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
      get: (ticker) => get().sheets[sheetKey(ticker)],
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
      merge: (persisted, current) => ({
        ...current,
        sheets: migrate((persisted as Partial<State> | undefined)?.sheets),
      }),
      onRehydrateStorage: () => (s) => s?.setHydrated(),
    },
  ),
);
