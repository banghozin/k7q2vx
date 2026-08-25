"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KLineData } from "klinecharts";
import { allTickers, nameOf } from "@/data/themes";
import { pct, tone } from "@/lib/format";
import { Kline, type KlineHandle } from "./kline";

/**
 * 차트 훈련.
 *
 * 과거 어느 날로 돌아가 **그 뒤를 가린 채** 분석하고, 한 봉씩 넘기며 실제로
 * 어떻게 됐는지 확인합니다. 종목 이름은 정답을 볼 때까지 감춥니다 — 이름을
 * 알면 기억이 개입해서 훈련이 되지 않습니다.
 *
 * 여기서 매기는 점수는 **본인 판단의 기록**이지 어떤 종목을 사라는 말이
 * 아닙니다. 맞고 틀림도 그 구간에서 그랬다는 사실일 뿐입니다.
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
/** 정답 구간에서 넘겨볼 수 있는 최대 봉 개수 */
const FORWARD = 60;
/** 판단을 물어보는 기준이 되는 앞날 (거래일) */
const HORIZON = 20;

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

type Phase = "loading" | "guess" | "reveal" | "error";
type Guess = "up" | "down" | null;

type Round = {
  ticker: string;
  name: string;
  bars: Bar[];
  /** 가린 지점 — bars[cut-1] 까지 보여줍니다 */
  cut: number;
};

type Score = { total: number; hit: number };

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
  const [guess, setGuess] = useState<Guess>(null);
  const [score, setScore] = useState<Score>({ total: 0, hit: 0 });
  const [tool, setTool] = useState<string | null>(null);
  const [activeInd, setActiveInd] = useState<Set<string>>(new Set());
  const [chartReady, setChartReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  /* ── 한 판 새로 뽑기 ─────────────────────────────────────────── */
  const newRound = useCallback(async () => {
    setPhase("loading");
    setGuess(null);
    setTool(null);
    setPanelOpen(false);

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
        setPhase("guess");
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
    if (chartReady && feed.length) chart.current?.setData(feed);
  }, [chartReady, feed]);

  /* ── 판정 ────────────────────────────────────────────────────── */
  const verdict = useMemo(() => {
    if (!round || phase !== "reveal") return null;
    const at = round.bars[round.cut - 1]?.close;
    const after = round.bars[Math.min(round.cut - 1 + HORIZON, round.bars.length - 1)]?.close;
    if (at == null || after == null || at <= 0) return null;
    const change = ((after - at) / at) * 100;
    const actual: Guess = change >= 0 ? "up" : "down";
    return { change, actual, correct: guess != null && guess === actual };
  }, [round, phase, guess]);

  function submit(g: Exclude<Guess, null>) {
    if (!round) return;
    setGuess(g);
    setPhase("reveal");
    const at = round.bars[round.cut - 1]?.close ?? 0;
    const after =
      round.bars[Math.min(round.cut - 1 + HORIZON, round.bars.length - 1)]?.close ?? 0;
    const actual: Guess = after >= at ? "up" : "down";
    setScore((s) => ({ total: s.total + 1, hit: s.hit + (g === actual ? 1 : 0) }));
    setShown(HORIZON);
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
            <b>{cutDate}</b> 까지
          </span>
          {score.total > 0 && (
            <span>
              맞힘 <b>{score.hit}</b>/{score.total}
            </span>
          )}
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

          <section className="prac__meta">
            <h2>이번 판</h2>
            <dl>
              <div>
                <dt>가린 날</dt>
                <dd className="mono">{cutDate || "—"}</dd>
              </div>
              <div>
                <dt>보이는 봉</dt>
                <dd className="mono">{VISIBLE + shown}개</dd>
              </div>
              <div>
                <dt>판정 기준</dt>
                <dd className="mono">{HORIZON}거래일 뒤</dd>
              </div>
              <div>
                <dt>누적</dt>
                <dd className="mono">
                  {score.total > 0 ? `${score.hit} / ${score.total}` : "아직 없음"}
                </dd>
              </div>
            </dl>
          </section>

          <p className="prac__note">
            그린 선과 지표는 <strong>판단을 돕는 도구</strong>일 뿐입니다. 여기
            결과는 그 구간에서 그랬다는 기록이지, 어떤 종목을 사라는 뜻이
            아닙니다.
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
        {phase === "guess" && (
          <>
            <span className="prac__ask">
              가린 지점부터 <b>{HORIZON}거래일</b> 뒤, 어느 쪽일까요?
            </span>
            <div className="prac__choice">
              <button
                type="button"
                className="btn prac__up"
                onClick={() => submit("up")}
              >
                오른다
              </button>
              <button
                type="button"
                className="btn prac__down"
                onClick={() => submit("down")}
              >
                내린다
              </button>
            </div>
          </>
        )}

        {phase === "reveal" && verdict && (
          <>
            <span className={`prac__result ${verdict.correct ? "is-hit" : "is-miss"}`}>
              {verdict.correct ? "맞혔습니다" : "빗나갔습니다"}
            </span>
            <span className="prac__ask mono">
              {HORIZON}거래일 뒤{" "}
              <b className={tone(verdict.change)}>{pct(verdict.change)}</b>
            </span>
            <div className="prac__choice">
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!canStep}
                onClick={() => setShown((s) => Math.min(FORWARD, s + 1))}
              >
                한 봉 더
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
