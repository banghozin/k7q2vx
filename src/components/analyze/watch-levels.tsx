"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { nameOf } from "@/data/themes";
import { recentSheets, useAnalysis } from "@/lib/store/analysis-store";
import {
  RECENT,
  type Candle,
  type WatchLevel,
  checkLevels,
  levelsOf,
  sortLevels,
} from "@/lib/levels";

/**
 * 그어 둔 자리가 닿았는지 되짚어 보여줍니다.
 *
 * 차트에 수평선을 그어 두는 것은 "여기 오면 다시 보겠다" 는 뜻인데, 지금까지는
 * **다시 들어와서 눈으로 확인해야만** 알 수 있었습니다. 종목이 열이면 열 번
 * 열어 봐야 합니다. 여기서는 그어 둔 종목들의 일봉을 한 번에 받아 **고가·저가
 * 사이를 지나갔는지** 세어 둡니다.
 *
 * 켜고 끄는 스위치를 두지 않았습니다
 * ------------------------------------
 * 수평선은 애초에 지지·저항 자리를 표시하려고 긋는 것이라 그것 자체가 이미
 * 의사 표시입니다. 추세선·파동까지 넣으면 걸어 둔 적 없는 알림이 쏟아지므로
 * **수평선만** 봅니다. 자세한 이유는 `src/lib/levels.ts` 머리말에 있습니다.
 *
 * 실시간이 아닙니다. 하루 1회 갱신이 이 사이트의 의도된 성격이고, 여기도
 * 마찬가지로 **지나간 일봉과 견준 사실**입니다. 앞날에 대한 말이 아닙니다.
 */

/**
 * 한 번에 훑을 종목 수.
 *
 * 종목마다 서버를 한 번씩 부릅니다(서버 쪽에 15분 캐시가 걸려 있어 두 번째
 * 부터는 야후까지 가지 않습니다). 그래도 저장된 벌이 백 개가 넘을 수 있으므로
 * **최근에 손댄 것부터** 잘라 씁니다.
 */
const MAX_TICKERS = 12;

/** 동시에 몇 개까지 — 한꺼번에 열둘을 부르면 야후 쪽이 429 를 돌려줍니다 */
const CONCURRENCY = 3;

/** 화면을 다시 그려도 다시 받지 않게 — 새로고침 전까지 남습니다 */
const cache = new Map<string, Candle[] | null>();

async function loadCandles(ticker: string, signal: AbortSignal) {
  if (cache.has(ticker)) return;
  try {
    const r = await fetch(
      `/api/chart?ticker=${encodeURIComponent(ticker)}&interval=1d&range=3mo`,
      { signal },
    );
    if (!r.ok) {
      cache.set(ticker, null);
      return;
    }
    const j = (await r.json()) as { candles?: Candle[] };
    cache.set(ticker, Array.isArray(j.candles) ? j.candles : null);
  } catch {
    // 중단(AbortError)은 기록하지 않습니다 — 다음에 다시 받아야 하니까요
    if (!signal.aborted) cache.set(ticker, null);
  }
}

export function WatchLevels({ onPick }: { onPick: (ticker: string) => void }) {
  const sheets = useAnalysis((s) => s.sheets);
  const hydrated = useAnalysis((s) => s.hydrated);

  /** 그어 둔 자리가 있는 종목만, 최근에 손댄 것부터 */
  const targets = useMemo(() => {
    if (!hydrated) return [] as { ticker: string; values: number[] }[];
    return recentSheets(sheets)
      .map((s) => ({ ticker: s.ticker, values: levelsOf(s.drawings) }))
      .filter((t) => t.values.length > 0)
      .slice(0, MAX_TICKERS);
  }, [sheets, hydrated]);

  const tickerKey = targets.map((t) => t.ticker).join(",");
  const [tick, setTick] = useState(0); // 다 받으면 한 번 다시 그립니다
  const [busy, setBusy] = useState(false);
  const seen = useRef("");

  useEffect(() => {
    if (!tickerKey || seen.current === tickerKey) return;
    seen.current = tickerKey;

    const tickers = tickerKey.split(",");
    if (tickers.every((t) => cache.has(t))) {
      setTick((n) => n + 1);
      return;
    }

    const ac = new AbortController();
    let alive = true;
    setBusy(true);

    (async () => {
      const queue = [...tickers];
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, queue.length) },
        async () => {
          for (let t = queue.shift(); t; t = queue.shift()) {
            await loadCandles(t, ac.signal);
            if (!alive) return;
            setTick((n) => n + 1);
          }
        },
      );
      await Promise.all(workers);
      if (alive) setBusy(false);
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [tickerKey]);

  const rows = useMemo(() => {
    void tick; // 새로 받은 것이 있으면 다시 셉니다
    const out: WatchLevel[] = [];
    for (const t of targets) {
      const candles = cache.get(t.ticker);
      if (!candles?.length) continue;
      out.push(...checkLevels(t.ticker, t.values, candles));
    }
    return sortLevels(out);
  }, [targets, tick]);

  /*
   * 시세를 못 받은 종목은 조용히 빼지 않고 밝힙니다. 상장폐지·티커 변경이
   * 실제로 일어나는데(2026-08-25 에 다섯 개), 그냥 사라지면 "내가 지웠나?"
   * 하게 됩니다.
   */
  const failed = useMemo(() => {
    void tick;
    return targets
      .filter((t) => cache.get(t.ticker) === null)
      .map((t) => t.ticker);
  }, [targets, tick]);

  if (!hydrated || targets.length === 0) return null;

  const hits = rows.filter((r) => r.barsAgo != null && r.barsAgo < RECENT);

  return (
    <section>
      <h2>그어 둔 자리 {rows.length > 0 ? `${rows.length}개` : ""}</h2>

      {hits.length > 0 && (
        <p className="lvl__lead">
          최근 {RECENT}거래일 안에 <b className="lvl__n">{hits.length}개</b>가
          닿았습니다.
        </p>
      )}

      {rows.length === 0 && busy && (
        <p className="prac__penhint">시세를 받는 중입니다…</p>
      )}
      {failed.length > 0 && (
        <p className="prac__penhint">
          <span className="mono">{failed.join(" · ")}</span> 는 시세를 받지
          못했습니다. 티커가 바뀌었거나 상장폐지됐을 수 있습니다.
        </p>
      )}

      <ul className="lvl">
        {rows.map((r) => {
          const hit = r.barsAgo != null && r.barsAgo < RECENT;
          return (
            <li key={`${r.ticker}-${r.value}`} className={hit ? "is-hit" : ""}>
              <button
                type="button"
                onClick={() => onPick(r.ticker)}
                title={`${r.ticker} 차트로 이동`}
              >
                <span className="lvl__who">
                  <span className="mono">{r.ticker}</span>
                  {/* 이름이 티커와 같은 회사(AMD 등)는 두 번 적지 않습니다 */}
                  <span className="lvl__kr">
                    {nameOf(r.ticker) === r.ticker ? "" : (nameOf(r.ticker) ?? "")}
                  </span>
                </span>
                <span className="lvl__v mono">
                  {r.value.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className={`lvl__s mono${hit ? " is-hit" : ""}`}>
                  {r.touchedAt == null
                    ? /*
                       * 안 닿은 것은 "얼마나 떨어져 있는지" 로 적습니다.
                       * 위·아래를 글자로 밝혀 색만으로 알리지 않습니다.
                       */
                      `${r.awayPct >= 0 ? "위로" : "아래로"} ${Math.abs(r.awayPct).toFixed(1)}%`
                    : r.barsAgo === 0
                      ? "마지막 거래일에 닿음"
                      : `${r.barsAgo}거래일 전 닿음`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="prac__penhint">
        <strong>수평선</strong>을 그어 두면 여기 자동으로 올라옵니다. 그날
        일봉의 고가·저가 사이를 지나갔으면 닿은 것으로 셉니다.{" "}
        <strong>지나간 기록이며 앞날에 대한 말이 아닙니다.</strong>
      </p>
    </section>
  );
}
