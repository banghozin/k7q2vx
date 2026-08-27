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
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
