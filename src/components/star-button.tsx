"use client";

import { useWatchlist } from "@/lib/store/watchlist-store";

export function StarButton({
  ticker,
  name,
}: {
  ticker: string;
  name: string;
}) {
  const items = useWatchlist((s) => s.items);
  const toggle = useWatchlist((s) => s.toggle);
  const hydrated = useWatchlist((s) => s.hydrated);
  const on = hydrated && items.some((x) => x.ticker === ticker.toUpperCase());

  return (
    <button
      type="button"
      className="star"
      data-on={on}
      aria-pressed={on}
      aria-label={`${ticker} ${on ? "워치리스트에서 빼기" : "워치리스트에 넣기"}`}
      title={on ? "워치리스트에서 빼기" : "워치리스트에 넣기"}
      onClick={(e) => {
        e.stopPropagation();
        toggle(ticker, name);
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3.2l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.6l6.1-.8z"
          fill={on ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
