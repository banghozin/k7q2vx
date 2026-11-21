"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { deviceStorage } from "./device-storage";

/**
 * 별표한 종목. 브라우저(localStorage)에만 저장됩니다. 서버로 가지 않습니다.
 */
export type WatchItem = {
  ticker: string;
  name: string;
  addedAt: string;
};

type State = {
  items: WatchItem[];
  hydrated: boolean;
};

type Actions = {
  toggle: (ticker: string, name: string) => void;
  remove: (ticker: string) => void;
  has: (ticker: string) => boolean;
  clear: () => void;
  setHydrated: () => void;
};

export const useWatchlist = create<State & Actions>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      toggle: (ticker, name) => {
        const t = ticker.toUpperCase();
        const exists = get().items.some((x) => x.ticker === t);
        if (exists) {
          set((s) => ({ items: s.items.filter((x) => x.ticker !== t) }));
        } else {
          set((s) => ({
            items: [
              { ticker: t, name, addedAt: new Date().toISOString() },
              ...s.items,
            ],
          }));
        }
      },
      remove: (ticker) =>
        set((s) => ({
          items: s.items.filter((x) => x.ticker !== ticker.toUpperCase()),
        })),
      has: (ticker) =>
        get().items.some((x) => x.ticker === ticker.toUpperCase()),
      clear: () => set({ items: [] }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "thememap.watchlist.v1",
      storage: deviceStorage(),
      partialize: (s) => ({ items: s.items }),
      /*
       * 저장돼 있던 것을 믿지 않습니다. 이 목록 하나가 상하면 별표를 그리는
       * 테마 화면·워치리스트·차트 분석이 **통째로 죽고**, 저장된 값이라
       * 새로고침해도 계속 죽어 있었습니다. 매매노트·알림과 같은 이유로 거릅니다.
       */
      merge: (persisted, current) => {
        const raw = (persisted as Partial<State> | undefined)?.items;
        const seen = new Set<string>();
        const items: WatchItem[] = [];
        for (const x of Array.isArray(raw) ? raw : []) {
          if (!x || typeof x !== "object" || typeof x.ticker !== "string") continue;
          const t = x.ticker.trim().toUpperCase();
          if (!/^[A-Z0-9.\-]{1,10}$/.test(t) || seen.has(t)) continue;
          seen.add(t);
          items.push({
            ticker: t,
            name: typeof x.name === "string" ? x.name.slice(0, 80) : t,
            addedAt: typeof x.addedAt === "string" ? x.addedAt : "",
          });
        }
        return { ...current, items };
      },
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
