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
      <td>
        <button
          type="button"
          className="mono"
          onClick={() => open(ticker, name)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: ".9rem",
          }}
        >
          {ticker}
        </button>
      </td>
      <td style={{ color: "var(--ink-3)" }}>{name}</td>
      <td>
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
