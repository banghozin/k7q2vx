"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KLineData, Period } from "klinecharts";
import { allTickers, nameOf } from "@/data/themes";
import {
  Kline,
  type KlineHandle,
  type Pen,
  type SavedDrawing,
} from "@/components/practice/kline";
import { recentSheets, useAnalysis } from "@/lib/store/analysis-store";
import { useNotes } from "@/lib/store/notes-store";
import {
  SENSITIVITY,
  detectSwings,
  lastLeg,
  suggestThreshold,
} from "@/lib/swings";

/**
 * 차트 분석.
 *
 * 훈련 화면(`/practice`)이 **과거를 가리고 맞춰 보는 곳**이라면 여기는
 * **지금 보고 있는 종목에 실제로 선을 긋는 곳**입니다. 종목을 고르고, 봉
 * 단위를 고르고, 추세선·피보나치·파동을 그어 둡니다.
 *
 * **그린 것은 이 기기에 남습니다.** 다음에 같은 종목·같은 봉 단위로 들어오면
 * 그대로 다시 나타납니다. 좌표를 화면 위치가 아니라 시각·가격으로 적어 두기
 * 때문에 확대·축소를 해도 자리가 어긋나지 않습니다.
 *
 * 여기 그린 것은 **내 생각을 적어 둔 것**이지 이 사이트의 의견이 아닙니다.
 */

type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const TIMEFRAMES: {
  key: string;
  label: string;
  interval: string;
  range: string;
  group: number;
  period: Period;
}[] = [
  { key: "5m", label: "5분", interval: "5m", range: "60d", group: 1, period: { type: "minute", span: 5 } },
  { key: "15m", label: "15분", interval: "15m", range: "60d", group: 1, period: { type: "minute", span: 15 } },
  { key: "30m", label: "30분", interval: "30m", range: "60d", group: 1, period: { type: "minute", span: 30 } },
  { key: "60m", label: "1시간", interval: "60m", range: "730d", group: 1, period: { type: "hour", span: 1 } },
  { key: "4h", label: "4시간", interval: "60m", range: "730d", group: 4, period: { type: "hour", span: 4 } },
  { key: "1d", label: "일봉", interval: "1d", range: "10y", group: 1, period: { type: "day", span: 1 } },
  { key: "1wk", label: "주봉", interval: "1wk", range: "10y", group: 1, period: { type: "week", span: 1 } },
  { key: "1mo", label: "월봉", interval: "1mo", range: "40y", group: 1, period: { type: "month", span: 1 } },
];

const DRAW_GROUPS: {
  title: string;
  tools: { key: string; label: string; hint: string }[];
}[] = [
  {
    title: "파동",
    tools: [
      { key: "elliottImpulse", label: "12345 파동", hint: "출발점부터 여섯 점" },
      { key: "elliottCorrection", label: "ABC 조정", hint: "출발점부터 네 점. Z 자" },
      { key: "elliottTriangle", label: "abcde 삼각형", hint: "출발점부터 여섯 점" },
      { key: "fibRetracement", label: "피보나치", hint: "고점과 저점 두 점" },
    ],
  },
  {
    title: "선",
    tools: [
      { key: "segment", label: "추세선", hint: "찍은 두 점 사이만" },
      { key: "straightLine", label: "연장선", hint: "양쪽으로 끝없이" },
      { key: "rayLine", label: "반직선", hint: "한쪽으로만" },
      { key: "horizontalStraightLine", label: "수평선", hint: "지지·저항 자리" },
      { key: "priceChannelLine", label: "채널", hint: "세 점으로 평행 채널" },
      { key: "parallelStraightLine", label: "평행선", hint: "세 점으로 평행선" },
      { key: "freeCurve", label: "자유곡선", hint: "누른 채로 끌면 그려집니다" },
      { key: "simpleAnnotation", label: "메모", hint: "글자를 적습니다" },
    ],
  },
];

const TOOL_NAME: Record<string, string> = Object.fromEntries(
  DRAW_GROUPS.flatMap((g) => g.tools.map((t) => [t.key, t.label])),
);

const INDICATORS = [
  { key: "MA", label: "이동평균", onCandle: true },
  { key: "BOLL", label: "볼린저", onCandle: true },
  { key: "VOL", label: "거래량", onCandle: false },
  { key: "MACD", label: "MACD", onCandle: false },
  { key: "RSI", label: "RSI", onCandle: false },
  { key: "KDJ", label: "스토캐스틱", onCandle: false },
];

const PENS = [
  { color: "#c8a15a", label: "황동" },
  { color: "#e9e5dd", label: "흰빛" },
  { color: "#7fa86b", label: "풀색" },
  { color: "#5bc8d6", label: "하늘" },
  { color: "#d97fb8", label: "자주" },
  { color: "#f0a23c", label: "주황" },
];

const WIDTHS = [
  { size: 1, label: "얇게" },
  { size: 2, label: "보통" },
  { size: 3.5, label: "굵게" },
];

/* 회고 모드에서 실제로 사고판 자리를 표시하는 색 (한국 관행: 상승 빨강) */
const ENTRY_COLOR = "#e0564f";
const EXIT_COLOR = "#4f86e0";
const STOP_COLOR = "#8a8378";

/** 자동으로 이어 그리는 고저점 선의 색 — 내가 그은 선과 구별되게 흐리게 */
const SWING_COLOR = "#8a8378";
/** 한 번에 이어 그릴 파동의 최대 개수. 다 그리면 화면이 지그재그로 덮입니다 */
const MAX_LEGS = 16;

/** 4시간봉을 만들 때만 씁니다 — 60분봉 넷을 하나로 */
function groupBars(bars: Bar[], n: number): Bar[] {
  if (n <= 1) return bars;
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i += n) {
    const g = bars.slice(i, i + n);
    if (g.length === 0) continue;
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

export function AnalyzeBoard({
  initialTicker,
  initialTf,
  tradeId,
}: {
  initialTicker?: string;
  initialTf?: string;
  /** 매매노트에서 넘어온 경우 — 그때 얼려 둔 그림을 봅니다 */
  tradeId?: string;
}) {
  const chart = useRef<KlineHandle>(null);
  const [ticker, setTicker] = useState((initialTicker ?? "NVDA").toUpperCase());
  const [tfKey, setTfKey] = useState(
    initialTf && TIMEFRAMES.some((t) => t.key === initialTf) ? initialTf : "1d",
  );
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tool, setTool] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<{ id: string; name: string }[]>([]);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [penColor, setPenColor] = useState(PENS[0].color);
  const [penSize, setPenSize] = useState(2);
  const [activeInd, setActiveInd] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const sheets = useAnalysis((s) => s.sheets);
  const hydrated = useAnalysis((s) => s.hydrated);
  const saveSheet = useAnalysis((s) => s.save);
  const removeSheet = useAnalysis((s) => s.remove);

  /*
   * ── 회고 모드 ──────────────────────────────────────────────
   *
   * 매매노트에서 "그때 그린 차트 보기"로 들어온 경우입니다. 진입할 때
   * 얼려 둔 그림을 올리고, 지금 그리는 그림은 건드리지 않습니다.
   *
   * **자동 저장을 반드시 꺼야 합니다.** 켜 둔 채로 지난 매매를 열면 그때
   * 그림이 지금 분석을 덮어씁니다. 과거를 보러 왔다가 현재를 잃는 셈입니다.
   */
  const trades = useNotes((s) => s.trades);
  const review = useMemo(
    () => (tradeId ? trades.find((t) => t.id === tradeId) ?? null : null),
    [tradeId, trades],
  );
  const reviewing = Boolean(review?.chart);

  const tfNow = TIMEFRAMES.find((t) => t.key === tfKey) ?? TIMEFRAMES[5];
  const penRef = useRef({ color: penColor, size: penSize });
  penRef.current = { color: penColor, size: penSize };
  const toolRef = useRef<string | null>(null);

  /* ── 시세 가져오기 ───────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const r = await fetch(
          `/api/chart?ticker=${encodeURIComponent(ticker)}&interval=${tfNow.interval}&range=${tfNow.range}`,
        );
        if (!r.ok) throw new Error("시세를 받지 못했습니다");
        const j = (await r.json()) as { candles: Bar[] };
        if (!alive) return;
        const got = groupBars(j.candles ?? [], tfNow.group);
        if (got.length === 0) throw new Error("이 봉 단위로는 자료가 없습니다");
        setBars(got);
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "불러오지 못했습니다");
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ticker, tfNow]);

  const feed: KLineData[] = useMemo(
    () =>
      bars.map((b) => ({
        timestamp: b.time * 1000,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      })),
    [bars],
  );

  const refreshDrawings = useCallback(() => {
    setDrawings(chart.current?.listDrawings() ?? []);
  }, []);

  /* ── 봉을 넣고, 저장해 둔 그림을 도로 올립니다 ───────────────── */
  useEffect(() => {
    if (!chartReady || feed.length === 0) return;
    chart.current?.clearDrawings();
    chart.current?.setData(feed, tfNow.period);
    const w = chart.current?.width() ?? 0;
    if (w > 0) chart.current?.fitAll(w < 640 ? 90 : 240);

    if (review?.chart) {
      /*
       * 회고 모드 — 진입할 때 얼려 둔 그림을 올립니다. 여기에 진입가와
       * 청산가를 수평선으로 얹으면 "그때 그은 선"과 "실제로 사고판 자리"가
       * 한 화면에 겹칩니다. 차트는 최신 봉까지 다 그리므로 그 뒤에 값이
       * 어디로 갔는지도 같이 보입니다.
       */
      const marks: SavedDrawing[] = [
        {
          name: "horizontalStraightLine",
          points: [{ value: review.entryPrice }],
          color: ENTRY_COLOR,
          size: 1.4,
        },
      ];
      if (review.stopPrice > 0) {
        marks.push({
          name: "horizontalStraightLine",
          points: [{ value: review.stopPrice }],
          color: STOP_COLOR,
          size: 1,
        });
      }
      if (review.exitPrice != null && review.exitPrice > 0) {
        marks.push({
          name: "horizontalStraightLine",
          points: [{ value: review.exitPrice }],
          color: EXIT_COLOR,
          size: 1.4,
        });
      }
      chart.current?.importDrawings([...review.chart.drawings, ...marks]);
      setSavedAt(review.chart.at);
    } else {
      // 저장해 둔 것이 있으면 그대로 다시 그립니다
      const sheet = sheets[`${ticker}:${tfKey}`];
      if (sheet?.drawings.length) {
        chart.current?.importDrawings(sheet.drawings);
        setSavedAt(sheet.updatedAt);
      } else {
        setSavedAt(null);
      }
    }
    setTimeout(refreshDrawings, 200);
    // sheets 는 저장할 때마다 바뀌므로 의존성에서 뺍니다 — 넣으면 저장할 때
    // 마다 차트를 다시 그리게 됩니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, feed, tfNow, ticker, tfKey, refreshDrawings, review]);

  /* ── 그린 것 저장 ────────────────────────────────────────────── */
  const save = useCallback(() => {
    // 회고 모드에서는 절대 저장하지 않습니다 — 지금 그림을 덮어쓰게 됩니다
    if (reviewing) return;
    const list = chart.current?.exportDrawings() ?? [];
    saveSheet(ticker, tfKey, list);
    setSavedAt(new Date().toISOString());
  }, [saveSheet, ticker, tfKey, reviewing]);

  /*
   * 그릴 때마다 자동으로 저장합니다.
   *
   * "저장" 을 눌러야만 남으면, 안 누르고 나간 사람은 그린 걸 통째로 잃습니다.
   * 브라우저에만 쓰는 것이라 비용도 없습니다. 단추는 그대로 두되(직접 누르고
   * 싶은 사람이 있으므로) 누르지 않아도 남습니다.
   */
  const autoSave = useCallback(() => {
    refreshDrawings();
    save();
  }, [refreshDrawings, save]);

  const armTool = useCallback(
    (key: string) => {
      if (toolRef.current === key) {
        toolRef.current = null;
        setTool(null);
        chart.current?.cancelDraw();
        return;
      }
      toolRef.current = key;
      setTool(key);
      chart.current?.startDraw(key, penRef.current);
    },
    [],
  );

  const handleDrawEnd = useCallback(() => {
    autoSave();
    const key = toolRef.current;
    if (key) chart.current?.startDraw(key, penRef.current);
  }, [autoSave]);

  /* ── 고저점 자동 찾기 ────────────────────────────────────────
   *
   * 여기서 나오는 것은 **판단이 아니라 눈금**입니다. 어디가 고점이고
   * 저점이었는지 규칙 하나로 세어 줄 뿐이고, 그 위에 무슨 선을 긋고 어떻게
   * 읽을지는 사람이 합니다. 그려진 것은 내가 그은 선과 똑같이 다뤄지므로
   * 색을 바꾸거나 지울 수 있습니다.
   */
  const [sens, setSens] = useState<string>("mid");

  const swingInfo = useMemo(() => {
    const src = bars.map((b) => ({
      time: b.time,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    const mult =
      SENSITIVITY.find((s) => s.key === sens)?.multiple ?? SENSITIVITY[1].multiple;
    const threshold = suggestThreshold(src, mult);
    return { threshold, swings: detectSwings(src, threshold) };
  }, [bars, sens]);

  const drawSwings = useCallback(() => {
    const pts = swingInfo.swings.slice(-(MAX_LEGS + 1));
    if (pts.length < 2) return;
    const legs: SavedDrawing[] = [];
    for (let i = 1; i < pts.length; i++) {
      legs.push({
        name: "segment",
        points: [
          { timestamp: pts[i - 1].time * 1000, value: pts[i - 1].price },
          { timestamp: pts[i].time * 1000, value: pts[i].price },
        ],
        color: SWING_COLOR,
        size: 1.2,
      });
    }
    chart.current?.importDrawings(legs);
    autoSave();
  }, [swingInfo, autoSave]);

  const drawAutoFib = useCallback(() => {
    const leg = lastLeg(swingInfo.swings);
    if (!leg) return;
    chart.current?.importDrawings([
      {
        name: "fibRetracement",
        points: [
          { timestamp: leg[0].time * 1000, value: leg[0].price },
          { timestamp: leg[1].time * 1000, value: leg[1].price },
        ],
        color: penRef.current.color,
        size: penRef.current.size,
      },
    ]);
    autoSave();
  }, [swingInfo, autoSave]);

  const removePicked = useCallback(() => {
    if (!picked) return;
    chart.current?.removeDrawing(picked.id);
    setPicked(null);
    autoSave();
  }, [picked, autoSave]);

  const undo = useCallback(() => {
    chart.current?.undo();
    setPicked(null);
    autoSave();
  }, [autoSave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (!picked) return;
        e.preventDefault();
        removePicked();
      } else if (e.key === "Escape") {
        toolRef.current = null;
        setTool(null);
        chart.current?.cancelDraw();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, picked, removePicked]);

  const applyPen = useCallback(
    (color: string, size: number) => {
      setPenColor(color);
      setPenSize(size);
      if (picked) {
        chart.current?.restyle(picked.id, { color, size });
        autoSave();
      }
    },
    [picked, autoSave],
  );

  /* ── 종목 찾기 ───────────────────────────────────────────────── */
  const hits = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (q.length === 0) return [];
    return allTickers()
      .filter(
        (t) => t.includes(q) || (nameOf(t) ?? "").toUpperCase().includes(q),
      )
      .slice(0, 8);
  }, [query]);

  const saved = hydrated ? recentSheets(sheets) : [];
  const last = bars.at(-1);
  const prev = bars.at(-2);
  const change =
    last && prev && prev.close > 0
      ? ((last.close - prev.close) / prev.close) * 100
      : null;

  return (
    <div className="prac">
      <header className="prac__bar">
        <div className="prac__id">
          <span className="prac__eyebrow">차트 분석</span>
          <span className="prac__name mono">
            {ticker}
            <span className="prac__namekr">{nameOf(ticker) ?? "—"}</span>
          </span>
        </div>

        <div className="prac__stat mono">
          <span>{tfNow.label}</span>
          {last && <span>{last.close.toFixed(2)}</span>}
          {change != null && (
            <span className={change >= 0 ? "up" : "down"}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)}%
            </span>
          )}
          {savedAt && !reviewing && <span className="anz__saved">저장됨</span>}
        </div>

        <div className="prac__actions">
          <button
            type="button"
            className="btn btn--ghost prac__panelbtn"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((v) => !v)}
          >
            도구
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => chart.current?.fitAll(feed.length)}
          >
            전체 보기
          </button>
          {reviewing ? (
            <a className="btn" href="/notes">
              매매노트로
            </a>
          ) : (
            <button type="button" className="btn" onClick={save}>
              저장
            </button>
          )}
        </div>
      </header>

      {/*
        회고 모드 알림. 지금 그리는 화면과 헷갈리면 안 되므로 눈에 띄게 둡니다.
      */}
      {reviewing && review && (
        <div className="anz__review">
          <strong>{review.entryDate} 진입 때 그려 뒀던 그림</strong>입니다.
          지금 그리는 분석이 아니고, 여기서 손댄 것은 저장되지 않습니다.
          <span className="anz__legend">
            <em style={{ color: ENTRY_COLOR }}>■</em> 진입 $
            {review.entryPrice}
            {review.stopPrice > 0 && (
              <>
                {" "}
                <em style={{ color: STOP_COLOR }}>■</em> 손절 ${review.stopPrice}
              </>
            )}
            {review.exitPrice != null && (
              <>
                {" "}
                <em style={{ color: EXIT_COLOR }}>■</em> 청산 ${review.exitPrice}
              </>
            )}
          </span>
          {review.memo && <p className="anz__reviewmemo">“{review.memo}”</p>}
        </div>
      )}

      <div className="prac__body">
        <aside className={`prac__tools${panelOpen ? " is-open" : ""}`}>
          <section>
            <h2>종목</h2>
            <input
              className="anz__search"
              value={query}
              placeholder="티커나 이름 (예: NVDA, 엔비디아)"
              onChange={(e) => setQuery(e.target.value)}
            />
            {hits.length > 0 && (
              <ul className="anz__hits">
                {hits.map((t) => (
                  <li key={t}>
                    <button
                      type="button"
                      onClick={() => {
                        setTicker(t);
                        setQuery("");
                        setPanelOpen(false);
                      }}
                    >
                      <span className="mono">{t}</span>
                      <span>{nameOf(t)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>봉 단위</h2>
            <div className="prac__grid">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="prac__tool"
                  aria-pressed={tfKey === t.key}
                  onClick={() => setTfKey(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          <section className="prac__pen">
            <h2>
              {picked
                ? `${TOOL_NAME[picked.name] ?? picked.name} 색·굵기`
                : "펜"}
            </h2>
            <div className="prac__swatches">
              {PENS.map((p) => (
                <button
                  key={p.color}
                  type="button"
                  className="prac__swatch"
                  style={{ background: p.color }}
                  aria-label={p.label}
                  aria-pressed={penColor === p.color}
                  onClick={() => applyPen(p.color, penSize)}
                />
              ))}
            </div>
            <div className="prac__widths">
              {WIDTHS.map((w) => (
                <button
                  key={w.size}
                  type="button"
                  className="prac__width"
                  aria-pressed={penSize === w.size}
                  onClick={() => applyPen(penColor, w.size)}
                >
                  <i style={{ height: `${w.size}px`, background: penColor }} />
                  <span>{w.label}</span>
                </button>
              ))}
            </div>
            {picked ? (
              <button
                type="button"
                className="btn btn--ghost prac__del"
                onClick={removePicked}
              >
                선택한 것 지우기 <kbd>Del</kbd>
              </button>
            ) : (
              <p className="prac__penhint">
                그려 둔 선을 <strong>누르면</strong> 색·굵기를 바꾸거나 지울 수
                있습니다.
              </p>
            )}
          </section>

          {DRAW_GROUPS.map((g) => (
            <section key={g.title}>
              <h2>{g.title}</h2>
              <div className="prac__grid">
                {g.tools.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className="prac__tool"
                    aria-pressed={tool === t.key}
                    title={t.hint}
                    onClick={() => {
                      armTool(t.key);
                      setPanelOpen(false);
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </section>
          ))}

          {!reviewing && (
            <section>
              <h2>자동으로 찾기</h2>
              <div className="prac__grid">
                {SENSITIVITY.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className="prac__tool"
                    aria-pressed={sens === s.key}
                    onClick={() => setSens(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="prac__penhint">
                이 종목이 실제로 움직이는 폭을 재서 기준을 잡습니다. 지금은{" "}
                <strong>{(swingInfo.threshold * 100).toFixed(1)}% 되돌림</strong>{" "}
                기준 · 고저점 {swingInfo.swings.length}개.
              </p>
              <div className="prac__row">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={drawSwings}
                  disabled={swingInfo.swings.length < 2}
                >
                  주요 고저점 잇기
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={drawAutoFib}
                  disabled={!lastLeg(swingInfo.swings)}
                >
                  자동 피보나치
                </button>
              </div>
              <p className="prac__penhint">
                어디가 고점·저점이었는지 세어 줄 뿐입니다. 사고팔 자리를
                가리키는 것이 아닙니다. 그려진 선은 직접 그은 것과 똑같이
                고치거나 지울 수 있습니다.
              </p>
            </section>
          )}

          {drawings.length > 0 && (
            <section>
              <h2>그린 것 {drawings.length}개</h2>
              <div className="prac__row">
                <button type="button" className="btn btn--ghost" onClick={undo}>
                  되돌리기 <kbd>Ctrl+Z</kbd>
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    chart.current?.clearDrawings();
                    autoSave();
                  }}
                >
                  모두 지우기
                </button>
              </div>
              {!reviewing && (
                <a
                  className="btn btn--ghost anz__tonotes"
                  href={`/notes?new=1&ticker=${ticker}`}
                >
                  이 분석으로 매매 기록
                </a>
              )}
            </section>
          )}

          <section>
            <h2>보조지표</h2>
            <div className="prac__grid">
              {INDICATORS.map((ind) => (
                <button
                  key={ind.key}
                  type="button"
                  className="prac__tool"
                  aria-pressed={activeInd.has(ind.key)}
                  onClick={() => {
                    const on = chart.current?.toggleIndicator(
                      ind.key,
                      ind.onCandle,
                    );
                    setActiveInd((s) => {
                      const next = new Set(s);
                      if (on) next.add(ind.key);
                      else next.delete(ind.key);
                      return next;
                    });
                  }}
                >
                  {ind.label}
                </button>
              ))}
            </div>
          </section>

          {saved.length > 0 && (
            <section>
              <h2>저장된 분석 {saved.length}개</h2>
              <ul className="anz__saves">
                {saved.map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setTicker(s.ticker);
                        setTfKey(s.tf);
                        setPanelOpen(false);
                      }}
                    >
                      <span className="mono">{s.ticker}</span>
                      <span>
                        {TIMEFRAMES.find((t) => t.key === s.tf)?.label ?? s.tf}
                      </span>
                      <span className="mono">{s.drawings.length}개</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${s.ticker} 분석 지우기`}
                      className="anz__x"
                      onClick={() => removeSheet(s.key)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="prac__note">
            여기 그린 것은 <strong>내가 적어 둔 생각</strong>이지 이 사이트의
            의견이 아닙니다. 매수·매도 판단을 대신하지 않습니다.
          </p>
        </aside>

        <main className="prac__chart">
          {loading && <div className="prac__overlay">시세를 받는 중입니다…</div>}
          {error && (
            <div className="prac__overlay">
              {error}
              <button
                type="button"
                className="btn"
                onClick={() => setTicker(ticker)}
              >
                다시 시도
              </button>
            </div>
          )}
          <Kline
            ref={chart}
            onReady={() => setChartReady(true)}
            onSelect={setPicked}
            onDrawEnd={handleDrawEnd}
          />
        </main>
      </div>

      <footer className="prac__foot">
        <span className="prac__ask">
          그린 것은 <b>이 기기에 저장</b>됩니다. 같은 종목·같은 봉 단위로 다시
          오면 그대로 있습니다.
        </span>
      </footer>
    </div>
  );
}
