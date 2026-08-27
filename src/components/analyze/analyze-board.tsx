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
import { HandIcon } from "@/components/practice/hand-icon";
import { ToolButton } from "@/components/practice/tool-button";
import { INDICATOR_ICONS, TOOL_ICONS } from "@/components/practice/tool-icons";
import { PenPicker } from "@/components/practice/pen-picker";
import { recentSheets, sheetKey, useAnalysis } from "@/lib/store/analysis-store";
import { useChartPrefs } from "@/lib/store/chart-prefs-store";
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
 * **그린 것은 이 기기에 남습니다.** 다음에 같은 종목으로 들어오면 그대로 다시
 * 나타나고, **봉 단위를 바꿔도 남습니다.** 좌표를 화면 위치가 아니라 시각·가격
 * 으로 적어 두기 때문에, 확대·축소를 하든 주봉에서 일봉으로 내려오든 같은
 * 자리를 지나갑니다.
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
  /*
   * 펜은 저장해 둔 것에서 시작합니다. 매번 들어올 때마다 쓰던 색을 다시
   * 고르게 하면 성가십니다.
   */
  const rememberPen = useChartPrefs((s) => s.setPen);
  const [penColor, setPenColor] = useState("#c8a15a");
  const [penSize, setPenSize] = useState(2);
  /*
   * 보조지표는 저장해 둔 것에서 시작합니다.
   *
   * 예전에는 빈 채로 시작해서, 새로고침하거나 종목·봉 단위를 바꿀 때마다
   * 켜 뒀던 것이 싹 사라졌습니다. 이동평균을 매번 다시 켜야 했습니다.
   */
  const savedInd = useChartPrefs((s) => s.indicators.analyze);
  const prefsHydrated = useChartPrefs((s) => s.hydrated);
  const rememberInd = useChartPrefs((s) => s.setIndicators);
  const [activeInd, setActiveInd] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  /*
   * 저장해 둔 펜을 되살립니다.
   *
   * `useState(저장값)` 으로 시작하면 안 됩니다. 서버에서 화면을 먼저 만들 때는
   * 저장소가 없어 기본값으로 그려지고, 브라우저가 그 위에 붙을 때 값이 달라져
   * 서로 어긋납니다. 지표와 같은 방식으로 **다 읽고 난 뒤 한 번** 올립니다.
   *
   * 딱 한 번만 합니다 — 저장값이 바뀔 때마다 따라가면 사용자가 방금 고른
   * 색을 도로 덮어씁니다.
   */
  const penRestored = useRef(false);
  useEffect(() => {
    if (!prefsHydrated || penRestored.current) return;
    penRestored.current = true;
    const p = useChartPrefs.getState().pen;
    setPenColor(p.color);
    setPenSize(p.size);
  }, [prefsHydrated]);

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
    // 종목·봉 단위가 바뀌면 앞서 자동으로 그린 것의 id 도 무효가 됩니다
    swingIdsRef.current = [];
    fibRef.current = null;
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
      /*
       * 봉 단위와 무관하게 **그 종목에 그려 둔 것 전부**를 올립니다.
       *
       * 좌표가 시각·가격이라 봉 단위가 달라도 같은 자리에 그려집니다. 주봉에
       * 그은 추세선이 일봉에서도 같은 자리를 지나가는 것이 맞습니다 — 그래야
       * 큰 흐름과 지금 자리를 겹쳐 볼 수 있습니다.
       */
      const sheet = sheets[sheetKey(ticker)];
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

  /*
   * 켜 뒀던 보조지표를 도로 올립니다.
   *
   * 봉을 갈아끼우면 지표 판도 함께 사라지므로 데이터가 바뀔 때마다 다시
   * 맞춥니다. `setIndicators` 는 몇 번을 불러도 결과가 같습니다.
   * 저장된 값을 아직 못 읽었을 때(`hydrated` 전) 부르면 빈 목록으로
   * 맞춰 버리므로 기다립니다.
   */
  useEffect(() => {
    if (!chartReady || !prefsHydrated || feed.length === 0) return;
    const want = INDICATORS.filter((i) => savedInd.includes(i.key));
    chart.current?.setIndicators(
      want.map((i) => ({ name: i.key, onCandle: i.onCandle })),
    );
    setActiveInd(new Set(want.map((i) => i.key)));
  }, [chartReady, prefsHydrated, savedInd, feed]);

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

  /*
   * ── 이동·선택 모드 ─────────────────────────────────────────────
   *
   * **도구가 물려 있는 동안에는 화면 아무 곳을 눌러도 "새로 그리기" 로
   * 먹힙니다.** 그래서 이미 그어 둔 선을 누르면 골라지는 게 아니라 그 자리에
   * 새 선이 하나 더 생겼습니다. 점을 끌어 옮기는 것도 당연히 안 됐고요.
   *
   * 하나 그릴 때마다 같은 도구를 다시 물리게 해 둔 것이 원인입니다. 그건
   * 여러 개를 잇달아 그을 때는 편하지만, 다 그리고 나서 **고치려 들 때는
   * 빠져나올 길이 없었습니다.** 그래서 여기로 돌아오는 단추를 둡니다.
   */
  const stopDraw = useCallback(() => {
    toolRef.current = null;
    setTool(null);
    chart.current?.stopDraw();
  }, []);

  const armTool = useCallback(
    (key: string) => {
      if (toolRef.current === key) {
        stopDraw();
        return;
      }
      toolRef.current = key;
      setTool(key);
      chart.current?.startDraw(key, penRef.current);
    },
    [stopDraw],
  );

  /*
   * 하나를 다 그리면 **곧바로 이동·선택으로 돌아옵니다.**
   *
   * 예전에는 같은 도구를 다시 물렸습니다. 여러 개를 잇달아 그을 때는 편했지만
   * 그리는 사람이 실제로 하는 일은 **한 줄 긋고 → 자리를 맞추고 → 다음 줄**
   * 이라, 그을 때마다 «이동» 을 눌러야 했습니다. 도구를 다시 무는 쪽이 한 번
   * 더 누르는 값이 싸므로 이쪽으로 뒤집습니다.
   */
  const handleDrawEnd = useCallback(() => {
    autoSave();
    stopDraw();
  }, [autoSave, stopDraw]);

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

  /*
   * 이 단추로 그린 선들의 id.
   *
   * 민감도를 바꾸고 다시 누르면 **앞서 그린 것을 지우고** 새로 그립니다.
   * 그러지 않으면 두 벌이 겹쳐 쌓입니다 — 촘촘히와 크게를 견줘 보려고
   * 누르는 것이 보통이라 금세 지저분해집니다.
   */
  const swingIdsRef = useRef<string[]>([]);

  const drawSwings = useCallback(() => {
    const pts = swingInfo.swings.slice(-(MAX_LEGS + 1));
    if (pts.length < 2) return;

    for (const id of swingIdsRef.current) chart.current?.removeDrawing(id);
    swingIdsRef.current = [];

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
    swingIdsRef.current = chart.current?.importDrawings(legs) ?? [];
    autoSave();
  }, [swingInfo, autoSave]);

  /*
   * 마지막으로 자동으로 그은 피보나치의 자리.
   *
   * 자동 피보나치는 늘 **마지막 파동**에 긋습니다. 그래서 연달아 누르면
   * 똑같은 것이 같은 자리에 겹쳐 쌓입니다 — 보이지도 않고 쓸모도 없습니다.
   * 민감도를 바꾸면 마지막 파동이 달라지므로 그때는 새로 긋습니다.
   */
  const fibRef = useRef<{ id: string; sig: string } | null>(null);

  const drawAutoFib = useCallback(() => {
    const leg = lastLeg(swingInfo.swings);
    if (!leg) return;
    const sig = `${leg[0].time}:${leg[0].price}-${leg[1].time}:${leg[1].price}`;
    if (fibRef.current?.sig === sig) {
      chart.current?.removeDrawing(fibRef.current.id);
      fibRef.current = null;
    }
    const ids = chart.current?.importDrawings([
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
    if (ids?.[0]) fibRef.current = { id: ids[0], sig };
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
        stopDraw();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, picked, removePicked, stopDraw]);

  const applyPen = useCallback(
    (color: string, size: number) => {
      setPenColor(color);
      setPenSize(size);
      rememberPen(color, size); // 다음에 들어와도 쓰던 펜 그대로
      if (picked) {
        chart.current?.restyle(picked.id, { color, size });
        autoSave();
      }
    },
    [picked, autoSave, rememberPen],
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
      {/*
        이 화면은 곧바로 h2 부터 시작하고 있었습니다. 다른 화면은 모두 h1 이
        있는데 여기만 없어서, 화면을 소리로 듣는 사람에게는 "무슨 쪽인지" 를
        말해 주는 첫 마디가 통째로 빠집니다. 차트 자리를 뺏지 않도록 눈에는
        보이지 않게 두되 구조에는 넣습니다.
      */}
      <h1 className="sr-only">차트 분석 — {ticker}</h1>
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
          {/*
            도구를 놓고 화면을 움직이거나 그어 둔 선을 고칠 때 누릅니다.
            도구 서랍 안에 두면 고칠 때마다 서랍을 열어야 하므로 밖에 둡니다.
          */}
          <button
            type="button"
            className="btn btn--ghost prac__modebtn"
            aria-pressed={tool === null}
            title="도구를 놓습니다. 화면을 끌어 옮기고, 그어 둔 선을 눌러 고칠 수 있습니다 (Esc)"
            onClick={stopDraw}
          >
            <HandIcon />
            이동
          </button>
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
            <em style={{ color: ENTRY_COLOR }} aria-hidden="true">■</em> 진입 $
            {review.entryPrice}
            {review.stopPrice > 0 && (
              <>
                {" "}
                <em style={{ color: STOP_COLOR }} aria-hidden="true">■</em> 손절 ${review.stopPrice}
              </>
            )}
            {review.exitPrice != null && (
              <>
                {" "}
                <em style={{ color: EXIT_COLOR }} aria-hidden="true">■</em> 청산 ${review.exitPrice}
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
            <PenPicker color={penColor} size={penSize} onChange={applyPen} />
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
                {tool
                  ? "한 번 그으면 이동·선택으로 돌아옵니다. 그때 자리를 맞추면 됩니다."
                  : "그려 둔 선을 누르면 골라집니다. 점을 끌면 자리를 옮길 수 있습니다."}
              </p>
            )}
          </section>

          {/*
            도구 목록 맨 앞에도 둡니다. 서랍을 열어 둔 채로 그리다가 고치고
            싶어질 때, 지금 무엇이 물려 있는지가 여기서 한눈에 보입니다.
          */}
          <section>
            <h2>다루기</h2>
            {/*
              이건 모양을 긋는 도구가 아니라 **모드**입니다. 지금 어느 쪽인지가
              늘 보여야 하므로 그림만 두지 않고 이름을 함께 답니다. 한 칸짜리라
              가로로 꽉 채웁니다 — 2열로 두면 옆이 비어 어설픕니다.
            */}
            <div className="prac__grid prac__grid--one">
              <button
                type="button"
                className="prac__tool prac__tool--mode"
                aria-pressed={tool === null}
                title="도구를 놓습니다. 화면을 끌고, 그은 선을 눌러 고칩니다 (Esc)"
                onClick={() => {
                  stopDraw();
                  setPanelOpen(false);
                }}
              >
                <HandIcon />
                <span>이동·선택</span>
              </button>
            </div>
          </section>

          {/* 도구는 그림으로 둡니다 — 글자만 늘어놓으면 눈에 안 걸립니다 */}
          {DRAW_GROUPS.map((g) => (
            <section key={g.title}>
              <h2>{g.title}</h2>
              <div className="prac__grid">
                {g.tools.map((t) => {
                  const Icon = TOOL_ICONS[t.key];
                  return (
                    <ToolButton
                      key={t.key}
                      icon={Icon ? <Icon /> : null}
                      label={t.label}
                      hint={t.hint}
                      pressed={tool === t.key}
                      onClick={() => {
                        armTool(t.key);
                        setPanelOpen(false);
                      }}
                    />
                  );
                })}
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
              {INDICATORS.map((ind) => {
                const Icon = INDICATOR_ICONS[ind.key];
                return (
                  <button
                    key={ind.key}
                    type="button"
                    className="prac__tool prac__tool--ind"
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
                        // 다음에 들어와도 그대로 켜져 있게 적어 둡니다
                        rememberInd("analyze", [...next]);
                        return next;
                      });
                    }}
                  >
                    {/*
                      지표는 그림만 두지 않습니다. 이름이 짧고(이동평균·볼린저)
                      업계에서 굳은 말이라 글자가 더 빨리 읽힙니다. 그림은
                      목록에서 눈이 걸리게 하는 역할만 합니다.
                    */}
                    {Icon && <Icon />}
                    <span>{ind.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="prac__penhint">켜 둔 것은 다음에 들어와도 그대로입니다.</p>
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
            /* 끌어 옮긴 자리도 남겨야 합니다 — 없으면 다시 들어왔을 때 되돌아갑니다 */
            onMoveEnd={autoSave}
          />
        </main>
      </div>

      <footer className="prac__foot">
        <span className="prac__ask">
          그린 것은 <b>이 기기에 저장</b>됩니다. 같은 종목으로 다시 오면 그대로
          있고, <b>봉 단위를 바꿔도 남습니다</b> — 시각과 가격에 박아 두기
          때문입니다.
        </span>
      </footer>
    </div>
  );
}
