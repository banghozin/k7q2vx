import Link from "next/link";
import type { LayerHeat } from "@/lib/market-data";
import { pct, tone } from "@/lib/market-data";

/**
 * 층 온도 지도.
 *
 * 층을 20일 성과 순으로 세워 놓습니다. "AI가 빠졌다"가 아니라
 * "AI 안에서 메모리에서 광통신으로 옮겨갔다"가 한 화면에 보이게 하는 것이
 * 목적입니다. 막대 길이는 20일 등락률의 절대값에 비례합니다.
 */
export function LayerHeatMap({
  themeSlug,
  layers,
}: {
  themeSlug: string;
  layers: LayerHeat[];
}) {
  const withData = layers.filter((l) => l.ret20 != null);
  if (withData.length === 0) return null;

  const ranked = [...withData].sort(
    (a, b) => (b.ret20 as number) - (a.ret20 as number),
  );
  const max = Math.max(...ranked.map((l) => Math.abs(l.ret20 as number)), 1);

  return (
    <div className="heatmap">
      {ranked.map((l) => {
        const v = l.ret20 as number;
        const width = `${(Math.abs(v) / max) * 100}%`;
        return (
          <Link
            key={l.key}
            href={`#layer-${l.n}`}
            className="heatrow"
            title={`${l.name} — 20일 중앙값 ${pct(v)}`}
          >
            <span className="heatrow__n mono">
              {String(l.n).padStart(2, "0")}F
            </span>
            <span className="heatrow__name">{l.name}</span>
            <span className="heatrow__bar" aria-hidden="true">
              <i
                className={`heatrow__fill ${v >= 0 ? "is-up" : "is-down"}`}
                style={{ width }}
              />
            </span>
            <span className={`heatrow__v mono ${tone(v)}`}>{pct(v)}</span>
            <span className="heatrow__up mono">
              {l.up}/{l.total}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
