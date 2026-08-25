"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** 내가 산 자리 · 판 자리 표시 */
export type TradeMarker = {
  time: number; // unix seconds (해당 날짜 0시)
  kind: "entry" | "exit";
  text: string;
};

// 한국 증시 관행에 맞춰 상승은 빨강, 하락은 파랑입니다.
const UP = "#ff5445";
const DOWN = "#4a90ff";

export function CandleChart({
  candles,
  markers = [],
  height = 340,
}: {
  candles: Candle[];
  markers?: TradeMarker[];
  height?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!boxRef.current) return;

    const chart = createChart(boxRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#7d8590",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#1a1f27" },
        horzLines: { color: "#1a1f27" },
      },
      timeScale: { borderColor: "#232932", timeVisible: false },
      rightPriceScale: { borderColor: "#232932" },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;

    priceRef.current = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });

    volRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volRef.current.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      priceRef.current = null;
      volRef.current = null;
    };
  }, []);

  useEffect(() => {
    const price = priceRef.current;
    const vol = volRef.current;
    if (!price || !vol) return;

    price.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    vol.setData(
      candles.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color:
          c.close >= c.open ? "rgba(255,84,69,0.28)" : "rgba(74,144,255,0.28)",
      })),
    );

    if (markers.length) {
      try {
        createSeriesMarkers(
          price,
          [...markers]
            .sort((a, b) => a.time - b.time)
            .map((m) => ({
              time: m.time as Time,
              position:
                m.kind === "entry"
                  ? ("belowBar" as const)
                  : ("aboveBar" as const),
              color: m.kind === "entry" ? "#c8a15a" : "#7d8590",
              shape:
                m.kind === "entry"
                  ? ("arrowUp" as const)
                  : ("arrowDown" as const),
              text: m.text,
            })),
        );
      } catch {
        // 마커는 부가 기능입니다. 실패해도 차트는 그대로 보입니다.
      }
    }

    chartRef.current?.timeScale().fitContent();
  }, [candles, markers]);

  return <div ref={boxRef} style={{ height }} aria-label="일봉 차트" />;
}
