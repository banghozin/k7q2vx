"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { deviceStorage } from "./device-storage";
import type { SavedDrawing } from "@/components/practice/kline";

/**
 * 매매노트.
 *
 * 저장 위치는 이 브라우저 하나뿐입니다(localStorage).
 * 서버로 전송되지 않고, 다른 기기와 동기화되지 않으며, 우리도 볼 수 없습니다.
 * 그래서 내보내기/가져오기가 반드시 필요합니다 — exportJSON / importJSON 참고.
 *
 * 이 파일 어디에도 "이 가격에 사라 / 팔아라"를 계산하는 코드는 없습니다.
 * 모든 숫자는 사용자가 직접 적은 값과 그 값들의 산수뿐입니다.
 */

/** 매매 이유 태그. 나중에 본인 통계를 내기 위한 것입니다. */
export const REASON_TAGS = [
  "실적",
  "뉴스·이벤트",
  "기술적 자리",
  "층 순환",
  "테마 확산",
  "남이 사서",
  "그냥",
] as const;

export type ReasonTag = (typeof REASON_TAGS)[number];

export type Target = {
  /** 익절 목표가 */
  price: number;
  /** 이 가격에서 정리할 비중(%) — 절반 익절이면 50 */
  portion: number;
};

/**
 * 매매를 걸 때 **얼려 둔** 분석 그림.
 *
 * 왜 복사해서 얼리는가: 분석 화면(`/analyze`)의 그림은 종목·봉 단위마다
 * 한 벌뿐이라 나중에 선을 고치면 덮어써집니다. 그대로 참조만 해 두면
 * **지난 매매의 근거가 소급해서 바뀝니다.** 그러면 회고가 거짓말이 됩니다.
 * 그래서 그 시점의 그림을 복사해 이 매매에 붙여 둡니다.
 */
export type TradeChart = {
  /** 봉 단위 (`1d`, `60m` …) */
  tf: string;
  /** 그때 그려져 있던 것 (복사본) */
  drawings: SavedDrawing[];
  /** 얼린 시각 */
  at: string;
};

export type Trade = {
  id: string;
  ticker: string;
  name: string;
  side: "long" | "short";
  status: "open" | "closed";

  /* 진입 — 이 네 가지가 없으면 저장되지 않습니다 */
  entryPrice: number;
  entryDate: string; // YYYY-MM-DD
  qty: number;
  stopPrice: number;

  targets: Target[];
  reasons: ReasonTag[];
  memo: string;

  /* 청산 */
  exitPrice?: number;
  exitDate?: string;
  /** 적어둔 손절가를 지켰는가 — 원칙 준수 카운터의 재료 */
  followedStop?: boolean;
  review?: string;

  /** 진입할 때 보고 있던 차트 그림. 없을 수도 있습니다 */
  chart?: TradeChart;

  createdAt: string;
};

export type Settings = {
  /** 계좌 총액(달러). 손실이 계좌의 몇 %인지 계산하는 데만 씁니다. */
  accountSize: number | null;
  /** 나만의 매매 원칙. 새 매매를 기록할 때 옆에 그대로 떠 있습니다. */
  principles: string[];
};

type State = {
  trades: Trade[];
  settings: Settings;
  hydrated: boolean;
};

type Actions = {
  add: (t: Omit<Trade, "id" | "createdAt" | "status">) => string;
  update: (id: string, patch: Partial<Trade>) => void;
  close: (
    id: string,
    exit: {
      exitPrice: number;
      exitDate: string;
      followedStop: boolean;
      review: string;
    },
  ) => void;
  remove: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  replaceAll: (data: { trades: Trade[]; settings: Settings }) => void;
  setHydrated: () => void;
};

function newId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useNotes = create<State & Actions>()(
  persist(
    (set) => ({
      trades: [],
      settings: { accountSize: null, principles: [] },
      hydrated: false,

      add: (t) => {
        const id = newId();
        set((s) => ({
          trades: [
            {
              ...t,
              id,
              status: "open",
              createdAt: new Date().toISOString(),
            },
            ...s.trades,
          ],
        }));
        return id;
      },

      update: (id, patch) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      close: (id, exit) =>
        set((s) => ({
          trades: s.trades.map((t) =>
            t.id === id ? { ...t, ...exit, status: "closed" as const } : t,
          ),
        })),

      remove: (id) =>
        set((s) => ({ trades: s.trades.filter((t) => t.id !== id) })),

      setSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      replaceAll: ({ trades, settings }) => set({ trades, settings }),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "thememap.notes.v1",
      storage: deviceStorage(),
      partialize: (s) => ({ trades: s.trades, settings: s.settings }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

/* ------------------------------------------------------------------ *
 * 계산 — 전부 사용자가 적은 숫자의 산수입니다.
 * ------------------------------------------------------------------ */

export type TradeMath = {
  /** 1R = 진입가와 손절가의 거리(주당 금액) */
  r: number | null;
  /** 이 매매에서 잃을 수 있는 최대 금액 */
  maxLoss: number | null;
  /** 그 금액이 계좌에서 차지하는 비중(%) */
  maxLossPct: number | null;
  /** 투입 금액 */
  cost: number | null;
  /** 목표가별 R 배수 */
  targetR: { price: number; portion: number; r: number }[];
  /** 비중을 감안한 기대 손익비 (R) — 목표를 다 채웠을 때 */
  blendedR: number | null;
  /** 목표 비중 합계 */
  portionSum: number;
  /** 청산했다면 실제 결과 */
  realized: { pnl: number; r: number } | null;
};

export function computeTrade(
  t: Pick<
    Trade,
    | "entryPrice"
    | "stopPrice"
    | "qty"
    | "side"
    | "targets"
    | "exitPrice"
    | "status"
  >,
  accountSize: number | null,
): TradeMath {
  const dir = t.side === "long" ? 1 : -1;
  const perShareRisk = (t.entryPrice - t.stopPrice) * dir;
  const r = perShareRisk > 0 ? perShareRisk : null;

  const maxLoss = r != null && t.qty > 0 ? r * t.qty : null;
  const maxLossPct =
    maxLoss != null && accountSize && accountSize > 0
      ? (maxLoss / accountSize) * 100
      : null;
  const cost = t.entryPrice > 0 && t.qty > 0 ? t.entryPrice * t.qty : null;

  const targetR = (t.targets ?? [])
    .filter((x) => x.price > 0)
    .map((x) => ({
      price: x.price,
      portion: x.portion,
      r: r ? ((x.price - t.entryPrice) * dir) / r : 0,
    }));

  const portionSum = targetR.reduce((a, b) => a + (b.portion || 0), 0);
  const blendedR =
    r && portionSum > 0
      ? targetR.reduce((a, b) => a + b.r * (b.portion / 100), 0)
      : null;

  let realized: TradeMath["realized"] = null;
  if (t.status === "closed" && typeof t.exitPrice === "number" && t.qty > 0) {
    const pnl = (t.exitPrice - t.entryPrice) * dir * t.qty;
    realized = { pnl, r: r ? pnl / (r * t.qty) : 0 };
  }

  return { r, maxLoss, maxLossPct, cost, targetR, blendedR, portionSum, realized };
}

/** 원칙 준수 카운터 — 닫은 매매 중 손절가를 지킨 비율 */
export function disciplineScore(trades: Trade[]): {
  kept: number;
  total: number;
} {
  const closed = trades.filter(
    (t) => t.status === "closed" && typeof t.followedStop === "boolean",
  );
  return {
    kept: closed.filter((t) => t.followedStop).length,
    total: closed.length,
  };
}

/** 매매 이유 태그별 성적 — "'남이 사서' 매매는 어땠나"를 본인 숫자로 */
export function reasonStats(
  trades: Trade[],
): { tag: string; total: number; win: number; sumR: number }[] {
  const map = new Map<string, { total: number; win: number; sumR: number }>();
  for (const t of trades) {
    if (t.status !== "closed" || typeof t.exitPrice !== "number") continue;
    const m = computeTrade(t, null);
    const rMult = m.realized?.r ?? 0;
    for (const tag of t.reasons.length ? t.reasons : ["(이유 없음)"]) {
      const cur = map.get(tag) ?? { total: 0, win: 0, sumR: 0 };
      cur.total += 1;
      if (rMult > 0) cur.win += 1;
      cur.sumR += rMult;
      map.set(tag, cur);
    }
  }
  return [...map.entries()]
    .map(([tag, v]) => ({ tag, ...v }))
    .sort((a, b) => b.total - a.total);
}
