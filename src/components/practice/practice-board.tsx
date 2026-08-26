"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KLineData } from "klinecharts";
import { allTickers, nameOf } from "@/data/themes";
import { pct, tone } from "@/lib/format";
import { usePractice } from "@/lib/store/practice-store";
import { Kline, type KlineHandle, type Pen } from "./kline";
import { PracticeLog } from "./practice-log";

/**
 * 차트 훈련.
 *
 * 과거 어느 날로 돌아가 **그 뒤를 가린 채** 분석선을 긋고, 실제 캔들을
 * 그 위로 지나가게 해서 **내 분석이 실제와 얼마나 맞았는지 눈으로 봅니다.**
 *
 * "오를까 내릴까" 이지선다가 아닙니다. 그건 동전 던지기와 다를 게 없고
 * 차트를 읽는 실력과도 상관이 적습니다. 여기서 보는 것은
 *   - 내가 그은 추세선을 실제 가격이 지켰는가, 뚫었는가
 *   - 내가 찍은 피보나치 되돌림 자리에서 실제로 멈췄는가
 *   - 내가 그린 예상 경로와 실제 경로가 얼마나 겹치는가
 * 입니다. 그래서 오른쪽에 **앞날을 그릴 빈 자리**를 미리 만들어 둡니다.
 *
 * 종목 이름은 실제를 열 때까지 감춥니다 — 이름을 알면 기억이 개입해서
 * 훈련이 되지 않습니다.
 *
 * 여기 결과는 그 구간에서 그랬다는 기록이지 어떤 종목을 사라는 말이 아닙니다.
 */

type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** 처음에 보여줄 봉 개수 */
const VISIBLE = 180;
/**
 * 가린 뒤 열어볼 수 있는 최대 봉 개수.
 *
 * 60봉(석 달)은 "그래서 어떻게 됐나"를 보기에 짧았습니다. 내가 그은 추세선이
 * 결국 지켜졌는지, 파동이 어디서 끝났는지는 **반년쯤** 지나야 모양이 납니다.
 * 그래서 120봉으로 늘렸습니다.
 */
const FORWARD = 120;
/** 오른쪽에 앞날을 그릴 빈 자리 (px) */
const FUTURE_SPACE = 260;

/**
 * 그리기 도구.
 *
 * `elliott*` 과 `fibRetracement` 는 직접 만든 것입니다 — overlays.ts 참고.
 * 기본 피보나치는 선이 화면 끝까지 뻗고 라벨이 왼쪽에 뭉쳐 붙어서
 * 실제 분석 화면과 딴판이라 새로 만들었습니다.
 */
const DRAW_GROUPS: {
  title: string;
  tools: { key: string; label: string; hint: string }[];
}[] = [
  {
    title: "파동",
    tools: [
      { key: "elliottImpulse", label: "12345 파동", hint: "출발점부터 여섯 점. 1~5 번호가 자동으로 붙습니다" },
      { key: "elliottCorrection", label: "ABC 조정", hint: "출발점부터 네 점. Z 자로 긋습니다" },
      { key: "elliottTriangle", label: "abcde 삼각형", hint: "출발점부터 여섯 점. 폭이 좁아지게 긋습니다" },
      { key: "fibRetracement", label: "피보나치", hint: "고점과 저점 두 점. 찍은 구간에만 그려집니다" },
    ],
  },
  {
    title: "선",
    tools: [
      { key: "segment", label: "추세선", hint: "찍은 두 점 사이만" },
      { key: "straightLine", label: "연장선", hint: "양쪽으로 끝없이 뻗습니다" },
      { key: "rayLine", label: "반직선", hint: "한쪽으로만 뻗습니다" },
      { key: "horizontalStraightLine", label: "수평선", hint: "지지·저항 자리" },
      { key: "priceChannelLine", label: "채널", hint: "세 점으로 평행 채널" },
      { key: "parallelStraightLine", label: "평행선", hint: "세 점으로 평행선" },
      { key: "freeCurve", label: "자유곡선", hint: "누른 채로 끌면 그려집니다" },
      { key: "simpleAnnotation", label: "메모", hint: "글자를 적습니다" },
    ],
  },
];

/** 도구 이름 → 목록에 보여줄 한국어 */
const TOOL_NAME: Record<string, string> = Object.fromEntries(
  DRAW_GROUPS.flatMap((g) => g.tools.map((t) => [t.key, t.label])),
);

// 짝수로 맞춥니다 — 2열 배치에서 홀수면 빈 칸이 남아 어설퍼 보입니다
const INDICATORS: { key: string; label: string; onCandle: boolean }[] = [
  { key: "MA", label: "이동평균", onCandle: true },
  { key: "BOLL", label: "볼린저", onCandle: true },
  { key: "VOL", label: "거래량", onCandle: false },
  { key: "MACD", label: "MACD", onCandle: false },
  { key: "RSI", label: "RSI", onCandle: false },
  { key: "KDJ", label: "스토캐스틱", onCandle: false },
];

/**
 * 고를 수 있는 색.
 *
 * 어두운 바탕에서 서로 구분되고 캔들(빨강·파랑)과도 헷갈리지 않는 것으로
 * 골랐습니다. 색이 많으면 화면만 시끄러워지므로 여섯으로 끊었습니다.
 */
const PENS: { color: string; label: string }[] = [
  { color: "#c8a15a", label: "황동" },
  { color: "#e9e5dd", label: "흰빛" },
  { color: "#7fa86b", label: "풀색" },
  { color: "#5bc8d6", label: "하늘" },
  { color: "#d97fb8", label: "자주" },
  { color: "#f0a23c", label: "주황" },
];

/** 굵기 세 단계면 충분합니다 */
const WIDTHS: { size: number; label: string }[] = [
  { size: 1, label: "얇게" },
  { size: 2, label: "보통" },
  { size: 3.5, label: "굵게" },
];

type Phase = "loading" | "draw" | "reveal" | "error";

type Round = {
  ticker: string;
  name: string;
  bars: Bar[];
  /** 가린 지점 — bars[cut-1] 까지 보여줍니다 */
  cut: number;
};

const fmtDate = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

export function PracticeBoard() {
  const chart = useRef<KlineHandle>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [shown, setShown] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [myLinesOn, setMyLinesOn] = useState(true);
  const [tool, setTool] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<{ id: string; name: string }[]>([]);
  const [activeInd, setActiveInd] = useState<Set<string>>(new Set());
  const [chartReady, setChartReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [penColor, setPenColor] = useState(PENS[0].color);
  const [penSize, setPenSize] = useState(2);
  /** 클릭해서 고른, 이미 그려진 것 */
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(
    null,
  );
  /** 같은 판을 두 번 저장하지 않게 */
  const [saved, setSaved] = useState(false);

  const sessions = usePractice((s) => s.sessions);
  const addSession = usePractice((s) => s.add);

  /* ── 한 판 새로 뽑기 ─────────────────────────────────────────── */
  const newRound = useCallback(async () => {
    setPhase("loading");
    setTool(null);
    setPanelOpen(false);
    setLogOpen(false);
    setSaved(false);
    setMyLinesOn(true);
    chart.current?.clearDrawings();
    setDrawings([]);

    const pool = allTickers();
    // 여러 번 시도합니다 — 상장이 짧은 종목은 훈련에 쓸 수 없습니다
    for (let attempt = 0; attempt < 6; attempt++) {
      const ticker = pool[Math.floor(Math.random() * pool.length)];
      try {
        const r = await fetch(
          `/api/chart?ticker=${encodeURIComponent(ticker)}&interval=1d&range=10y`,
        );
        if (!r.ok) continue;
        const j = (await r.json()) as { candles: Bar[] };
        const bars = j.candles ?? [];
        if (bars.length < VISIBLE + FORWARD + 40) continue;

        // 가릴 지점을 무작위로 고릅니다. 뒤로 FORWARD 개는 남겨 둡니다.
        const min = VISIBLE;
        const max = bars.length - FORWARD;
        const cut = min + Math.floor(Math.random() * Math.max(1, max - min));

        setRound({
          ticker,
          name: nameOf(ticker) ?? ticker,
          bars,
          cut,
        });
        setShown(0);
        setPhase("draw");
        return;
      } catch {
        // 다음 종목으로
      }
    }
    setPhase("error");
  }, []);

  useEffect(() => {
    void newRound();
  }, [newRound]);

  /* ── 차트에 넣을 봉 ──────────────────────────────────────────── */
  const feed: KLineData[] = useMemo(() => {
    if (!round) return [];
    const end = round.cut + shown;
    return round.bars.slice(Math.max(0, round.cut - VISIBLE), end).map((b) => ({
      timestamp: b.time * 1000,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));
  }, [round, shown]);

  // 앞날을 그릴 빈 자리는 아직 안 연 구간에서만 넓게 둡니다
  const futureSpace =
    phase === "draw" ? FUTURE_SPACE : Math.max(40, FUTURE_SPACE - shown * 6);

  useEffect(() => {
    if (chartReady && feed.length) {
      chart.current?.setData(feed);
      chart.current?.setFutureSpace(futureSpace);
    }
  }, [chartReady, feed, futureSpace]);

  /*
   * 새 문제를 열 때 화면 폭에 맞는 봉 수로 맞춥니다.
   *
   * 봉 간격을 고정해 두면 넓은 화면에서는 180봉이 잘 들어오지만 휴대폰에서는
   * 스무 개 남짓만 보여 분석 자체가 불가능합니다. 반대로 좁은 화면에 180봉을
   * 다 우겨넣으면 봉 하나가 1px 이 되어 이번엔 선을 그을 수가 없습니다.
   * 그래서 좁으면 최근 70봉만 보여 줍니다 — 일봉 기준 석 달 남짓입니다.
   *
   * 봉 간격을 바꾸면 오른쪽 빈 자리가 초기화되므로 **맞춘 뒤 다시** 줍니다.
   */
  useEffect(() => {
    if (!chartReady || !round) return;
    const w = chart.current?.width() ?? 0;
    if (w === 0) return;
    chart.current?.fitAll(w < 640 ? 70 : VISIBLE);
    chart.current?.setFutureSpace(futureSpace);
    // 새 문제에서만 맞춥니다 — 여는 도중에 자꾸 배율이 바뀌면 어지럽습니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, round]);

  /*
   * 열 때마다 **뒤로 물러나 큰 그림이 보이게** 합니다.
   *
   * 이게 없으면 봉을 열어도 배율이 그대로라 새 봉들이 오른쪽 밖으로 밀려
   * 조금밖에 안 보입니다. 훈련의 목적이 "내가 그은 선 위로 실제가 어떻게
   * 지나갔나"를 보는 것이므로, 열린 만큼 화면을 넓혀야 합니다.
   */
  useEffect(() => {
    if (!chartReady || !round || phase !== "reveal") return;
    const w = chart.current?.width() ?? 0;
    if (w === 0) return;
    const past = w < 640 ? 70 : VISIBLE;
    chart.current?.fitAll(past + shown);
    chart.current?.setFutureSpace(futureSpace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, phase, shown]);

  /* ── 실제와 대조 ─────────────────────────────────────────────── */

  /**
   * 열린 구간에서 벌어진 일. 판정이 아니라 **사실**입니다.
   * 내가 그은 선과 견주어 볼 수 있게 고점·저점·변화율을 그대로 적습니다.
   */
  const actual = useMemo(() => {
    if (!round || phase !== "reveal" || shown === 0) return null;
    const base = round.bars[round.cut - 1]?.close;
    const seg = round.bars.slice(round.cut, round.cut + shown);
    if (base == null || base <= 0 || seg.length === 0) return null;
    const high = Math.max(...seg.map((b) => b.high));
    const low = Math.min(...seg.map((b) => b.low));
    const last = seg[seg.length - 1].close;
    return {
      base,
      high,
      low,
      last,
      change: ((last - base) / base) * 100,
      maxUp: ((high - base) / base) * 100,
      maxDown: ((low - base) / base) * 100,
      days: seg.length,
    };
  }, [round, phase, shown]);

  /**
   * 내가 그은 수평선을 실제 가격이 건드렸는가.
   * 지지·저항을 어디에 뒀는지 스스로 대조해 보라는 것이지, 잘했다 못했다를
   * 매기는 것이 아닙니다.
   */
  const levelCheck = useMemo(() => {
    if (!actual) return [];
    const levels = chart.current?.horizontalLevels() ?? [];
    return levels.map((price) => ({
      price,
      touched: price >= actual.low && price <= actual.high,
    }));
  }, [actual]);

  /**
   * 이 판을 기록으로 남깁니다.
   *
   * 잘했다 못했다를 매기지 않습니다. **무엇을 그었고 그 구간에 무슨 일이
   * 있었는지**만 적습니다. 쌓이면 "나는 추세선만 긋는구나" 같은 것을 스스로
   * 볼 수 있고, 그게 이 훈련이 매매로 이어지는 지점입니다.
   */
  function saveRound() {
    if (!round || !actual || saved) return;
    const tools: Record<string, number> = {};
    for (const d of chart.current?.listDrawings() ?? []) {
      const label = TOOL_NAME[d.name] ?? d.name;
      tools[label] = (tools[label] ?? 0) + 1;
    }
    addSession({
      ticker: round.ticker,
      name: round.name,
      cutDate,
      base: actual.base,
      opened: actual.days,
      change: actual.change,
      maxUp: actual.maxUp,
      maxDown: actual.maxDown,
      tools,
      levelsTouched: levelCheck.filter((l) => l.touched).length,
      levelsTotal: levelCheck.length,
      memo: "",
    });
    setSaved(true);
  }

  function reveal(steps: number) {
    setPhase("reveal");
    setShown((s) => Math.min(FORWARD, Math.max(s, steps)));
    if (phase === "draw") setRounds((r) => r + 1);
  }

  // 봉을 더 열면 숫자가 달라지므로 다시 남길 수 있게 합니다 (같은 판은 덮어씀)
  useEffect(() => {
    setSaved(false);
  }, [shown]);

  function toggleMyLines() {
    const next = !myLinesOn;
    setMyLinesOn(next);
    chart.current?.setDrawingsVisible(next);
  }

  const refreshDrawings = useCallback(() => {
    setDrawings(chart.current?.listDrawings() ?? []);
  }, []);

  /** 봉 전체가 한 화면에 들어오게 맞춥니다 */
  const fitAll = useCallback(() => {
    chart.current?.fitAll(VISIBLE + shown);
  }, [shown]);

  const undo = useCallback(() => {
    chart.current?.undo();
    setPicked(null);
    refreshDrawings();
  }, [refreshDrawings]);

  /*
   * PC 에서는 Ctrl+Z(맥은 ⌘Z)로도 되돌립니다. 그림을 그리다 보면 손이 먼저
   * 그리로 갑니다. 글자를 치는 칸에 있을 때는 가로채지 않습니다 — 메모를
   * 쓰다가 되돌리기가 걸리면 곤란합니다.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  /** 고른 것의 색·굵기를 바꿉니다. 아무것도 안 골랐으면 다음에 그릴 펜만 바꿉니다 */
  const applyPen = useCallback(
    (color: string, size: number) => {
      setPenColor(color);
      setPenSize(size);
      if (picked) chart.current?.restyle(picked.id, { color, size });
    },
    [picked],
  );

  const cutDate = round
    ? fmtDate.format(new Date((round.bars[round.cut - 1]?.time ?? 0) * 1000))
    : "";

  const canStep = round ? shown < FORWARD : false;

  /* ── 화면 ────────────────────────────────────────────────────── */
  return (
    <div className="prac">
      <header className="prac__bar">
        <div className="prac__id">
          <span className="prac__eyebrow">차트 훈련</span>
          {phase === "reveal" && round ? (
            <span className="prac__name mono">
              {round.ticker}
              <span className="prac__namekr">{round.name}</span>
            </span>
          ) : (
            <span className="prac__name prac__name--hidden">
              종목 가림
              <span className="prac__namekr">정답을 열면 나옵니다</span>
            </span>
          )}
        </div>

        <div className="prac__stat mono">
          <span>
            <b>{cutDate}</b> 까지 보임
          </span>
          {phase === "reveal" && shown > 0 && (
            <span>
              +<b>{shown}</b>봉 열림
            </span>
          )}
          {rounds > 0 && <span>{rounds}번째 문제</span>}
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
            title="봉 전체가 한 화면에 들어오게 맞춥니다"
            onClick={fitAll}
          >
            전체 보기
          </button>
          {sessions.length > 0 && (
            <button
              type="button"
              className="btn btn--ghost"
              aria-expanded={logOpen}
              onClick={() => setLogOpen((v) => !v)}
            >
              기록 <b className="mono">{sessions.length}</b>
            </button>
          )}
          <button type="button" className="btn" onClick={() => void newRound()}>
            새 문제
          </button>
        </div>
      </header>

      <div className="prac__body">
        <aside className={`prac__tools${panelOpen ? " is-open" : ""}`}>
          {/*
            펜은 도구보다 위에 둡니다. 색을 먼저 고르고 그리는 순서가
            자연스럽고, 이미 그은 선을 클릭해 고른 상태면 그 선이 바로
            바뀝니다 — 같은 자리에서 두 가지를 다 합니다.
          */}
          <section className="prac__pen">
            <h2>{picked ? `${TOOL_NAME[picked.name] ?? picked.name} 색·굵기` : "펜"}</h2>
            <div className="prac__swatches">
              {PENS.map((p) => (
                <button
                  key={p.color}
                  type="button"
                  className="prac__swatch"
                  style={{ background: p.color }}
                  aria-label={p.label}
                  aria-pressed={penColor === p.color}
                  title={p.label}
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
            <p className="prac__penhint">
              {picked
                ? "고른 선에 바로 적용됩니다. 빈 곳을 누르면 선택이 풀립니다."
                : "그려 둔 선을 눌러 고르면 그 선의 색·굵기를 바꿉니다."}
            </p>
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
                      setTool(t.key);
                      chart.current?.startDraw(t.key, {
                        color: penColor,
                        size: penSize,
                      });
                      setPanelOpen(false);
                      // 그리고 나면 목록이 바뀌므로 조금 뒤 새로고침합니다
                      setTimeout(refreshDrawings, 400);
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
              <ul className="prac__drawn">
                {drawings.map((d) => (
                  <li key={d.id}>
                    <span>{TOOL_NAME[d.name] ?? d.name}</span>
                    <button
                      type="button"
                      aria-label={`${TOOL_NAME[d.name] ?? d.name} 지우기`}
                      onClick={() => {
                        chart.current?.removeDrawing(d.id);
                        refreshDrawings();
                      }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="prac__row">
                <button
                  type="button"
                  className="btn btn--ghost"
                  title="Ctrl+Z 로도 됩니다"
                  onClick={undo}
                >
                  되돌리기 <kbd>Ctrl+Z</kbd>
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    chart.current?.clearDrawings();
                    refreshDrawings();
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
              {INDICATORS.map((i) => (
                <button
                  key={i.key}
                  type="button"
                  className="prac__tool"
                  aria-pressed={activeInd.has(i.key)}
                  onClick={() => {
                    const on = chart.current?.toggleIndicator(i.key, i.onCandle);
                    setActiveInd((prev) => {
                      const next = new Set(prev);
                      if (on) next.add(i.key);
                      else next.delete(i.key);
                      return next;
                    });
                  }}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </section>

          {actual && (
            <section className="prac__meta">
              <h2>열린 구간의 사실</h2>
              <dl>
                <div>
                  <dt>가린 날 종가</dt>
                  <dd className="mono">{actual.base.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>{actual.days}봉 뒤</dt>
                  <dd className={`mono ${tone(actual.change)}`}>
                    {pct(actual.change)}
                  </dd>
                </div>
                <div>
                  <dt>가장 높이</dt>
                  <dd className="mono up">{pct(actual.maxUp)}</dd>
                </div>
                <div>
                  <dt>가장 낮게</dt>
                  <dd className="mono down">{pct(actual.maxDown)}</dd>
                </div>
              </dl>

              {levelCheck.length > 0 && (
                <>
                  <h2 style={{ marginTop: "0.9rem" }}>내가 그은 수평선</h2>
                  <ul className="prac__levels">
                    {levelCheck.map((l, i) => (
                      <li key={i}>
                        <span className="mono">{l.price.toFixed(2)}</span>
                        <span className={l.touched ? "up" : ""}>
                          {l.touched ? "닿았음" : "안 닿음"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <button
                type="button"
                className="btn btn--ghost prac__save"
                disabled={saved}
                onClick={saveRound}
              >
                {saved ? "기록에 남겼습니다" : "이 판 기록에 남기기"}

              </button>
              <p className="prac__savenote">
                이 기기에만 저장됩니다. 서버로 가지 않습니다.
              </p>
            </section>
          )}

          <p className="prac__note">
            여기 숫자는 <strong>그 구간에서 그랬다는 사실</strong>이지 잘했다
            못했다는 평가가 아닙니다. 어떤 종목을 사라는 뜻은 더더욱 아닙니다.
          </p>
        </aside>

        <main className="prac__chart">
          {phase === "loading" && (
            <div className="prac__overlay">과거 차트를 뽑는 중입니다…</div>
          )}
          {phase === "error" && (
            <div className="prac__overlay">
              쓸 만한 구간을 못 찾았습니다.{" "}
              <button
                type="button"
                className="btn"
                onClick={() => void newRound()}
              >
                다시 시도
              </button>
            </div>
          )}
          <Kline
            ref={chart}
            onReady={() => setChartReady(true)}
            onSelect={setPicked}
          />
          {logOpen && <PracticeLog onClose={() => setLogOpen(false)} />}
        </main>
      </div>

      <footer className="prac__foot">
        {phase === "draw" && (
          <>
            <span className="prac__ask">
              오른쪽 <b>빈 자리</b>에 앞날을 그려 보세요. 추세선을 뻗거나,
              피보나치를 찍거나, 갈 길을 그려 두면 됩니다.
            </span>
            <div className="prac__choice">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => reveal(5)}
              >
                5봉만 열기
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => reveal(20)}
              >
                실제 보기
              </button>
            </div>
          </>
        )}

        {phase === "reveal" && (
          <>
            <span className="prac__ask">
              내가 그은 선 위로 <b>실제 캔들</b>이 지나갑니다. 지켰는지, 뚫었는지
              눈으로 보세요.
            </span>
            <div className="prac__choice">
              <button
                type="button"
                className="btn btn--ghost"
                aria-pressed={!myLinesOn}
                onClick={toggleMyLines}
              >
                {myLinesOn ? "내 선 감추기" : "내 선 보이기"}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!canStep}
                onClick={() => setShown((s) => Math.min(FORWARD, s + 5))}
              >
                5봉 더
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!canStep}
                onClick={() => setShown(FORWARD)}
              >
                끝까지
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void newRound()}
              >
                다음 문제
              </button>
            </div>
          </>
        )}
      </footer>
    </div>
  );
}
