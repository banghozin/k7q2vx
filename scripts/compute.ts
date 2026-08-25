/**
 * 수집한 일봉으로 사이트가 쓸 숫자를 계산합니다.
 *
 *   .cache/prices.json  →  src/data/generated/{stocks,layers,sync,leaders}.json
 *
 * 여기 있는 것은 전부 **과거 기록의 요약**입니다. 예측이나 매매 판단이 아닙니다.
 * 실행: npm run compute
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { THEMES } from "../src/data/themes";
import { isPeripheral } from "../src/data/peripheral";
import type { Bar, Series } from "./lib/yahoo";
import { BENCHMARKS } from "./lib/universe";

const IN = ".cache/prices.json";
const OUT_DIR = "src/data/generated";

/* ------------------------------------------------------------------ *
 * 이상치 방어
 *
 * 우리는 수정 종가(분할·배당 반영)를 쓰므로 분할 때문에 튀는 일은 거의 없다.
 * 따라서 stock_program 이 쓰던 좁은 상한(1일 ±15%)을 그대로 쓰면 오히려
 * VKTX 임상 발표 같은 **진짜 급등을 데이터 오류로 오해해 지워버린다.**
 * 여기서는 "사람이 봐도 말이 안 되는" 수준만 걸러낸다.
 * ------------------------------------------------------------------ */
const GUARD: Record<number, number> = { 1: 80, 5: 150, 20: 400, 60: 800 };

const round = (n: number, d = 2) => {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
};

/** unix seconds → YYYY-MM-DD. 미국 일봉은 UTC 기준 같은 날이라 UTC 로 잘라도 안전하다. */
function dateKey(t: number): string {
  return new Date(t * 1000).toISOString().slice(0, 10);
}

/** n거래일 전 대비 수익률(%). 데이터가 모자라거나 말이 안 되면 null. */
function changeOver(bars: Bar[], n: number): number | null {
  const i = bars.length - 1 - n;
  if (i < 0) return null;
  const past = bars[i].a;
  const now = bars[bars.length - 1].a;
  if (!(past > 0)) return null;
  const pct = ((now - past) / past) * 100;
  if (!Number.isFinite(pct)) return null;
  const guard = GUARD[n] ?? 800;
  if (Math.abs(pct) > guard) return null;
  return round(pct);
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

/** 피어슨 상관. 표본이 적거나 분산이 0이면 null. */
function corr(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 30) return null;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  const r = num / Math.sqrt(dx * dy);
  return Number.isFinite(r) ? round(r, 4) : null;
}

/** 값들을 테마 안에서 순위로 0~1 정규화. 큰 값이 1. */
function rankNormalize(values: (number | null)[]): number[] {
  const idx = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null);
  const out = new Array(values.length).fill(0);
  if (idx.length <= 1) {
    for (const x of idx) out[x.i] = 0.5;
    return out;
  }
  idx.sort((a, b) => a.v - b.v);
  idx.forEach((x, rank) => {
    out[x.i] = rank / (idx.length - 1);
  });
  return out;
}

/* ------------------------------------------------------------------ */

type PriceFile = {
  fetchedAt: string;
  range: string;
  series: Series[];
  failed: { ticker: string; reason: string }[];
};

type StockMetrics = {
  last: number | null;
  ret1: number | null;
  ret5: number | null;
  ret20: number | null;
  ret60: number | null;
  /** SPY 대비 20일 초과수익률(%p) */
  rs20: number | null;
  /** 20일 평균 거래대금 (달러) */
  dollarVol: number | null;
  /** 최근 거래량 / 20일 평균 거래량 */
  volRatio: number | null;
  /** 52주 범위에서의 위치 0~1 */
  pos52: number | null;
  /** 확보된 봉 개수 — 표본이 짧은 종목을 화면에서 구분하기 위해 */
  bars: number;
};

async function main() {
  const raw = await readFile(IN, "utf8").catch(() => {
    console.error(
      `[compute] ${IN} 이 없습니다. 먼저 \`npm run fetch\` 를 실행하세요.`,
    );
    process.exit(1);
  });
  const price = JSON.parse(raw as string) as PriceFile;

  const byTicker = new Map<string, Bar[]>();
  for (const s of price.series) byTicker.set(s.ticker, s.bars);

  /** 티커별 일간수익률 맵 (날짜 → %) */
  const dailyByTicker = new Map<string, Map<string, number>>();
  for (const [t, bars] of byTicker) {
    const m = new Map<string, number>();
    for (let i = 1; i < bars.length; i++) {
      const prev = bars[i - 1].a;
      const cur = bars[i].a;
      if (!(prev > 0)) continue;
      const r = ((cur - prev) / prev) * 100;
      if (!Number.isFinite(r) || Math.abs(r) > GUARD[1]) continue;
      m.set(dateKey(bars[i].t), round(r, 3));
    }
    dailyByTicker.set(t, m);
  }

  /* ── 1. 종목별 지표 ─────────────────────────────────────────── */

  const spy = byTicker.get("SPY");
  const spyRet20 = spy ? changeOver(spy, 20) : null;

  const stocks: Record<string, StockMetrics> = {};
  for (const [t, bars] of byTicker) {
    const last = bars.at(-1)?.c ?? null;
    const ret20 = changeOver(bars, 20);

    const recent = bars.slice(-20);
    const dv = recent.length
      ? mean(recent.map((b) => b.c * b.v).filter((x) => Number.isFinite(x)))
      : null;
    const avgVol = recent.length ? mean(recent.map((b) => b.v)) : null;
    const lastVol = bars.at(-1)?.v ?? 0;

    const yr = bars.slice(-252).map((b) => b.a);
    const hi = yr.length ? Math.max(...yr) : null;
    const lo = yr.length ? Math.min(...yr) : null;
    const cur = bars.at(-1)?.a ?? null;

    stocks[t] = {
      last: last != null ? round(last) : null,
      ret1: changeOver(bars, 1),
      ret5: changeOver(bars, 5),
      ret20,
      ret60: changeOver(bars, 60),
      rs20: ret20 != null && spyRet20 != null ? round(ret20 - spyRet20) : null,
      dollarVol: dv != null ? Math.round(dv) : null,
      volRatio:
        avgVol != null && avgVol > 0 ? round(lastVol / avgVol) : null,
      pos52:
        hi != null && lo != null && cur != null && hi > lo
          ? round((cur - lo) / (hi - lo), 3)
          : null,
      bars: bars.length,
    };
  }

  const asOf = spy?.at(-1) ? dateKey(spy.at(-1)!.t) : dateKey(Date.now() / 1000);

  /* ── 2. 대장주 판별 ──────────────────────────────────────────── */

  /** 테마 구성원의 날짜별 수익률 중앙값 계열 */
  function themeMedianSeries(tickers: string[], dates: string[]): number[] {
    return dates.map((d) => {
      const vals: number[] = [];
      for (const t of tickers) {
        const v = dailyByTicker.get(t)?.get(d);
        if (v != null) vals.push(v);
      }
      return median(vals) ?? 0;
    });
  }

  /** 기준 거래일 목록 — SPY 달력을 씁니다. offset 만큼 뒤를 잘라냅니다. */
  function calendar(offsetFromEnd = 0): string[] {
    if (!spy) return [];
    const all = spy.map((b) => dateKey(b.t));
    return offsetFromEnd > 0 ? all.slice(0, all.length - offsetFromEnd) : all;
  }

  type LeaderRow = {
    ticker: string;
    score: number;
    /** 이 종목이 크게 오른 날, 테마의 나머지도 같이 오른 비율에서 평상시 비율을 뺀 값(%p) */
    pull: number | null;
    /** 선행 − 후행. 양수면 남보다 먼저 움직인다는 뜻 */
    lead: number | null;
    /** 60일 수익률 − 테마 중앙값(%p) */
    rs: number | null;
    /** 20일 평균 거래대금 ÷ 60일 평균 거래대금. 1보다 크면 최근 자금이 몰린 것 */
    flow: number | null;
    /** 주도력 계산에 쓰인 표본(이 종목이 크게 오른 날 수) */
    pullDays: number;
    /** 이 테마가 이 회사에게 곁다리인가 — 대장 후보에서 제외됩니다 */
    peripheral: boolean;
  };

  /**
   * 테마 안에서 대장주 점수를 매깁니다.
   *
   * 첫 판에서는 "선행성 + 거래대금 절대규모"로 했다가 결과가 무너졌습니다.
   * 거래대금 절대규모를 쓰니 MSFT·AMZN 같은 대형주가 곁다리로 낀 테마
   * (양자·사이버보안)에서도 무조건 1위가 됐고, 120일 시차상관은 사실상
   * 난수라 순위가 매번 뒤집혔습니다. 그래서 아래로 다시 설계했습니다.
   *
   *   주도력   45%  이 종목이 크게 오른 날 나머지도 같이 올랐는가 (평상시 대비 초과분)
   *   선행성   25%  선행 상관 − 후행 상관. 따라가는 종목과 끌고 가는 종목을 가릅니다
   *   상대강도 15%  60일 수익률의 테마 중앙값 대비 초과분
   *   자금유입 15%  거래대금의 최근 증가 배수 (절대 규모가 아니라 변화)
   *
   * 자금유입을 "규모"가 아니라 "증가 배수"로 바꾼 것이 대형주 편향을 없앤 핵심입니다.
   *
   * offsetFromEnd 를 주면 그만큼 과거 시점 기준으로 계산합니다(손바뀜 비교용).
   */
  /**
   * 주도력을 잴 때 "이 종목이 크게 오른 날"을 고르는 방식.
   *
   * 처음엔 잔차 +2% 이상인 날로 잡았는데, 그러면 **종목마다 표본 수가 제각각**이
   * 됩니다. 변동성 큰 종목은 90회, 잔잔한 종목은 16회. 표본이 적으면 비율이
   * 극단으로 튀어서 우연히 높게 나온 종목이 1위를 차지합니다. 실제로 자율주행
   * 대장에 에어백 회사(16회)가 뽑혔습니다.
   *
   * 그래서 **각 종목의 잔차 상위 30일**을 씁니다. 모두 표본이 30으로 같아져
   * 비율을 그대로 비교할 수 있습니다.
   */
  const PULL_TOP_DAYS = 30;
  const MIN_PULL_DAYS = 30;

  /**
   * 시장(SPY) 영향을 걷어낸 잔차 수익률.
   *
   *   잔차 = 그날 수익률 − 베타 × SPY 수익률
   *
   * 왜 필요한가: 처음 설계는 "이 종목이 오른 날 테마도 올랐는가"만 봤는데,
   * 그러면 **시장이 오르는 날에만 오르는 저변동 종목이 유리해집니다.**
   * 실제로 로봇 대장에 산업용 모터 회사, 자율주행에 에어백 회사가 뽑혔습니다.
   * 시장 전체가 오른 날은 테마도 당연히 오르니 "같이 올랐다"로 집계된 것입니다.
   * 시장 몫을 빼면 테마 고유의 움직임만 남아 진짜 주도 관계가 드러납니다.
   */
  function residualSeries(
    ticker: string,
    window: string[],
  ): (number | null)[] {
    const own = window.map((d) => dailyByTicker.get(ticker)?.get(d) ?? null);
    const mkt = window.map((d) => dailyByTicker.get("SPY")?.get(d) ?? null);

    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < window.length; i++) {
      if (own[i] != null && mkt[i] != null) {
        xs.push(mkt[i] as number);
        ys.push(own[i] as number);
      }
    }
    if (xs.length < 60) return own; // 표본이 짧으면 원수익률을 그대로 씁니다

    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let cov = 0,
      varx = 0;
    for (let i = 0; i < xs.length; i++) {
      cov += (xs[i] - mx) * (ys[i] - my);
      varx += (xs[i] - mx) ** 2;
    }
    const beta = varx > 0 ? cov / varx : 1;

    return window.map((_, i) =>
      own[i] == null || mkt[i] == null
        ? null
        : round((own[i] as number) - beta * (mkt[i] as number), 3),
    );
  }

  /** 여러 계열의 날짜별 중앙값 */
  function medianOf(series: (number | null)[][], len: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < len; i++) {
      const vals: number[] = [];
      for (const s of series) {
        const v = s[i];
        if (v != null) vals.push(v);
      }
      out.push(median(vals) ?? 0);
    }
    return out;
  }

  function scoreLeaders(
    tickers: string[],
    themeSlug: string,
    offsetFromEnd = 0,
  ): LeaderRow[] {
    const dates = calendar(offsetFromEnd);
    if (dates.length < 200) return [];
    const window = dates.slice(-252);

    // 종목마다 시장 영향을 걷어낸 잔차 계열을 한 번씩만 만들어 재사용합니다
    const resid = new Map<string, (number | null)[]>();
    for (const t of tickers) resid.set(t, residualSeries(t, window));

    const endIdx = (t: string) => {
      const bars = byTicker.get(t);
      if (!bars) return -1;
      const cutoff = window[window.length - 1];
      let i = bars.length - 1;
      while (i >= 0 && dateKey(bars[i].t) > cutoff) i--;
      return i;
    };

    const pulls: (number | null)[] = [];
    const pullDays: number[] = [];
    const leads: (number | null)[] = [];
    const rss: (number | null)[] = [];
    const flows: (number | null)[] = [];

    for (const t of tickers) {
      const own = resid.get(t) as (number | null)[];

      /* 이 종목을 뺀 나머지의 잔차 중앙값 = "테마 고유 흐름" */
      const others = tickers.filter((x) => x !== t);
      const othersFactor = medianOf(
        others.map((x) => resid.get(x) as (number | null)[]),
        window.length,
      );
      const baseUpRate =
        othersFactor.filter((v) => v > 0).length /
        Math.max(1, othersFactor.length);

      /* 주도력 — 내가 테마 고유로 가장 크게 오른 30일에, 나머지도 같이 올랐는가 */
      const ranked = own
        .map((v, i) => ({ v, i }))
        .filter((x): x is { v: number; i: number } => x.v != null && x.v > 0)
        .sort((a, b) => b.v - a.v);
      const bigDays = ranked.slice(0, PULL_TOP_DAYS).map((x) => x.i);
      pullDays.push(bigDays.length);
      if (bigDays.length >= MIN_PULL_DAYS) {
        const co =
          bigDays.filter((i) => othersFactor[i] > 0).length / bigDays.length;
        pulls.push(round((co - baseUpRate) * 100, 2));
      } else {
        pulls.push(null);
      }

      /* 선행성 — 내가 먼저 움직이는 정도에서, 내가 따라가는 정도를 뺀다 */
      const xLead: number[] = [];
      const yLead: number[] = [];
      const xLag: number[] = [];
      const yLag: number[] = [];
      for (let i = 0; i < window.length - 1; i++) {
        const o = own[i];
        const oNext = own[i + 1];
        if (o != null) {
          xLead.push(o);
          yLead.push(othersFactor[i + 1]);
        }
        if (oNext != null) {
          xLag.push(othersFactor[i]);
          yLag.push(oNext);
        }
      }
      const cLead = corr(xLead, yLead);
      const cLag = corr(xLag, yLag);
      leads.push(
        cLead != null && cLag != null ? round(cLead - cLag, 4) : null,
      );

      /* 상대강도 · 자금유입 */
      const bars = byTicker.get(t);
      const i = endIdx(t);
      if (!bars || i < 61) {
        rss.push(null);
        flows.push(null);
        continue;
      }
      const sub = bars.slice(0, i + 1);
      rss.push(changeOver(sub, 60));
      const dv20 = mean(sub.slice(-20).map((b) => b.c * b.v));
      const dv60 = mean(sub.slice(-60).map((b) => b.c * b.v));
      flows.push(dv20 != null && dv60 != null && dv60 > 0 ? round(dv20 / dv60, 3) : null);
    }

    const rsMed = median(rss.filter((v): v is number => v != null)) ?? 0;
    const rsRel = rss.map((v) => (v == null ? null : round(v - rsMed)));

    const nPull = rankNormalize(pulls);
    const nLead = rankNormalize(leads);
    const nRs = rankNormalize(rsRel);
    const nFlow = rankNormalize(flows);

    return tickers
      .map((t, i) => ({
        ticker: t,
        score: round(
          0.45 * nPull[i] + 0.25 * nLead[i] + 0.15 * nRs[i] + 0.15 * nFlow[i],
          4,
        ),
        pull: pulls[i],
        lead: leads[i],
        rs: rsRel[i],
        flow: flows[i],
        pullDays: pullDays[i],
        peripheral: isPeripheral(themeSlug, t),
      }))
      .sort((a, b) => b.score - a.score);
  }

  /** 대장은 곁다리가 아닌 종목 중에서만 고릅니다. */
  const pickLeader = (rows: LeaderRow[]): LeaderRow | undefined =>
    rows.find((r) => !r.peripheral) ?? rows[0];

  const leaders: Record<
    string,
    {
      ranked: LeaderRow[];
      handover: { from: string; to: string; agoDays: number } | null;
      /** 1위와 2위의 점수 차. 작으면 접전이라 한 종목으로 단정하기 어렵습니다 */
      margin: number | null;
      /** 접전 여부 — 화면에서 "대장" 대신 "접전"으로 표시합니다 */
      close: boolean;
      note: string;
    }
  > = {};

  /** 1·2위가 이 정도도 안 벌어지면 한 종목을 대장이라 부르지 않습니다 */
  const CLOSE_MARGIN = 0.06;

  /**
   * 손바뀜 판정.
   *
   * 처음엔 20거래일 전과 1위만 비교했더니 11개 테마가 전부 "손바뀜"으로 나왔습니다.
   * 전부 바뀌었다는 건 신호가 아니라 잡음이라는 뜻입니다. 그래서 조건을 세웁니다.
   *
   *   ① 60거래일(약 3개월) 전과 비교한다 — 짧은 창은 순위가 쉽게 뒤집힙니다
   *   ② 예전 1위가 지금 3위 밖으로 밀려나야 한다 — 1↔2위 자리바꿈은 교체가 아닙니다
   *   ③ 점수 차가 뚜렷해야 한다 — 새 1위가 예전 1위보다 0.08 이상 높아야 합니다
   */
  const HANDOVER_LOOKBACK = 60;
  const HANDOVER_MARGIN = 0.08;

  function detectHandover(
    now: LeaderRow[],
    before: LeaderRow[],
  ): { from: string; to: string; agoDays: number } | null {
    const oldTop = pickLeader(before)?.ticker;
    const newTop = pickLeader(now)?.ticker;
    if (!oldTop || !newTop || oldTop === newTop) return null;

    // 곁다리를 뺀 순위에서 예전 1위가 지금 몇 위인지
    const pure = now.filter((r) => !r.peripheral);
    const oldRankNow = pure.findIndex((r) => r.ticker === oldTop);
    if (oldRankNow < 0 || oldRankNow < 3) return null; // 아직 상위권이면 교체 아님

    if (pure[0].score - pure[oldRankNow].score < HANDOVER_MARGIN) return null;

    return { from: oldTop, to: newTop, agoDays: HANDOVER_LOOKBACK };
  }

  for (const theme of THEMES) {
    const tickers = theme.layers.flatMap((l) => l.stocks.map((s) => s.ticker));
    const now = scoreLeaders(tickers, theme.slug, 0);
    const before = scoreLeaders(tickers, theme.slug, HANDOVER_LOOKBACK);
    const pure = now.filter((r) => !r.peripheral);
    const margin =
      pure.length >= 2 ? round(pure[0].score - pure[1].score, 4) : null;
    leaders[theme.slug] = {
      ranked: now,
      handover: detectHandover(now, before),
      margin,
      close: margin != null && margin < CLOSE_MARGIN,
      note: "주도력 45% · 선행성 25% · 상대강도 15% · 자금유입 15% 를 테마 안 순위로 환산해 합산한 값입니다. 시장 전체 흐름(S&P500)의 영향은 걷어낸 뒤 계산했습니다. 과거 기록의 요약이며 매매 판단이 아닙니다.",
    };
  }

  /* ── 3. 층별 온도 ────────────────────────────────────────────── */

  const layers: Record<
    string,
    {
      layers: {
        n: number;
        key: string;
        name: string;
        ret5: number | null;
        ret20: number | null;
        up: number;
        total: number;
        rank20: number | null;
        best: string | null;
        worst: string | null;
      }[];
    }
  > = {};

  for (const theme of THEMES) {
    const rows = theme.layers.map((layer) => {
      const ts = layer.stocks.map((s) => s.ticker);
      const r5 = ts.map((t) => stocks[t]?.ret5).filter((v): v is number => v != null);
      const r20 = ts
        .map((t) => stocks[t]?.ret20)
        .filter((v): v is number => v != null);

      const withR20 = ts
        .map((t) => ({ t, v: stocks[t]?.ret20 }))
        .filter((x): x is { t: string; v: number } => x.v != null)
        .sort((a, b) => b.v - a.v);

      return {
        n: layer.n,
        key: layer.key,
        name: layer.name,
        ret5: median(r5),
        ret20: median(r20),
        up: r20.filter((v) => v > 0).length,
        total: ts.length,
        rank20: null as number | null,
        best: withR20[0]?.t ?? null,
        worst: withR20.at(-1)?.t ?? null,
      };
    });

    // 20일 성과 순위 (1위가 가장 뜨거움)
    const order = [...rows]
      .filter((r) => r.ret20 != null)
      .sort((a, b) => (b.ret20 as number) - (a.ret20 as number));
    order.forEach((r, i) => {
      const target = rows.find((x) => x.key === r.key);
      if (target) target.rank20 = i + 1;
    });

    layers[theme.slug] = { layers: rows };
  }

  /* ── 4. 동조율 ───────────────────────────────────────────────── */

  const THRESHOLDS = [3, 2, 1.5];
  const MIN_EVENTS = 10;

  type SyncMember = {
    ticker: string;
    hits: number;
    events: number;
    rate: number | null;
    avgReturn: number | null;
    /** 대장이 오른 폭 대비 이 종목이 오른 폭 */
    response: number | null;
    /** 사건일 전체를 겪지 못한 종목 (상장이 늦음) */
    partial: boolean;
  };

  const sync: Record<
    string,
    {
      leader: string;
      threshold: number;
      events: number;
      window: number;
      leaderAvg: number | null;
      members: SyncMember[];
      note: string;
    }
  > = {};

  for (const theme of THEMES) {
    const tickers = theme.layers.flatMap((l) => l.stocks.map((s) => s.ticker));
    const ranked = leaders[theme.slug]?.ranked ?? [];
    const leader =
      ranked.find((r) => !r.peripheral)?.ticker ?? ranked[0]?.ticker ?? tickers[0];
    const leaderDaily = dailyByTicker.get(leader);
    if (!leaderDaily) continue;

    // 최근 252거래일
    const dates = calendar().slice(-252);

    let threshold = THRESHOLDS[0];
    let eventDates: string[] = [];
    for (const th of THRESHOLDS) {
      eventDates = dates.filter((d) => (leaderDaily.get(d) ?? -Infinity) >= th);
      threshold = th;
      if (eventDates.length >= MIN_EVENTS) break;
    }

    const leaderAvg = mean(
      eventDates.map((d) => leaderDaily.get(d) as number),
    );

    const members: SyncMember[] = tickers
      .filter((t) => t !== leader)
      .map((t) => {
        const m = dailyByTicker.get(t);
        const seen: number[] = [];
        for (const d of eventDates) {
          const v = m?.get(d);
          if (v != null) seen.push(v);
        }
        const hits = seen.filter((v) => v > 0).length;
        const avg = mean(seen);
        return {
          ticker: t,
          hits,
          events: seen.length,
          rate: seen.length ? round((hits / seen.length) * 100, 1) : null,
          avgReturn: avg,
          response:
            avg != null && leaderAvg != null && leaderAvg !== 0
              ? round(avg / leaderAvg, 2)
              : null,
          partial: seen.length < eventDates.length,
        };
      })
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

    sync[theme.slug] = {
      leader,
      threshold,
      events: eventDates.length,
      window: dates.length,
      leaderAvg,
      members,
      note: "대장주가 크게 오른 날만 골라 각 종목이 어떻게 반응했는지 센 것입니다. 과거 기록이며 앞으로도 그러리라는 뜻이 아닙니다.",
    };
  }

  /* ── 5. 브리핑 — 층 사이의 순위 이동 ─────────────────────────── */

  /**
   * "AI가 빠졌다"가 아니라 "AI 안에서 메모리에서 광통신으로 옮겨갔다"를
   * 자동으로 잡아내는 부분입니다.
   *
   * 방법: 같은 층들을 20일 성과로 한 번, 5일 성과로 한 번 줄 세워
   * **순위가 몇 계단 움직였는지** 봅니다. 20일 순위보다 5일 순위가 크게
   * 올라간 층은 최근 들어 앞서기 시작한 층입니다.
   *
   * 수익률 차이가 아니라 순위 차이를 보는 이유: 시장 전체가 빠진 날에는
   * 모든 층의 수익률이 같이 내려가 비교가 되지 않습니다. 순위는 그런
   * 공통 요인에 영향을 받지 않습니다.
   */
  type Move = {
    n: number;
    key: string;
    name: string;
    /** 20일 순위 − 5일 순위. 양수면 최근 들어 앞선 것 */
    delta: number;
    rank20: number;
    rank5: number;
    ret5: number;
    ret20: number;
  };

  const briefing: Record<
    string,
    {
      hottest: { n: number; name: string; ret20: number } | null;
      coldest: { n: number; name: string; ret20: number } | null;
      riser: Move | null;
      faller: Move | null;
      /** 순위 이동이 뚜렷해 "옮겨갔다"고 말할 만한 경우 */
      rotated: boolean;
    }
  > = {};

  const ROTATE_STEPS = 2; // 이 정도는 움직여야 이동이라고 봅니다

  for (const theme of THEMES) {
    const rows = (layers[theme.slug]?.layers ?? []).filter(
      (r): r is typeof r & { ret5: number; ret20: number } =>
        r.ret5 != null && r.ret20 != null,
    );
    if (rows.length < 3) {
      briefing[theme.slug] = {
        hottest: null,
        coldest: null,
        riser: null,
        faller: null,
        rotated: false,
      };
      continue;
    }

    const by20 = [...rows].sort((a, b) => b.ret20 - a.ret20).map((r) => r.key);
    const by5 = [...rows].sort((a, b) => b.ret5 - a.ret5).map((r) => r.key);

    const moves: Move[] = rows.map((r) => {
      const rank20 = by20.indexOf(r.key) + 1;
      const rank5 = by5.indexOf(r.key) + 1;
      return {
        n: r.n,
        key: r.key,
        name: r.name,
        delta: rank20 - rank5,
        rank20,
        rank5,
        ret5: r.ret5,
        ret20: r.ret20,
      };
    });

    const riser = moves.reduce((a, b) => (b.delta > a.delta ? b : a));
    const faller = moves.reduce((a, b) => (b.delta < a.delta ? b : a));
    const hot = rows.reduce((a, b) => (b.ret20 > a.ret20 ? b : a));
    const cold = rows.reduce((a, b) => (b.ret20 < a.ret20 ? b : a));

    briefing[theme.slug] = {
      hottest: { n: hot.n, name: hot.name, ret20: hot.ret20 },
      coldest: { n: cold.n, name: cold.name, ret20: cold.ret20 },
      riser,
      faller,
      rotated:
        riser.delta >= ROTATE_STEPS &&
        faller.delta <= -ROTATE_STEPS &&
        riser.key !== faller.key,
    };
  }

  /* ── 저장 ────────────────────────────────────────────────────── */

  await mkdir(OUT_DIR, { recursive: true });
  const meta = {
    generatedAt: new Date().toISOString(),
    asOf,
    source: "Yahoo Finance (수정 종가 기준)",
    universe: Object.keys(stocks).length,
    benchmarks: BENCHMARKS,
  };

  const files: [string, unknown][] = [
    ["stocks.json", { ...meta, stocks }],
    ["layers.json", { ...meta, themes: layers }],
    ["sync.json", { ...meta, minEvents: MIN_EVENTS, themes: sync }],
    ["leaders.json", { ...meta, themes: leaders }],
    [
      "briefing.json",
      {
        ...meta,
        rotateSteps: ROTATE_STEPS,
        themes: briefing,
        note: "20일 순위와 5일 순위를 비교해 층 사이의 자리바꿈을 적은 것입니다. 지나간 기록이며 앞날에 대한 말이 아닙니다.",
      },
    ],
  ];

  for (const [name, data] of files) {
    const json = JSON.stringify(data) + "\n";
    // NaN·Infinity 가 섞이면 JSON.stringify 가 null 로 바꿔버려 조용히 넘어간다.
    // 문자열 단계에서 한 번 더 확인한다.
    if (/\bNaN\b|\bInfinity\b|undefined/.test(json)) {
      console.error(`[compute] ${name} 에 이상한 값이 섞였습니다. 중단합니다.`);
      process.exit(1);
    }
    await writeFile(`${OUT_DIR}/${name}`, json, "utf8");
    console.log(`[compute] ${name} — ${(json.length / 1024).toFixed(1)}KB`);
  }

  /* ── 요약 출력 ───────────────────────────────────────────────── */

  console.log(`\n[compute] 기준일 ${asOf} · 종목 ${Object.keys(stocks).length}개`);
  const short = Object.entries(sync).filter(([, v]) => v.events < MIN_EVENTS);
  if (short.length) {
    console.warn(
      `[compute] 사건 수가 ${MIN_EVENTS}회 미만인 테마: ` +
        short.map(([k, v]) => `${k}(${v.events}회)`).join(", "),
    );
  }
  for (const theme of THEMES) {
    const s = sync[theme.slug];
    const h = leaders[theme.slug]?.handover;
    if (!s) continue;
    const L = leaders[theme.slug];
    console.log(
      `  ${theme.name.padEnd(12)} 대장 ${s.leader.padEnd(6)} ` +
        `+${s.threshold}% ${String(s.events).padStart(3)}회` +
        (L?.close ? "  (접전)" : "") +
        (h ? `  ← 손바뀜 ${h.from}→${h.to}` : ""),
    );
  }
}

main().catch((e) => {
  console.error("[compute] 실패:", e);
  process.exit(1);
});
