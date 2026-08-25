"use client";

import Link from "next/link";
import type { Placement } from "@/data/types";
import { useChartModal } from "@/lib/store/chart-modal-store";

export function CrossTicker({
  ticker,
  places,
}: {
  ticker: string;
  places: Placement[];
}) {
  const open = useChartModal((s) => s.open);
  const name = places[0]?.stock.name ?? ticker;

  return (
    <tr>
      <td data-label="티커">
        <button
          type="button"
          className="linkish mono"
          onClick={() => open(ticker, name)}
          style={{ fontSize: ".95rem" }}
        >
          {ticker}
        </button>
        <span className="synctable__name">{name}</span>
      </td>
      <td data-label="회사" style={{ color: "var(--ink-3)" }}>
        {name}
      </td>
      <td data-label="걸쳐 있는 층" className="cell-wide">
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".3rem" }}>
          {places.map((p) => (
            <Link
              key={`${p.themeSlug}-${p.layerN}`}
              href={`/theme/${p.themeSlug}#layer-${p.layerN}`}
              className="tag"
              title={p.layerName}
            >
              {p.themeName} {p.layerN}F
            </Link>
          ))}
        </div>
      </td>
    </tr>
  );
}
