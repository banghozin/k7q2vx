import type { Layer } from "@/data/types";
import { Specimen } from "./specimen";

/**
 * 지층. 위가 최종 서비스(최상층), 아래가 원재료·설계(1층)입니다.
 * 각 층은 #layer-5 같은 주소로 바로 뛰어올 수 있습니다.
 */
export function Strata({
  layers,
  themeSlug,
}: {
  layers: Layer[];
  themeSlug: string;
}) {
  return (
    <div className="strata">
      {layers.map((layer) => (
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
                <span className="stratum__count mono">
                  {layer.stocks.length}종목
                </span>
              </h2>
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
                <Specimen key={s.ticker} stock={s} themeSlug={themeSlug} />
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
