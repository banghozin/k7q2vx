"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KLineData, Period } from "klinecharts";
import { allTickers, nameOf } from "@/data/themes";
import { type Hit, type Row, loadNamuhList, searchNamuh } from "@/lib/namuh-search";
import {
  Kline,
  type KlineHandle,
  type Pen,
  type SavedDrawing,
} from "@/components/practice/kline";
import { HandIcon } from "@/components/practice/hand-icon";
import { ToolButton } from "@/components/practice/tool-button";
import { TOOL_ICONS } from "@/components/practice/tool-icons";
import { PenPicker } from "@/components/practice/pen-picker";
import { WatchLevels } from "@/components/analyze/watch-levels";
import { IndicatorPanel } from "@/components/analyze/indicator-panel";
import { MiniChart } from "@/components/analyze/mini-chart";
import { PriceAlerts } from "@/components/analyze/price-alerts";
import { ChartMenu, type ChartMenuState, useMenuDismiss } from "@/components/analyze/chart-menu";
import { useAlerts } from "@/lib/store/alerts-store";
import { SPEC_BY_KEY, paramsOf } from "@/components/analyze/indicator-catalog";
import { COMPARE_SLOTS } from "@/components/practice/indicators";
import { recentSheets, sheetKey, useAnalysis } from "@/lib/store/analysis-store";
import {
  type IndTemplate,
  type Magnet,
  type YScale,
  useChartPrefs,
} from "@/lib/store/chart-prefs-store";
import { useWatchlist } from "@/lib/store/watchlist-store";
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
  // 1분봉은 야후가 7일치만 줍니다
  { key: "1m", label: "1분", interval: "1m", range: "7d", group: 1, period: { type: "minute", span: 1 } },
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
      { key: "fibRetracement", label: "피보나치", hint: "고점과 저점 두 점 (Alt+F)" },
    ],
  },
  {
    title: "선",
    tools: [
      { key: "segment", label: "추세선", hint: "찍은 두 점 사이만 (Alt+T)" },
      { key: "straightLine", label: "연장선", hint: "양쪽으로 끝없이" },
      { key: "rayLine", label: "반직선", hint: "한쪽으로만" },
      { key: "horizontalStraightLine", label: "수평선", hint: "지지·저항 자리 (Alt+H)" },
      { key: "horizontalRayLine", label: "수평 반직선", hint: "찍은 자리에서 오른쪽으로만 (Alt+J)" },
      { key: "verticalStraightLine", label: "세로선", hint: "날짜 하나를 짚습니다 (Alt+V)" },
      { key: "priceLine", label: "가격 꼬리표", hint: "선 끝에 가격이 붙습니다" },
      { key: "priceChannelLine", label: "채널", hint: "세 점으로 평행 채널" },
      { key: "parallelStraightLine", label: "평행선", hint: "세 점으로 평행선" },
      { key: "arrow", label: "화살표", hint: "두 점. 끝에 화살촉" },
      { key: "freeCurve", label: "자유곡선", hint: "누른 채로 끌면 그려집니다" },
      { key: "simpleAnnotation", label: "메모", hint: "글자를 적습니다" },
    ],
  },
  {
    title: "모양·측정",
    tools: [
      { key: "box", label: "사각형", hint: "두 모서리. 매물대·횡보 구간 (Alt+R)" },
      { key: "measure", label: "측정", hint: "두 점 사이 몇 %·몇 봉·며칠 (Alt+M)" },
      { key: "position", label: "포지션", hint: "진입→손절→목표 세 점. 손익비가 나옵니다 (Alt+P)" },
    ],
  },
];

/*
 * 단축키 — 트레이딩뷰와 같은 자리에 둡니다(Alt+T 추세선, Alt+H 수평선 …).
 * 글자(`e.key`)가 아니라 **자판 위치(`e.code`)** 로 봅니다. 한글 입력 상태에서는
 * Alt+T 를 눌러도 `e.key` 가 "ㅅ" 로 옵니다.
 */
const SHORTCUT_TOOLS: Record<string, string> = {
  KeyT: "segment",
  KeyH: "horizontalStraightLine",
  KeyJ: "horizontalRayLine",
  KeyV: "verticalStraightLine",
  KeyF: "fibRetracement",
  KeyR: "box",
  KeyM: "measure",
  KeyP: "position",
};

const SHORTCUT_HELP: [string, string][] = [
  ["Alt+T", "추세선"],
  ["Alt+H", "수평선"],
  ["Alt+J", "수평 반직선"],
  ["Alt+V", "세로선"],
  ["Alt+F", "피보나치"],
  ["Alt+R", "사각형"],
  ["Alt+M", "측정"],
  ["Alt+P", "포지션"],
  ["Esc", "도구 놓기"],
  ["Ctrl+Z", "되돌리기"],
  ["Ctrl+Y", "다시 하기"],
  ["Ctrl+D", "고른 것 복제"],
  ["Alt+L", "고른 것 잠그기"],
  ["Del", "고른 것 지우기"],
  ["↑ / ↓", "워치리스트 앞·뒤 종목"],
];

/** 수평으로 가격 하나를 짚는 도구 — 알림을 걸 수 있는 선 */
const LEVEL_TOOLS = new Set([
  "horizontalStraightLine",
  "horizontalRayLine",
  "horizontalSegment",
  "priceLine",
]);

/** 비교 종목 선 색 — 캔들 빨강·파랑과 겹치지 않게 */
const COMPARE_COLORS = ["#f0a23c", "#9b8ec4", "#7fa86b"];

/** 되돌리기 기록을 몇 단계까지 들고 있을지 */
const MAX_HISTORY = 60;

const TOOL_NAME: Record<string, string> = Object.fromEntries(
  DRAW_GROUPS.flatMap((g) => g.tools.map((t) => [t.key, t.label])),
);

/* 보조지표 목록은 indicator-catalog.ts 로 옮겼습니다 (18개 + 설정 칸) */

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
  const [drawings, setDrawings] = useState<
    { id: string; name: string; locked: boolean; hidden: boolean; points: { value?: number }[]; pane?: string }[]
  >([]);
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
   * 나무 취급 종목 목록(5,599개). 검색창에 첫 글자를 칠 때 받아옵니다.
   * 페이지에 같이 실으면 검색을 안 쓰는 사람에게도 190KB 가 실려 갑니다.
   */
  const [namuhRows, setNamuhRows] = useState<readonly Row[]>([]);
  useEffect(() => {
    if (query.trim().length === 0 || namuhRows.length > 0) return;
    let alive = true;
    loadNamuhList().then((rows) => {
      if (alive) setNamuhRows(rows);
    });
    return () => {
      alive = false;
    };
  }, [query, namuhRows.length]);

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

  /* ── 트레이딩뷰를 대신하려고 붙인 설정들 (이 기기에 남습니다) ── */
  const indParams = useChartPrefs((s) => s.indParams);
  const setIndParams = useChartPrefs((s) => s.setIndParams);
  const yScale = useChartPrefs((s) => s.yScale);
  const setYScale = useChartPrefs((s) => s.setYScale);
  const magnet = useChartPrefs((s) => s.magnet);
  const setMagnet = useChartPrefs((s) => s.setMagnet);
  const priceLock = useChartPrefs((s) => s.priceLock);
  const setPriceLock = useChartPrefs((s) => s.setPriceLock);
  const invertScale = useChartPrefs((s) => s.invertScale);
  const setInvertScale = useChartPrefs((s) => s.setInvertScale);
  const addAlert = useAlerts((s) => s.add);
  const [menu, setMenu] = useState<ChartMenuState | null>(null);
  /** 마지막으로 누른 것이 손가락인가 — 길게 누르기는 십자선이지 메뉴가 아닙니다 */
  const touchRef = useRef(false);
  const templates = useChartPrefs((s) => s.templates);
  const saveTemplate = useChartPrefs((s) => s.saveTemplate);
  const removeTemplate = useChartPrefs((s) => s.removeTemplate);
  const compare = useChartPrefs((s) => s.compare);
  const setCompare = useChartPrefs((s) => s.setCompare);
  const prepost = useChartPrefs((s) => s.prepost);
  const setPrepost = useChartPrefs((s) => s.setPrepost);
  const layout = useChartPrefs((s) => s.layout);
  const setLayout = useChartPrefs((s) => s.setLayout);
  const layoutTickers = useChartPrefs((s) => s.layoutTickers);
  const setLayoutTickers = useChartPrefs((s) => s.setLayoutTickers);
  const watch = useWatchlist((s) => s.items);
  const watchHydrated = useWatchlist((s) => s.hydrated);
  const toggleWatch = useWatchlist((s) => s.toggle);
  const [cmpInput, setCmpInput] = useState("");
  const [showKeys, setShowKeys] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
  /*
   * 회고는 **그 매매의 종목을 보고 있을 때만**입니다. 회고 중에도 종목 찾기가
   * 열려 있어서, 다른 종목으로 바꾸면 NVDA 때 얼린 선과 진입선이 AAPL 차트
   * 위에 그대로 얹혔습니다.
   */
  const reviewing = Boolean(review?.chart) && review?.ticker === ticker;

  // 못 찾으면 일봉 — 1분봉을 맨 앞에 끼워 넣어서 번호로 고르면 어긋납니다
  const tfNow =
    TIMEFRAMES.find((t) => t.key === tfKey) ?? TIMEFRAMES.find((t) => t.key === "1d")!;
  /** 분·시간봉인가 — 시간외·VWAP 는 여기서만 뜻이 있습니다 */
  const intraday = tfNow.period.type === "minute" || tfNow.period.type === "hour";
  const usePrepost = intraday && prepost;
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
          `/api/chart?ticker=${encodeURIComponent(ticker)}&interval=${tfNow.interval}&range=${tfNow.range}${usePrepost ? "&prepost=1" : ""}`,
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
  }, [ticker, tfNow, usePrepost]);

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

    if (reviewing && review?.chart) {
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
    // 새 종목·봉 단위로 들어왔으니 되돌리기 기록은 여기서부터 다시 셉니다
    historyRef.current = { past: [], future: [], last: chart.current?.exportDrawings() ?? [] };
    setHistLen({ past: 0, future: 0 });
    setTimeout(refreshDrawings, 200);
    // sheets 는 저장할 때마다 바뀌므로 의존성에서 뺍니다 — 넣으면 저장할 때
    // 마다 차트를 다시 그리게 됩니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, feed, tfNow, ticker, tfKey, refreshDrawings, review, reviewing]);

  /*
   * 켜 뒀던 보조지표를 도로 올립니다.
   *
   * 봉을 갈아끼우면 지표 판도 함께 사라지므로 데이터가 바뀔 때마다 다시
   * 맞춥니다. `setIndicators` 는 몇 번을 불러도 결과가 같습니다.
   * 저장된 값을 아직 못 읽었을 때(`hydrated` 전) 부르면 빈 목록으로
   * 맞춰 버리므로 기다립니다.
   */
  /*
   * 지금 차트에 올릴 지표 목록 — 켜 둔 것 + 각자의 설정.
   * VWAP 처럼 분·시간봉에서만 뜻이 있는 것은 일봉에서 잠시 빼 둡니다
   * (켜 둔 기록은 그대로라 분봉으로 돌아오면 다시 뜹니다).
   */
  const indList = useMemo(
    () =>
      savedInd
        .map((k) => SPEC_BY_KEY.get(k))
        .filter((s): s is NonNullable<typeof s> => Boolean(s) && !(s!.intradayOnly && !intraday))
        .map((s) => ({
          name: s.key,
          onCandle: s.onCandle,
          params: s.defaults.length > 0 ? paramsOf(s.key, indParams) : undefined,
        })),
    [savedInd, indParams, intraday],
  );

  useEffect(() => {
    if (!chartReady || !prefsHydrated || feed.length === 0) return;
    chart.current?.setIndicators(indList);
    setActiveInd(new Set(savedInd.filter((k) => SPEC_BY_KEY.has(k))));
    // 지표를 끄면 그 판에 그은 것이 맡겨지고, 켜면 돌아옵니다 — 목록도 맞춥니다
    refreshDrawings();
  }, [chartReady, prefsHydrated, savedInd, feed, indList, refreshDrawings]);

  const toggleInd = useCallback(
    (key: string) => {
      const next = savedInd.includes(key) ? savedInd.filter((k) => k !== key) : [...savedInd, key];
      rememberInd("analyze", next);
    },
    [savedInd, rememberInd],
  );

  /* ── 가격 눈금 · 자석 ── */
  useEffect(() => {
    if (chartReady && prefsHydrated) chart.current?.setYScale(yScale);
  }, [chartReady, prefsHydrated, yScale]);

  useEffect(() => {
    if (chartReady && prefsHydrated) chart.current?.setMagnet(magnet);
  }, [chartReady, prefsHydrated, magnet]);

  useEffect(() => {
    if (chartReady && prefsHydrated) chart.current?.setPriceLock(priceLock);
  }, [chartReady, prefsHydrated, priceLock]);

  useEffect(() => {
    if (chartReady && prefsHydrated) chart.current?.setInvert(invertScale);
  }, [chartReady, prefsHydrated, invertScale]);

  /* ── 비교 종목 ───────────────────────────────────────────────
   *
   * 같은 봉 단위로 받아서 **시각을 맞춰** 겹칩니다. 시각이 안 맞는 봉(한쪽만
   * 거래한 날)은 비워 둡니다. 화면 왼쪽 끝 봉에서 둘이 같이 출발하게 그립니다.
   */
  useEffect(() => {
    if (!chartReady || !prefsHydrated || feed.length === 0) return;
    let alive = true;
    COMPARE_SLOTS.forEach((slot, i) => {
      const t = compare[i];
      if (!t) {
        chart.current?.setCompare(slot, null);
        return;
      }
      fetch(
        `/api/chart?ticker=${encodeURIComponent(t)}&interval=${tfNow.interval}&range=${tfNow.range}${usePrepost ? "&prepost=1" : ""}`,
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { candles?: Bar[] } | null) => {
          if (!alive || !j) return;
          const closes: Record<number, number> = {};
          for (const b of groupBars(j.candles ?? [], tfNow.group)) closes[b.time * 1000] = b.close;
          chart.current?.setCompare(slot, { ticker: t, color: COMPARE_COLORS[i], closes });
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, [chartReady, prefsHydrated, feed, compare, tfNow, usePrepost]);

  const addCompare = (raw: string) => {
    const t = raw.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,10}$/.test(t) || t === ticker || compare.includes(t) || compare.length >= 3) return;
    setCompare([...compare, t]);
    setCmpInput("");
    /*
     * 처음 겹칠 때 눈금을 % 로 돌립니다. 값이 다른 두 종목을 가격 눈금으로
     * 겹치면 출발점만 맞을 뿐 폭을 견주기 어렵습니다 — 트레이딩뷰도 이렇게 합니다.
     */
    if (compare.length === 0 && yScale === "normal") setYScale("percentage");
  };

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
  /*
   * ── 되돌리기 · 다시 하기 ───────────────────────────────────────
   *
   * 예전 되돌리기는 "마지막에 그린 것 하나 지우기" 였습니다. 그래서 옮긴 것,
   * 색 바꾼 것, 지운 것은 되돌릴 수 없었고 다시 하기도 없었습니다.
   *
   * 지금은 바뀔 때마다 **그린 것 전체를 사진 찍듯** 남겨 둡니다. 되돌리면
   * 앞 사진으로, 다시 하면 뒤 사진으로 통째로 바꿉니다. 무엇을 했든 똑같이
   * 되돌아갑니다. 그림이 많아도 숫자 몇 개라 가볍습니다.
   */
  const historyRef = useRef<{ past: SavedDrawing[][]; future: SavedDrawing[][]; last: SavedDrawing[] }>({
    past: [],
    future: [],
    last: [],
  });
  const [histLen, setHistLen] = useState({ past: 0, future: 0 });

  const commit = useCallback(() => {
    if (reviewing) return;
    const now = chart.current?.exportDrawings() ?? [];
    const h = historyRef.current;
    if (JSON.stringify(now) === JSON.stringify(h.last)) return;
    h.past.push(h.last);
    if (h.past.length > MAX_HISTORY) h.past.shift();
    h.last = now;
    h.future = [];
    setHistLen({ past: h.past.length, future: 0 });
  }, [reviewing]);

  const autoSave = useCallback(() => {
    refreshDrawings();
    commit();
    save();
  }, [refreshDrawings, commit, save]);

  const travel = useCallback(
    (dir: "back" | "forward") => {
      const h = historyRef.current;
      const from = dir === "back" ? h.past : h.future;
      const to = dir === "back" ? h.future : h.past;
      const target = from.pop();
      if (!target) return;
      to.push(h.last);
      h.last = target;
      chart.current?.restoreDrawings(target);
      setPicked(null);
      setHistLen({ past: h.past.length, future: h.future.length });
      refreshDrawings();
      save();
    },
    [refreshDrawings, save],
  );

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

    /*
     * **id 만 기억해 두면 새로고침을 견디지 못합니다.**
     *
     * 이 ref 는 화면을 새로 열면 비고, 저장해 둔 선들은 새 id 로 다시
     * 그려집니다. 그래서 다시 들어와 이 단추를 누르면 앞엣것이 안 지워지고
     * 그대로 겹쳐 쌓였습니다 — 실제로 재 보니 16개가 32개가 됐습니다.
     *
     * 그래서 id 가 아니라 **생김새로 알아봅니다.** 이 단추가 긋는 선은
     * 회색(SWING_COLOR) 1.2px 짜리 추세선인데, 굵기 1.2 는 펜에서 고를 수
     * 없는 값(1·2·3.5·5)이라 손으로는 만들 수 없습니다.
     */
    for (const d of chart.current?.listDrawings() ?? []) {
      if (d.name === "segment" && d.color === SWING_COLOR && d.size === 1.2) {
        chart.current?.removeDrawing(d.id);
      }
    }
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

    /*
     * 새로고침을 건너와도 같은 자리에 두 겹으로 쌓이지 않게, **좌표가 똑같은
     * 피보나치**는 먼저 걷어냅니다. 위 `fibRef` 는 id 라 화면을 새로 열면
     * 끊깁니다 (고저점 쪽과 같은 이유).
     */
    const same = (v: number | undefined, w: number) =>
      v != null && Math.abs(v - w) < 1e-6;
    for (const d of chart.current?.listDrawings() ?? []) {
      if (d.name !== "fibRetracement" || d.points.length < 2) continue;
      if (
        same(d.points[0].timestamp, leg[0].time * 1000) &&
        same(d.points[0].value, leg[0].price) &&
        same(d.points[1].timestamp, leg[1].time * 1000) &&
        same(d.points[1].value, leg[1].price)
      ) {
        chart.current?.removeDrawing(d.id);
      }
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

  const undo = useCallback(() => travel("back"), [travel]);
  const redo = useCallback(() => travel("forward"), [travel]);

  /*
   * 고른 것 복제 — 같은 자리에 겹치면 복제된 줄 모르므로 **가격을 조금(2%)
   * 올려** 놓습니다. 그 다음 끌어서 원하는 자리로 옮기면 됩니다.
   */
  const clonePicked = useCallback(() => {
    if (!picked) return;
    const src = chart.current?.listDrawings().find((d) => d.id === picked.id);
    if (!src) return;
    chart.current?.importDrawings([
      {
        name: src.name,
        color: src.color,
        size: src.size,
        // RSI 판에 그은 것을 복제하면 RSI 판에 — 빠뜨리면 가격 판으로 갑니다
        pane: src.pane,
        points: src.points.map((p) => ({
          timestamp: p.timestamp,
          value: typeof p.value === "number" ? p.value * 1.02 : p.value,
        })),
      },
    ]);
    autoSave();
  }, [picked, autoSave]);

  /*
   * 잠금 — 잠긴 것은 눌러도 골라지지 않습니다(라이브러리가 그렇게 동작합니다).
   * 그래서 푸는 일은 아래 "그린 것" 목록에서 합니다.
   */
  const setLocked = useCallback(
    (id: string, locked: boolean) => {
      chart.current?.setDrawingLocked(id, locked);
      if (locked && picked?.id === id) setPicked(null);
      autoSave();
    },
    [picked, autoSave],
  );

  const setHidden = useCallback(
    (id: string, hidden: boolean) => {
      chart.current?.setDrawingHidden(id, hidden);
      autoSave();
    },
    [autoSave],
  );

  /* ── 그림 저장 · 전체 화면 ── */
  const downloadPicture = useCallback(() => {
    const url = chart.current?.picture();
    if (!url) return;
    const a = document.createElement("a");
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    a.href = url;
    a.download = `${ticker}_${tfKey}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.png`;
    a.click();
  }, [ticker, tfKey]);

  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  /*
   * 워치리스트 앞·뒤 종목. 지금 종목이 목록에 없으면 첫 종목으로 갑니다.
   */
  const stepWatch = useCallback(
    (d: 1 | -1) => {
      if (watch.length === 0) return;
      const i = watch.findIndex((w) => w.ticker === ticker);
      const n = i < 0 ? 0 : (i + d + watch.length) % watch.length;
      setTicker(watch[n].ticker);
    },
    [watch, ticker],
  );

  /* ── 우클릭 메뉴 ─────────────────────────────────────────────── */
  const openMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 차트 그림판 위에서만 — 기록 창·안내 글 위에서는 브라우저 기본 메뉴 그대로
      if (!(e.target instanceof Element && e.target.closest(".kline"))) return;
      e.preventDefault();
      if (touchRef.current || loading || error) return;
      // 그리는 중에 오른쪽 단추 = 그리기 그만 (트레이딩뷰와 같습니다)
      if (toolRef.current) {
        stopDraw();
        return;
      }
      const box = e.currentTarget.getBoundingClientRect();
      const hit = chart.current?.takeRightHit() ?? null;
      const d = hit ? chart.current?.listDrawings().find((x) => x.id === hit.id) : undefined;
      if (hit) setPicked(hit);
      setMenu({
        x: e.clientX - box.left,
        y: e.clientY - box.top,
        price: chart.current?.priceAt(e.clientX, e.clientY) ?? null,
        drawing: hit
          ? { id: hit.id, label: TOOL_NAME[hit.name] ?? hit.name, locked: d?.locked === true }
          : null,
      });
    },
    [loading, error, stopDraw],
  );

  useMenuDismiss(menu !== null, () => setMenu(null));

  const hlineAt = useCallback(
    (price: number) => {
      chart.current?.importDrawings([
        {
          name: "horizontalStraightLine",
          points: [{ value: price }],
          color: penRef.current.color,
          size: penRef.current.size,
        },
      ]);
      autoSave();
    },
    [autoSave],
  );

  const alertAt = useCallback(
    (price: number) => {
      const lastClose = bars.at(-1)?.close;
      const dir = lastClose != null && price < lastClose ? "below" : "above";
      addAlert({ ticker, price: Math.round(price * 100) / 100, dir });
      // 처음 만들 때 한 번만 허락을 묻습니다 (알림 칸과 같은 방식)
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    },
    [bars, ticker, addAlert],
  );

  const resetView = useCallback(() => {
    const w = chart.current?.width() ?? 0;
    if (w > 0) chart.current?.fitAll(w < 640 ? 90 : 240);
    chart.current?.autoFitPrice();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (mod && k === "z") {
        e.preventDefault();
        undo();
      } else if (mod && e.code === "KeyD") {
        if (!picked) return;
        e.preventDefault(); // 브라우저 즐겨찾기 단축키를 막습니다
        clonePicked();
      } else if (e.altKey && e.code === "KeyL") {
        if (!picked) return;
        e.preventDefault();
        setLocked(picked.id, true);
      } else if (e.altKey && SHORTCUT_TOOLS[e.code]) {
        if (reviewing) return;
        e.preventDefault();
        armTool(SHORTCUT_TOOLS[e.code]);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (!picked) return;
        e.preventDefault();
        removePicked();
      } else if (e.key === "Escape") {
        stopDraw();
        setShowKeys(false);
        setMenu(null);
      } else if (!mod && !e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        if (watch.length === 0) return;
        e.preventDefault();
        stepWatch(e.key === "ArrowUp" ? -1 : 1);
      } else if (e.key === "?") {
        setShowKeys((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, picked, removePicked, stopDraw, clonePicked, setLocked, armTool, reviewing, watch, stepWatch]);

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
  /*
   * 층에 세운 186종목을 먼저 찾고, 자리가 남으면 나무 취급 종목으로 채웁니다.
   * 예전에는 앞의 것만 훑어서, 나무에 멀쩡히 있는 종목(메가 포춘·멀린 등)을
   * 쳐도 아무것도 안 떴습니다.
   */
  const hits = useMemo<Hit[]>(() => {
    const raw = query.trim();
    if (raw.length === 0) return [];
    const q = raw.toUpperCase();
    const curated: Hit[] = allTickers()
      .filter((t) => t.includes(q) || (nameOf(t) ?? "").toUpperCase().includes(q))
      .slice(0, 8)
      .map((t) => ({ ticker: t, name: nameOf(t) ?? "", curated: true }));
    return searchNamuh(namuhRows, raw, curated, 8);
  }, [query, namuhRows]);

  /*
   * 큐레이션 밖 종목(나무 검색으로 연 것)은 `nameOf` 가 이름을 모릅니다.
   * 머리줄이 "—" 로 비지 않게 나무 목록에서 찾아 붙입니다.
   */
  const [otherName, setOtherName] = useState<string | null>(null);
  useEffect(() => {
    setOtherName(null);
    if (nameOf(ticker)) return;
    let alive = true;
    loadNamuhList().then((rows) => {
      const hit = rows.find((r) => r[0] === ticker);
      if (alive && hit) setOtherName(hit[1] ?? null);
    });
    return () => {
      alive = false;
    };
  }, [ticker]);
  const displayName = nameOf(ticker) ?? otherName;
  const inWatch = watchHydrated && watch.some((w) => w.ticker === ticker);
  /** 골라 둔 것이 수평선류면 그 가격 — 알림을 걸 수 있습니다 */
  const pickedLevel = useMemo(() => {
    if (!picked || !LEVEL_TOOLS.has(picked.name)) return null;
    const d = drawings.find((x) => x.id === picked.id);
    // RSI 같은 지표 판의 선은 가격이 아니라 알림을 걸 수 없습니다
    if (d?.pane) return null;
    const v = d?.points?.[0]?.value;
    return typeof v === "number" ? v : null;
  }, [picked, drawings]);
  const miniCount = layout - 1;
  const miniTickers = useMemo(() => {
    /*
     * 비어 있는 칸은 지수 ETF 로 채웁니다. 본 차트 종목과 겹치지 않게 넉넉히
     * 넷을 두고 거릅니다 — 셋만 두면 본 차트가 NVDA 일 때 하나가 모자라
     * SPY 가 두 번 떴습니다.
     */
    const fill = ["SPY", "QQQ", "IWM", "NVDA"].filter((t) => t !== ticker);
    return Array.from({ length: miniCount }, (_, i) => layoutTickers[i] ?? fill[i]);
  }, [miniCount, layoutTickers, ticker]);

  const saved = hydrated ? recentSheets(sheets) : [];
  const last = bars.at(-1);
  const prev = bars.at(-2);
  const change =
    last && prev && prev.close > 0
      ? ((last.close - prev.close) / prev.close) * 100
      : null;

  return (
    <div className={`prac${fullscreen ? " is-full" : ""}`} ref={rootRef}>
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
            <span className="prac__namekr">{displayName ?? "—"}</span>
            {/* 워치리스트에 넣고 빼기 — ↑↓ 로 넘겨 볼 목록입니다 */}
            <button
              type="button"
              className="anz__star"
              aria-pressed={inWatch}
              aria-label={inWatch ? `${ticker} 워치리스트에서 빼기` : `${ticker} 워치리스트에 넣기`}
              title={inWatch ? "워치리스트에서 빼기" : "워치리스트에 넣기"}
              onClick={() => toggleWatch(ticker, displayName ?? ticker)}
            >
              {inWatch ? "★" : "☆"}
            </button>
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
          <button
            type="button"
            className="btn btn--ghost prac__wideonly"
            title="지금 차트를 그림 파일(PNG)로 저장합니다"
            onClick={downloadPicture}
          >
            그림 저장
          </button>
          <button
            type="button"
            className="btn btn--ghost prac__wideonly"
            aria-pressed={fullscreen}
            title="화면 전체를 차트로 씁니다 (Esc 로 나가기)"
            onClick={toggleFullscreen}
          >
            {fullscreen ? "작게" : "크게"}
          </button>
          <button
            type="button"
            className="btn btn--ghost prac__wideonly"
            aria-expanded={showKeys}
            title="단축키 (?)"
            onClick={() => setShowKeys((v) => !v)}
          >
            단축키
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
              aria-label="종목 찾기"
              placeholder="티커나 이름 (예: NVDA, 엔비디아)"
              onChange={(e) => setQuery(e.target.value)}
            />
            {hits.length > 0 && (
              <ul className="anz__hits">
                {hits.map((h) => (
                  <li key={h.ticker}>
                    <button
                      type="button"
                      onClick={() => {
                        setTicker(h.ticker);
                        setQuery("");
                        setPanelOpen(false);
                      }}
                    >
                      <span className="mono">{h.ticker}</span>
                      <span>
                        {h.name}
                        {/* 개별 회사가 아니면 무엇인지 밝힙니다 — 골라 놓고 회사인 줄 알면 곤란합니다 */}
                        {h.kind && <em className="anz__hitkind">{h.kind}</em>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {watchHydrated && watch.length > 0 && (
            <section>
              <h2>워치리스트 {watch.length}</h2>
              <ul className="anz__saves anz__watch">
                {watch.map((w) => (
                  <li key={w.ticker}>
                    <button
                      type="button"
                      aria-current={w.ticker === ticker ? "true" : undefined}
                      onClick={() => {
                        setTicker(w.ticker);
                        setPanelOpen(false);
                      }}
                    >
                      <span className="mono">{w.ticker}</span>
                      <span>{w.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="prac__penhint">
                <kbd>↑</kbd> <kbd>↓</kbd> 로 앞뒤 종목을 넘겨 봅니다.
              </p>
            </section>
          )}

          <section>
            <h2>봉 단위</h2>
            <div className="prac__grid prac__grid--three">
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
            {/*
              장전·장후 거래. 분·시간봉에서만 뜻이 있어 그때만 보입니다.
              야후는 1분·5분봉의 보관 기간이 짧습니다(7일·60일).
            */}
            {intraday && (
              <label className="anz__check">
                <input
                  type="checkbox"
                  checked={prepost}
                  onChange={(e) => setPrepost(e.target.checked)}
                />
                <span>장전·장후 거래 포함</span>
              </label>
            )}
          </section>

          <section>
            <h2>가격 눈금</h2>
            <div className="prac__grid prac__grid--three">
              {(
                [
                  ["normal", "보통", "가격 그대로"],
                  ["logarithm", "로그", "같은 % 가 같은 높이로 — 긴 기간을 볼 때"],
                  ["percentage", "%", "화면 왼쪽 끝 봉 대비 몇 % — 비교할 때"],
                ] as [YScale, string, string][]
              ).map(([k, label, hint]) => (
                <button
                  key={k}
                  type="button"
                  className="prac__tool"
                  aria-pressed={yScale === k}
                  title={hint}
                  onClick={() => setYScale(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            {/*
              트레이딩뷰 우클릭 메뉴의 "가격·봉 비율 고정" · "눈금 뒤집기".
              차트를 오른쪽 단추로 눌러도 같은 것이 뜹니다. 휴대폰엔 오른쪽
              단추가 없어 여기에도 둡니다.
            */}
            <label className="anz__check" title="확대·축소해도 선의 기울기와 봉 모양이 그대로입니다">
              <input
                type="checkbox"
                checked={priceLock}
                onChange={(e) => setPriceLock(e.target.checked)}
              />
              <span>가격·봉 비율 고정</span>
            </label>
            <label className="anz__check">
              <input
                type="checkbox"
                checked={invertScale}
                onChange={(e) => setInvertScale(e.target.checked)}
              />
              <span>눈금 뒤집기</span>
            </label>
          </section>

          <section className="prac__pen">
            <h2>
              {picked
                ? `${TOOL_NAME[picked.name] ?? picked.name} 색·굵기`
                : "펜"}
            </h2>
            <PenPicker color={penColor} size={penSize} onChange={applyPen} />
            {picked ? (
              <div className="prac__row prac__row--wrap">
                <button type="button" className="btn btn--ghost" onClick={clonePicked} title="Ctrl+D">
                  복제
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setLocked(picked.id, true)}
                  title="실수로 끌어 옮기지 않게 (Alt+L). 푸는 것은 아래 '그린 것' 목록에서"
                >
                  잠그기
                </button>
                {/* 세 단추가 한 줄이라 단축키 표시는 이름표로 뺍니다 — 붙이면 글자가 세로로 꺾입니다 */}
                <button type="button" className="btn btn--ghost prac__del" onClick={removePicked} title="Del">
                  지우기
                </button>
              </div>
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
            <h2>자석</h2>
            {/*
              선을 그을 때 고가·저가에 붙이기. "가까우면" 은 봉 가까이 갔을 때만,
              "늘" 은 어디를 누르든 가장 가까운 고가·저가에 붙습니다.
            */}
            <div className="prac__grid prac__grid--three">
              {(
                [
                  ["normal", "끔"],
                  ["weak_magnet", "가까우면"],
                  ["strong_magnet", "늘"],
                ] as [Magnet, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className="prac__tool"
                  aria-pressed={magnet === k}
                  onClick={() => setMagnet(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

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

          {(drawings.length > 0 || histLen.past > 0 || histLen.future > 0) && (
            <section>
              <h2>그린 것 {drawings.length}개</h2>
              <div className="prac__row">
                <button type="button" className="btn btn--ghost" onClick={undo} disabled={histLen.past === 0}>
                  되돌리기 <kbd>Ctrl+Z</kbd>
                </button>
                <button type="button" className="btn btn--ghost" onClick={redo} disabled={histLen.future === 0}>
                  다시 <kbd>Ctrl+Y</kbd>
                </button>
              </div>
              {/*
                하나씩 감추고·잠그고·지우는 목록. 잠긴 것은 차트에서 눌러도 안
                골라지므로 **푸는 일은 여기서만** 할 수 있습니다.
              */}
              {drawings.length > 0 && (
                <ul className="anz__drawlist">
                  {drawings.map((d, i) => {
                    const label = (TOOL_NAME[d.name] ?? d.name) + " " + (i + 1);
                    return (
                      <li key={d.id} aria-current={picked?.id === d.id ? "true" : undefined}>
                        <span className={d.hidden ? "anz__drawname is-off" : "anz__drawname"}>{label}</span>
                        <button
                          type="button"
                          className="anz__ico"
                          aria-pressed={d.hidden}
                          aria-label={label + (d.hidden ? " 보이기" : " 감추기")}
                          onClick={() => setHidden(d.id, !d.hidden)}
                        >
                          {d.hidden ? "보임" : "숨김"}
                        </button>
                        <button
                          type="button"
                          className="anz__ico"
                          aria-pressed={d.locked}
                          aria-label={label + (d.locked ? " 잠금 풀기" : " 잠그기")}
                          onClick={() => setLocked(d.id, !d.locked)}
                        >
                          {d.locked ? "풀기" : "잠금"}
                        </button>
                        <button
                          type="button"
                          className="anz__x"
                          aria-label={label + " 지우기"}
                          onClick={() => {
                            chart.current?.removeDrawing(d.id);
                            if (picked?.id === d.id) setPicked(null);
                            autoSave();
                          }}
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {drawings.length > 0 && (
                <button
                  type="button"
                  className="btn btn--ghost anz__wide"
                  onClick={() => {
                    chart.current?.clearDrawings();
                    setPicked(null);
                    autoSave();
                  }}
                >
                  모두 지우기 (되돌릴 수 있음)
                </button>
              )}
              {!reviewing && drawings.length > 0 && (
                <a className="btn btn--ghost anz__tonotes" href={"/notes?new=1&ticker=" + ticker}>
                  이 분석으로 매매 기록
                </a>
              )}
            </section>
          )}

          <IndicatorPanel
            active={activeInd}
            params={indParams}
            intraday={intraday}
            templates={templates}
            onToggle={toggleInd}
            onParams={setIndParams}
            onSaveTemplate={(name) => {
              const used = Object.fromEntries(
                savedInd.filter((k) => indParams[k]).map((k) => [k, indParams[k]]),
              );
              saveTemplate({ name, indicators: savedInd, params: used });
            }}
            onApplyTemplate={(t: IndTemplate) => {
              for (const [k, v] of Object.entries(t.params)) setIndParams(k, v);
              rememberInd("analyze", t.indicators.filter((k) => SPEC_BY_KEY.has(k)));
            }}
            onRemoveTemplate={removeTemplate}
          />

          <section>
            <h2>비교 종목</h2>
            {/*
              다른 종목을 % 로 겹칩니다. 화면 왼쪽 끝 봉에서 같이 출발하게
              맞추므로, 끌어 옮기면 "이 구간에서 누가 더 갔나" 가 바로 보입니다.
            */}
            <form
              className="anz__alertform"
              onSubmit={(e) => {
                e.preventDefault();
                addCompare(cmpInput);
              }}
            >
              <input
                className="anz__search mono"
                aria-label="비교할 종목 티커"
                placeholder="티커 (예: SPY)"
                value={cmpInput}
                onChange={(e) => setCmpInput(e.target.value)}
              />
              <button type="submit" className="btn btn--ghost" disabled={!cmpInput.trim() || compare.length >= 3}>
                겹치기
              </button>
            </form>
            {compare.length === 0 && (
              <div className="prac__row">
                {["SPY", "QQQ"]
                  .filter((t) => t !== ticker)
                  .map((t) => (
                    <button key={t} type="button" className="btn btn--ghost" onClick={() => addCompare(t)}>
                      + {t}
                    </button>
                  ))}
              </div>
            )}
            {compare.length > 0 && (
              <ul className="anz__saves">
                {compare.map((t, i) => (
                  <li key={t}>
                    <span className="anz__alertrow">
                      <i className="anz__swatch" style={{ background: COMPARE_COLORS[i] }} aria-hidden="true" />
                      <span className="mono">{t}</span>
                    </span>
                    <button
                      type="button"
                      className="anz__x"
                      aria-label={t + " 비교 빼기"}
                      onClick={() => setCompare(compare.filter((x) => x !== t))}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="prac__penhint">최대 3개. 눈금을 % 로 두면 견주기 쉽습니다.</p>
          </section>

          <section>
            <h2>화면 나누기</h2>
            <div className="prac__grid prac__grid--three">
              {([1, 2, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  className="prac__tool"
                  aria-pressed={layout === n}
                  onClick={() => setLayout(n)}
                >
                  {n === 1 ? "한 칸" : n + "칸"}
                </button>
              ))}
            </div>
            {layout > 1 && (
              <p className="prac__penhint">
                옆 칸은 봉 단위·지표·눈금을 본 차트와 같이 씁니다. 종목만 칸마다
                따로 — 칸 위 입력란에 티커를 넣고 Enter.
              </p>
            )}
          </section>

          {!reviewing && (
            <PriceAlerts ticker={ticker} lastPrice={last?.close ?? null} pickedLevel={pickedLevel} />
          )}

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

          {/*
            그어 둔 수평선이 닿았는지 되짚어 줍니다. 종목마다 다시 열어 보지
            않아도 되게 하려는 자리입니다 — 자세한 것은 그 파일 머리말에.
          */}
          <WatchLevels
            onPick={(t) => {
              setTicker(t);
              setPanelOpen(false);
            }}
          />

          <p className="prac__note">
            여기 그린 것은 <strong>내가 적어 둔 생각</strong>이지 이 사이트의
            의견이 아닙니다. 매수·매도 판단을 대신하지 않습니다.
          </p>
        </aside>

        {/*
          `<main>` 은 한 화면에 하나여야 합니다. 바깥 배치(`layout.tsx`)가
          이미 하나를 두고 있어 여기까지 `main` 으로 두면 둘이 됩니다 —
          화면 낭독기에서 "본문" 이 두 개가 됩니다.
        */}
        {/*
          화면 나누기. 본 차트는 늘 첫 칸에 그대로 두고 옆 칸만 붙였다 뗍니다 —
          본 차트를 새로 만들면 그리던 것과 지표가 날아갑니다.
        */}
        <section className={"prac__chart prac__chart--" + layout} aria-label="차트">
          <div
            className="prac__main"
            onContextMenu={openMenu}
            onPointerDown={(e) => {
              touchRef.current = e.pointerType === "touch";
            }}
          >
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
          {menu && (
            <ChartMenu
              menu={menu}
              lastPrice={last?.close ?? null}
              yScale={yScale}
              priceLock={priceLock}
              invert={invertScale}
              onClose={() => setMenu(null)}
              /* 회고 모드에서는 그어도 저장되지 않으므로 그리는 항목을 감춥니다 */
              onHLine={reviewing ? undefined : hlineAt}
              onAlert={alertAt}
              onReset={resetView}
              onAutoFit={() => chart.current?.autoFitPrice()}
              onScale={setYScale}
              onPriceLock={setPriceLock}
              onInvert={setInvertScale}
              onClone={reviewing ? undefined : clonePicked}
              onLock={reviewing ? undefined : (v) => menu.drawing && setLocked(menu.drawing.id, v)}
              onRemove={() => {
                if (!menu.drawing) return;
                chart.current?.removeDrawing(menu.drawing.id);
                setPicked(null);
                autoSave();
              }}
            />
          )}
          </div>
          {miniTickers.map((t, i) => (
            <MiniChart
              key={i}
              ticker={t}
              interval={tfNow.interval}
              range={tfNow.range}
              groupBy={tfNow.group}
              period={tfNow.period}
              prepost={usePrepost}
              indicators={indList}
              yScale={yScale}
              onTicker={(nt) => {
                const next = miniTickers.slice();
                next[i] = nt;
                setLayoutTickers(next);
              }}
              onPromote={() => {
                // 본 차트와 자리를 맞바꿉니다
                const next = miniTickers.slice();
                next[i] = ticker;
                setLayoutTickers(next);
                setTicker(t);
              }}
            />
          ))}

          {showKeys && (
            <div className="anz__keys" role="dialog" aria-label="단축키">
              <div className="anz__keyshead">
                <strong>단축키</strong>
                <button type="button" className="anz__x" aria-label="닫기" onClick={() => setShowKeys(false)}>
                  ✕
                </button>
              </div>
              <dl>
                {SHORTCUT_HELP.map(([k, v]) => (
                  <div key={k}>
                    <dt>
                      <kbd>{k}</kbd>
                    </dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="prac__penhint">한글 입력 상태에서도 됩니다. ? 로 열고 닫습니다.</p>
            </div>
          )}
        </section>
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
