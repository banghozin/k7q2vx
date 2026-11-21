"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { deviceStorage } from "./device-storage";

/**
 * 가격 알림 — 이 기기에만 저장됩니다.
 *
 * ⚠️ **화면을 열어 둔 동안만 확인합니다.** 이 사이트에는 서버도 회원가입도
 * 없어서, 창을 닫으면 대신 지켜봐 줄 것이 없습니다. 트레이딩뷰 알림처럼
 * 창을 닫아도 휴대폰으로 오게 하려면 서버가 있어야 합니다. 그 한계를 화면에
 * 그대로 적어 둡니다.
 *
 * 알림은 내가 정한 가격에 닿았다는 **사실**을 알려 줄 뿐입니다. 사고팔
 * 자리를 이 사이트가 정해 주는 것이 아닙니다.
 */

export type PriceAlert = {
  id: string;
  ticker: string;
  price: number;
  /** 그 가격 위로 올라서면(above) / 아래로 내려서면(below) */
  dir: "above" | "below";
  createdAt: string;
  /** 울린 시각. 울린 것은 다시 울리지 않습니다 */
  firedAt?: string;
  /** 울릴 때의 가격 */
  firedPrice?: number;
};

type State = { alerts: PriceAlert[]; hydrated: boolean };
type Actions = {
  add: (a: Omit<PriceAlert, "id" | "createdAt">) => void;
  remove: (id: string) => void;
  fire: (id: string, price: number) => void;
  clearFired: () => void;
  setHydrated: () => void;
};

/** 한꺼번에 지켜볼 수 있는 개수 — 1분마다 종목마다 한 번씩 묻기 때문입니다 */
export const MAX_ALERTS = 20;
const TICKER_RE = /^[A-Z0-9.\-]{1,10}$/;

function clean(v: unknown): PriceAlert[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((a): a is PriceAlert => {
      if (!a || typeof a !== "object") return false;
      const o = a as Partial<PriceAlert>;
      return (
        typeof o.id === "string" &&
        typeof o.ticker === "string" &&
        TICKER_RE.test(o.ticker) &&
        typeof o.price === "number" &&
        Number.isFinite(o.price) &&
        o.price > 0 &&
        (o.dir === "above" || o.dir === "below") &&
        typeof o.createdAt === "string"
      );
    })
    .slice(0, MAX_ALERTS * 2);
}

export const useAlerts = create<State & Actions>()(
  persist(
    (set) => ({
      alerts: [],
      hydrated: false,
      add: (a) =>
        set((s) => {
          const active = s.alerts.filter((x) => !x.firedAt);
          if (active.length >= MAX_ALERTS) return s;
          return {
            alerts: [
              {
                ...a,
                id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
                createdAt: new Date().toISOString(),
              },
              ...s.alerts,
            ],
          };
        }),
      remove: (id) => set((s) => ({ alerts: s.alerts.filter((x) => x.id !== id) })),
      fire: (id, price) =>
        set((s) => ({
          alerts: s.alerts.map((x) =>
            x.id === id ? { ...x, firedAt: new Date().toISOString(), firedPrice: price } : x,
          ),
        })),
      clearFired: () => set((s) => ({ alerts: s.alerts.filter((x) => !x.firedAt) })),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "thememap.alerts.v1",
      storage: deviceStorage(),
      partialize: (s) => ({ alerts: s.alerts }) as State & Actions,
      merge: (persisted, current) => ({
        ...current,
        alerts: clean((persisted as Partial<State> | undefined)?.alerts),
      }),
      onRehydrateStorage: () => (s) => s?.setHydrated(),
    },
  ),
);
