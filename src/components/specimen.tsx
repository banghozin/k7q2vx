"use client";

import Link from "next/link";
import type { Stock } from "@/data/types";
import { crossTagsOf } from "@/data/themes";
import type { StockMetrics } from "@/lib/market-data";
import { pct, tone } from "@/lib/format";
import { useChartModal } from "@/lib/store/chart-modal-store";
import { StarButton } from "./star-button";

/**
 * 종목 카드.
 *
 * 태그는 손으로 붙이지 않습니다. 테마 파일 전체를 훑어 만든 역방향 색인에서
 * "이 티커가 또 어느 테마 몇 층에 올라 있는지"를 자동으로 가져옵니다.
 *
 * 시세 지표는 서버에서 계산해 props 로 내려받습니다. 여기서 직접 JSON 을
 * 가져오면 28KB 짜리 데이터가 브라우저로 통째로 실려 갑니다.
 *
 * 카드 전체를 눌러도 차트가 열리지만, 키보드로는 티커 버튼에 초점이 갑니다.
 * 카드를 통째로 버튼으로 만들면 안쪽의 별표·태그 링크가 버튼 안에 갇혀
 * 접근성이 오히려 나빠집니다.
 */
export function Specimen({
  stock,
  themeSlug,
  metrics,
  isLeader = false,
}: {
  stock: Stock;
  themeSlug: string;
  metrics?: StockMetrics | null;
  isLeader?: boolean;
}) {
  const open = useChartModal((s) => s.open);
  const cross = crossTagsOf(stock.ticker, themeSlug);

  return (
    <div
      className={`specimen${stock.anchor ? " is-anchor" : ""}`}
      onClick={() => open(stock.ticker, stock.name)}
    >
      <StarButton ticker={stock.ticker} name={stock.name} />

      <div className="specimen__top">
        <button
          type="button"
          className="specimen__ticker mono"
          translate="no"
          onClick={(e) => {
            e.stopPropagation();
            open(stock.ticker, stock.name);
          }}
        >
          {stock.ticker}
          <span className="sr-only"> {stock.name} 차트 열기</span>
        </button>
        <span className="specimen__name">{stock.name}</span>
      </div>

      {metrics && (
        <div className="specimen__quote">
          <span className="mono specimen__price">
            {metrics.last != null ? `$${metrics.last.toFixed(2)}` : "—"}
          </span>
          <span className={`mono ${tone(metrics.ret1)}`}>
            {pct(metrics.ret1)}
          </span>
        </div>
      )}

      <p className="specimen__why">{stock.why}</p>

      {metrics && (
        <dl className="specimen__metrics mono">
          <div>
            <dt>5일</dt>
            <dd className={tone(metrics.ret5)}>{pct(metrics.ret5)}</dd>
          </div>
          <div>
            <dt>20일</dt>
            <dd className={tone(metrics.ret20)}>{pct(metrics.ret20)}</dd>
          </div>
          <div className="specimen__metrics--wide">
            <dt>지수 대비</dt>
            <dd className={tone(metrics.rs20)}>{pct(metrics.rs20)}</dd>
          </div>
        </dl>
      )}

      <div className="specimen__tags">
        {isLeader && (
          <span
            className="tag tag--leader"
            title="계산으로 뽑은 대장주입니다. 시가총액 1위라는 뜻도, 매수 추천도 아닙니다."
          >
            대장
          </span>
        )}
        {stock.anchor && (
          <span className="tag tag--anchor" title="이 층을 설명할 때 기준이 되는 종목">
            축
          </span>
        )}
        {cross.map((p) => (
          <Link
            key={`${p.themeSlug}-${p.layerN}`}
            href={`/theme/${p.themeSlug}#layer-${p.layerN}`}
            className="tag"
            onClick={(e) => e.stopPropagation()}
            title={`${p.themeName} ${p.layerN}층 · ${p.layerName}`}
          >
            {p.themeName} {p.layerN}F
          </Link>
        ))}
      </div>
    </div>
  );
}
