"use client";

import Link from "next/link";
import { useWatchlist } from "@/lib/store/watchlist-store";
import { placementsOf } from "@/data/themes";
import { useChartModal } from "@/lib/store/chart-modal-store";

export function WatchlistView() {
  const items = useWatchlist((s) => s.items);
  const hydrated = useWatchlist((s) => s.hydrated);
  const remove = useWatchlist((s) => s.remove);
  const open = useChartModal((s) => s.open);

  if (!hydrated) return <div className="empty">불러오는 중…</div>;

  if (items.length === 0) {
    return (
      <div className="empty">
        아직 별표한 종목이 없습니다. 테마 화면에서 종목 카드 오른쪽 위 별을
        누르면 여기에 쌓입니다.
      </div>
    );
  }

  // 어느 층에 몰려 있는지 세어 봅니다 — 분산한 줄 알았는데 한 층이었던 경우를 잡습니다.
  const byLayer = new Map<string, number>();
  for (const it of items) {
    for (const p of placementsOf(it.ticker)) {
      const key = `${p.themeName} ${p.layerN}층 · ${p.layerName}`;
      byLayer.set(key, (byLayer.get(key) ?? 0) + 1);
    }
  }
  const crowded = [...byLayer.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <>
      {crowded.length > 0 && (
        <div className="caution" style={{ marginBottom: "1.5rem" }}>
          <span className="caution__label">쏠림</span>
          <span>
            별표한 종목이 같은 층에 몰려 있습니다 —{" "}
            {crowded.map(([k, n], i) => (
              <span key={k}>
                {i > 0 && ", "}
                <strong>{k}</strong> {n}종목
              </span>
            ))}
            . 여러 종목을 담았어도 같은 층이면 같은 소식에 함께 움직입니다.
          </span>
        </div>
      )}

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: "6rem" }}>티커</th>
              <th style={{ width: "11rem" }}>회사</th>
              <th>올라 있는 층</th>
              <th style={{ width: "4rem" }} />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const places = placementsOf(it.ticker);
              return (
                <tr key={it.ticker}>
                  <td>
                    <button
                      type="button"
                      className="mono"
                      onClick={() => open(it.ticker, it.name)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: ".9rem",
                      }}
                    >
                      {it.ticker}
                    </button>
                  </td>
                  <td style={{ color: "var(--ink-3)" }}>{it.name}</td>
                  <td>
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: ".3rem" }}
                    >
                      {places.length === 0 ? (
                        <span style={{ color: "var(--ink-4)", fontSize: ".8rem" }}>
                          배치된 층 없음
                        </span>
                      ) : (
                        places.map((p) => (
                          <Link
                            key={`${p.themeSlug}-${p.layerN}`}
                            href={`/theme/${p.themeSlug}#layer-${p.layerN}`}
                            className="tag"
                            title={p.layerName}
                          >
                            {p.themeName} {p.layerN}F
                          </Link>
                        ))
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: ".2rem .5rem", fontSize: ".75rem" }}
                      onClick={() => remove(it.ticker)}
                    >
                      빼기
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
