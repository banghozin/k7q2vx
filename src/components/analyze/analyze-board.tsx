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
  { key: "1mo", label: "월봉", interval: "1mo", range: "max", group: 1, period: { type: "month", span: 1 } },
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

export function AnalyzeBoard({ initialTicker }: { initialTicker?: string }) {
  const chart = useRef<KlineHandle>(null);
  const [ticker, setTicker] = useState((initialTicker ?? "NVDA").toUpperCase());
  const [tfKey, setTfKey] = useState("1d");
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

    // 저장해 둔 것이 있으면 그대로 다시 그립니다
    const sheet = sheets[`${ticker}:${tfKey}`];
    if (sheet?.drawings.length) {
      chart.current?.importDrawings(sheet.drawings);
      setSavedAt(sheet.updatedAt);
    } else {
      setSavedAt(null);
    }
    setTimeout(refreshDrawings, 200);
    // sheets 는 저장할 때마다 바뀌므로 의존성에서 뺍니다 — 넣으면 저장할 때
    // 마다 차트를 다시 그리게 됩니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, feed, tfNow, ticker, tfKey, refreshDrawings]);

  /* ── 그린 것 저장 ────────────────────────────────────────────── */
  const save = useCallback(() => {
    const list = chart.current?.exportDrawings() ?? [];
    saveSheet(ticker, tfKey, list);
    setSavedAt(new Date().toISOString());
  }, [saveSheet, ticker, tfKey]);

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
          {savedAt && <span className="anz__saved">저장됨</span>}
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
          <button type="button" className="btn" onClick={save}>
            저장
          </button>
        </div>
      </header>

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
