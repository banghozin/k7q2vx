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

/* ── 들어오는 기록을 믿지 않기 ─────────────────────────────────────
 *
 * 가져오기는 `trades` 가 배열인지만 보고 통째로 저장했습니다. 그런데 그
 * 안에 무엇이 들었는지는 아무도 확인하지 않았습니다. 실제로 재어 보니
 * **여섯 가지 중 셋이 화면을 죽였습니다** — null 이 섞인 것, 값이 숫자가
 * 아니라 글자인 것, 수량이 음수인 것.
 *
 * 죽는 것으로 끝이 아닙니다. 그 값이 **저장까지 되기 때문에** 새로고침해도
 * 계속 죽어 있습니다. 비개발자에게는 빠져나올 길이 없고, 그 사이 원래
 * 매매 기록은 이미 덮어써져 사라진 뒤입니다. 백업을 되살리려다 백업을
 * 잃는 셈입니다.
 *
 * 그래서 한 건씩 봅니다. 성한 것만 들이고 나머지는 버리되, **몇 건을
 * 버렸는지 돌려줘서** 화면이 사람에게 말할 수 있게 합니다. 조용히 버리면
 * "가져왔는데 절반이 없다" 가 되고 그게 더 나쁩니다.
 */

const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === "string";

function cleanTargets(v: unknown): Target[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (t): t is Target =>
      !!t && typeof t === "object" && num((t as Target).price) && num((t as Target).portion),
  );
}

function cleanChart(v: unknown): TradeChart | undefined {
  if (!v || typeof v !== "object") return undefined;
  const c = v as TradeChart;
  if (!str(c.tf) || !str(c.at) || !Array.isArray(c.drawings)) return undefined;
  return { tf: c.tf, drawings: c.drawings, at: c.at };
}

/** 한 건이 쓸 만한가. 아니면 null */
function cleanTrade(v: unknown): Trade | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const t = v as Record<string, unknown>;

  // 없으면 계산이 성립하지 않는 것들. 가격과 수량은 0 이나 음수면 안 됩니다
  if (!str(t.ticker) || !t.ticker.trim()) return null;
  if (!num(t.entryPrice) || t.entryPrice <= 0) return null;
  if (!num(t.qty) || t.qty <= 0) return null;
  if (!num(t.stopPrice) || t.stopPrice <= 0) return null;
  if (!str(t.entryDate) || !/^\d{4}-\d{2}-\d{2}$/.test(t.entryDate)) return null;

  const closed = t.status === "closed";
  return {
    id: str(t.id) && t.id ? t.id : newId(),
    ticker: t.ticker.trim().toUpperCase().slice(0, 12),
    name: str(t.name) ? t.name.slice(0, 80) : "",
    side: t.side === "short" ? "short" : "long",
    status: closed ? "closed" : "open",
    entryPrice: t.entryPrice,
    entryDate: t.entryDate,
    qty: t.qty,
    stopPrice: t.stopPrice,
    targets: cleanTargets(t.targets),
    reasons: Array.isArray(t.reasons)
      ? (t.reasons.filter(
          (r) => typeof r === "string" && (REASON_TAGS as readonly string[]).includes(r),
        ) as ReasonTag[])
      : [],
    memo: str(t.memo) ? t.memo.slice(0, 4000) : "",
    // 청산 값은 종료된 건에만 답니다 — 진행 중인데 청산가가 붙어 있으면 계산이 어긋납니다
    exitPrice: closed && num(t.exitPrice) && t.exitPrice > 0 ? t.exitPrice : undefined,
    exitDate:
      closed && str(t.exitDate) && /^\d{4}-\d{2}-\d{2}$/.test(t.exitDate)
        ? t.exitDate
        : undefined,
    followedStop: typeof t.followedStop === "boolean" ? t.followedStop : undefined,
    review: closed && str(t.review) ? t.review.slice(0, 4000) : undefined,
    chart: cleanChart(t.chart),
    createdAt: str(t.createdAt) ? t.createdAt : new Date().toISOString(),
  };
}

export function cleanTrades(v: unknown): { trades: Trade[]; dropped: number } {
  if (!Array.isArray(v)) return { trades: [], dropped: 0 };
  const trades: Trade[] = [];
  let dropped = 0;
  const seen = new Set<string>();
  for (const raw of v) {
    const t = cleanTrade(raw);
    if (!t) {
      dropped++;
      continue;
    }
    // 같은 id 가 두 번 들어오면 리액트 목록이 어긋납니다
    if (seen.has(t.id)) t.id = newId();
    seen.add(t.id);
    trades.push(t);
  }
  return { trades, dropped };
}

export function cleanSettings(v: unknown): Settings {
  const s = (v ?? {}) as Record<string, unknown>;
  return {
    accountSize: num(s.accountSize) && s.accountSize > 0 ? s.accountSize : null,
    principles: Array.isArray(s.principles)
      ? s.principles.filter(str).map((p) => p.slice(0, 300)).slice(0, 50)
      : [],
  };
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

      // 어느 길로 들어오든 여기서 한 번 더 거릅니다
      replaceAll: ({ trades, settings }) =>
        set({
          trades: cleanTrades(trades).trades,
          settings: cleanSettings(settings),
        }),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "thememap.notes.v1",
      storage: deviceStorage(),
      partialize: (s) => ({ trades: s.trades, settings: s.settings }),
      /*
       * 저장돼 있던 것도 믿지 않습니다.
       *
       * 예전에 상한 값을 가져오기로 들여 놓은 브라우저가 있다면, 고친 코드를
       * 배포해도 그 브라우저는 계속 죽습니다 — 저장된 값을 그대로 다시
       * 읽으니까요. 여기서 한 번 거르면 다음 방문에 스스로 낫습니다.
       */
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          trades: cleanTrades(p.trades).trades,
          settings: cleanSettings(p.settings),
        };
      },
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
  /**
   * 적어 넣은 목표들의 **비중 가중 평균** 손익비(R).
   *
   * 비중 합계로 나눕니다. 처음에는 그냥 100 으로 나눴는데, 그러면 목표를
   * 하나만 적고 비중을 40% 로 둔 사람에게 **2R 짜리 목표가 0.8R 로**
   * 나왔습니다. 나머지 60% 를 0원에 판다고 친 셈입니다. 게다가 그 값이
   * "1R 미만" 경고를 깨워서 "벌 것보다 잃을 게 크다" 는 **틀린 말**을
   * 띄웠습니다.
   *
   * 비중 합계가 100% 면 결과가 예전과 똑같습니다.
   */
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
  // 100 이 아니라 실제 비중 합계로 나눕니다 — 위 설명 참고
  const blendedR =
    r && portionSum > 0
      ? targetR.reduce((a, b) => a + b.r * b.portion, 0) / portionSum
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
