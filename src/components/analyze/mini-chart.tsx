"use client";

import { useEffect, useRef, useState } from "react";
import type { KLineData, Period } from "klinecharts";
import { Kline, type KlineHandle } from "@/components/practice/kline";
import { nameOf } from "@/data/themes";
import { sheetKey, useAnalysis } from "@/lib/store/analysis-store";

/**
 * 화면을 나눴을 때 옆 칸에 뜨는 차트.
 *
 * 봉 단위·지표·눈금은 **본 차트를 따라갑니다**(트레이딩뷰의 "동기화" 를 켠
 * 상태와 같습니다). 종목만 칸마다 따로 고릅니다.
 *
 * 여기서는 **그리지 않습니다.** 그 종목에 그려 둔 것은 보여 주되 잠가 둡니다 —
 * 그리고 고치는 일은 본 차트에서 합니다. "본 차트로" 를 누르면 이 칸의
 * 종목이 본 차트로 올라갑니다.
 */

type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };

function group(bars: Bar[], n: number): Bar[] {
  if (n <= 1) return bars;
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i += n) {
    const g = bars.slice(i, i + n);
    out.push({
      time: g[0].time,
      open: g[0].open,
      high: Math.max(...g.map((b) => b.high)),
      low: Math.min(...g.map((b) => b.low)),
      close: g[g.length - 1].close,
      volume: g.reduce((s, b) => s + b.volume, 0),
    });
  }
  return out;
}

export function MiniChart({
  ticker,
  interval,
  range,
  groupBy,
  period,
  prepost,
  indicators,
  yScale,
  onTicker,
  onPromote,
}: {
  ticker: string;
  interval: string;
  range: string;
  groupBy: number;
  period: Period;
  prepost: boolean;
  indicators: { name: string; onCandle: boolean; params?: number[] }[];
  yScale: "normal" | "logarithm" | "percentage";
  onTicker: (t: string) => void;
  onPromote: () => void;
}) {
  const chart = useRef<KlineHandle>(null);
  const [ready, setReady] = useState(false);
  const [feed, setFeed] = useState<KLineData[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [input, setInput] = useState(ticker);
  const sheets = useAnalysis((s) => s.sheets);

  useEffect(() => setInput(ticker), [ticker]);

  useEffect(() => {
    let alive = true;
    setErr(null);
    fetch(
      `/api/chart?ticker=${encodeURIComponent(ticker)}&interval=${interval}&range=${range}${prepost ? "&prepost=1" : ""}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("시세를 받지 못했습니다"))))
      .then((j: { candles?: Bar[] }) => {
        if (!alive) return;
        const bars = group(j.candles ?? [], groupBy);
        if (bars.length === 0) throw new Error("자료가 없습니다");
        setFeed(
          bars.map((b) => ({
            timestamp: b.time * 1000,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
          })),
        );
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [ticker, interval, range, groupBy, prepost]);

  useEffect(() => {
    if (!ready || feed.length === 0) return;
    const c = chart.current;
    if (!c) return;
    c.setData(feed, period);
    const w = c.width();
    if (w > 0) c.fitAll(Math.max(60, Math.round(w / 6)));
    // 그 종목에 그려 둔 것을 잠가서 보여 줍니다
    const saved = sheets[sheetKey(ticker)]?.drawings ?? [];
    c.restoreDrawings(saved.map((d) => ({ ...d, locked: true })));
    // 봉을 갈아끼우면 지표 판도 사라지므로 다시 맞춥니다
    c.setIndicators(indicators);
    // sheets 는 본 차트가 저장할 때마다 바뀌므로 넣지 않습니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, feed, period, ticker]);

  useEffect(() => {
    if (ready && feed.length > 0) chart.current?.setIndicators(indicators);
  }, [ready, feed, indicators]);

  useEffect(() => {
    if (ready) chart.current?.setYScale(yScale);
  }, [ready, yScale]);

  const last = feed.at(-1)?.close;
  const prev = feed.at(-2)?.close;
  const chg = last && prev ? ((last - prev) / prev) * 100 : null;

  return (
    <div className="mini">
      <div className="mini__bar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = input.trim().toUpperCase();
            if (/^[A-Z0-9.\-]{1,10}$/.test(t)) onTicker(t);
          }}
        >
          <input
            className="mini__input mono"
            value={input}
            aria-label="이 칸의 종목"
            onChange={(e) => setInput(e.target.value)}
          />
        </form>
        <span className="mini__name">{nameOf(ticker) ?? ""}</span>
        {last != null && <span className="mono mini__px">{last.toFixed(2)}</span>}
        {chg != null && (
          <span className={`mono ${chg >= 0 ? "up" : "down"}`}>
            {chg >= 0 ? "+" : ""}
            {chg.toFixed(2)}%
          </span>
        )}
        <button type="button" className="mini__promote" onClick={onPromote} title="이 종목을 본 차트로 올립니다">
          본 차트로
        </button>
      </div>
      <div className="mini__chart">
        {err && <div className="prac__overlay">{err}</div>}
        <Kline ref={chart} onReady={() => setReady(true)} />
      </div>
    </div>
  );
}
