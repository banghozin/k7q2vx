"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KLineData } from "klinecharts";
import { allTickers, nameOf } from "@/data/themes";
import { pct, tone } from "@/lib/format";
import { Kline, type KlineHandle } from "./kline";

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
/** 가린 뒤 열어볼 수 있는 최대 봉 개수 */
const FORWARD = 60;
/** 오른쪽에 앞날을 그릴 빈 자리 (px) */
const FUTURE_SPACE = 260;

const DRAW_TOOLS: { key: string; label: string; hint: string }[] = [
  { key: "segment", label: "추세선", hint: "두 점을 이어 선을 긋습니다" },
  { key: "horizontalStraightLine", label: "수평선", hint: "지지·저항 자리" },
  { key: "fibonacciLine", label: "피보나치", hint: "고점과 저점을 찍습니다" },
  { key: "priceChannelLine", label: "채널", hint: "세 점으로 평행 채널" },
  { key: "parallelStraightLine", label: "평행선", hint: "세 점으로 평행선" },
  { key: "rayLine", label: "반직선", hint: "한 방향으로 뻗는 선" },
  { key: "brush", label: "자유선", hint: "손으로 그리듯" },
  { key: "simpleAnnotation", label: "메모", hint: "파동 번호 등을 적을 때" },
];

// 짝수로 맞춥니다 — 2열 배치에서 홀수면 빈 칸이 남아 어설퍼 보입니다
const INDICATORS: { key: string; label: string; onCandle: boolean }[] = [
  { key: "MA", label: "이동평균", onCandle: true },
  { key: "BOLL", label: "볼린저", onCandle: true },
  { key: "VOL", label: "거래량", onCandle: false },
  { key: "MACD", label: "MACD", onCandle: false },
  { key: "RSI", label: "RSI", onCandle: false },
  { key: "KDJ", label: "스토캐스틱", onCandle: false },
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
  const [activeInd, setActiveInd] = useState<Set<string>>(new Set());
  const [chartReady, setChartReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  /* ── 한 판 새로 뽑기 ─────────────────────────────────────────── */
  const newRound = useCallback(async () => {
    setPhase("loading");
    setTool(null);
    setPanelOpen(false);
    setMyLinesOn(true);
    chart.current?.clearDrawings();

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

  useEffect(() => {
    if (chartReady && feed.length) {
      chart.current?.setData(feed);
      // 앞날을 그릴 빈 자리는 아직 안 연 구간에서만 넓게 둡니다
      chart.current?.setFutureSpace(
        phase === "draw" ? FUTURE_SPACE : Math.max(40, FUTURE_SPACE - shown * 6),
      );
    }
  }, [chartReady, feed, phase, shown]);

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

  function reveal(steps: number) {
    setPhase("reveal");
    setShown((s) => Math.min(FORWARD, Math.max(s, steps)));
    if (phase === "draw") setRounds((r) => r + 1);
  }

  function toggleMyLines() {
    const next = !myLinesOn;
    setMyLinesOn(next);
    chart.current?.setDrawingsVisible(next);
  }

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
          <button type="button" className="btn" onClick={() => void newRound()}>
            새 문제
          </button>
        </div>
      </header>

      <div className="prac__body">
        <aside className={`prac__tools${panelOpen ? " is-open" : ""}`}>
          <section>
            <h2>그리기</h2>
            <div className="prac__grid">
              {DRAW_TOOLS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="prac__tool"
                  aria-pressed={tool === t.key}
                  title={t.hint}
                  onClick={() => {
                    setTool(t.key);
                    chart.current?.startDraw(t.key);
                    setPanelOpen(false);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="prac__row">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => chart.current?.undo()}
              >
                되돌리기
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => chart.current?.clearDrawings()}
              >
                모두 지우기
              </button>
            </div>
          </section>

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
          <Kline ref={chart} onReady={() => setChartReady(true)} />
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
