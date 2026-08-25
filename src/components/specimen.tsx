"use client";

import Link from "next/link";
import type { Stock } from "@/data/types";
import { crossTagsOf } from "@/data/themes";
import { useChartModal } from "@/lib/store/chart-modal-store";
import { StarButton } from "./star-button";

/**
 * 종목 카드.
 *
 * 태그는 손으로 붙이지 않습니다. 테마 파일 전체를 훑어 만든 역방향 색인에서
 * "이 티커가 또 어느 테마 몇 층에 올라 있는지"를 자동으로 가져옵니다.
 *
 * 카드 전체를 눌러도 차트가 열리지만, 키보드로는 티커 버튼에 초점이 갑니다.
 * 카드를 통째로 버튼으로 만들면 안쪽의 별표·태그 링크가 버튼 안에 갇혀
 * 접근성이 오히려 나빠집니다.
 */
export function Specimen({
  stock,
  themeSlug,
}: {
  stock: Stock;
  themeSlug: string;
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
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {stock.ticker}
          <span
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
              whiteSpace: "nowrap",
            }}
          >
            {" "}
            {stock.name} 차트 열기
          </span>
        </button>
        <span className="specimen__name">{stock.name}</span>
      </div>

      <p className="specimen__why">{stock.why}</p>

      <div className="specimen__tags">
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
