import type { Layer } from "@/data/types";
import {
  getLayerHeatOne,
  getLeaderTicker,
  getStock,
  pct,
  tone,
} from "@/lib/market-data";
import { Specimen } from "./specimen";

/**
 * 지층. 위가 최종 서비스(최상층), 아래가 원재료·설계(1층)입니다.
 * 각 층은 #layer-5 같은 주소로 바로 뛰어올 수 있습니다.
 *
 * 층 머리에 붙는 온도는 소속 종목 등락률의 **중앙값**입니다. 평균이 아니라
 * 중앙값을 쓰는 이유는, 한 종목이 30% 튀었다고 층 전체가 뜨거워 보이면
 * 안 되기 때문입니다.
 */
export function Strata({
  layers,
  themeSlug,
}: {
  layers: Layer[];
  themeSlug: string;
}) {
  const leader = getLeaderTicker(themeSlug);

  return (
    <div className="strata">
      {layers.map((layer) => {
        const heat = getLayerHeatOne(themeSlug, layer.n);
        return (
          <section
            key={layer.key}
            id={`layer-${layer.n}`}
            className="stratum"
            aria-labelledby={`layer-${layer.n}-name`}
          >
            <div className="stratum__gutter">
              <div className="stratum__index mono" aria-hidden="true">
                {String(layer.n).padStart(2, "0")}
                <sub>F</sub>
              </div>
            </div>

            <div className="stratum__body">
              <header className="stratum__head">
                <h2 className="stratum__name" id={`layer-${layer.n}-name`}>
                  {layer.name}
                  <span className="stratum__count">
                    {layer.stocks.length}종목
                  </span>
                </h2>

                {heat && (
                  <div className="heatline mono">
                    <span className="heatline__item">
                      <span className="heatline__k">5일</span>
                      <b className={tone(heat.ret5)}>{pct(heat.ret5)}</b>
                    </span>
                    <span className="heatline__item">
                      <span className="heatline__k">20일</span>
                      <b className={tone(heat.ret20)}>{pct(heat.ret20)}</b>
                    </span>
                    <span className="heatline__item">
                      <span className="heatline__k">오른 종목</span>
                      <b>
                        {heat.up}/{heat.total}
                      </b>
                    </span>
                    {heat.rank20 != null && (
                      <span className="heatline__item">
                        <span className="heatline__k">테마 내</span>
                        <b>{heat.rank20}위</b>
                      </span>
                    )}
                  </div>
                )}

                <p className="stratum__role">{layer.role}</p>
                {layer.caution && (
                  <div className="caution">
                    <span className="caution__label">유의</span>
                    <span>{layer.caution}</span>
                  </div>
                )}
              </header>

              <div className="specimens">
                {layer.stocks.map((s) => (
                  <Specimen
                    key={s.ticker}
                    stock={s}
                    themeSlug={themeSlug}
                    metrics={getStock(s.ticker)}
                    isLeader={leader === s.ticker}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
