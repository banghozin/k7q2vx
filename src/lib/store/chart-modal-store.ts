"use client";

import { create } from "zustand";

type State = {
  ticker: string | null;
  name: string | null;
  open: (ticker: string, name: string) => void;
  close: () => void;
};

export const useChartModal = create<State>((set) => ({
  ticker: null,
  name: null,
  open: (ticker, name) => set({ ticker: ticker.toUpperCase(), name }),
  close: () => set({ ticker: null, name: null }),
}));
