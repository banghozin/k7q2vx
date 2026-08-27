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

  /**
   * 테마에 속한 종목 목록 — **중복을 뺍니다.**
   *
   * 한 회사가 같은 테마의 두 층에 걸쳐 있을 수 있습니다. 실제로 우주·방산의
   * 록히드 마틴이 1층(발사체 — 발사 합작사 지분)과 5층(무기 체계)에 함께
   * 올라 있고, 그건 의도된 큐레이션입니다.
   *
   * 그런데 층을 그냥 펼쳐 붙이면 그 회사가 명단에 **두 번** 들어갑니다.
   * 2026-08-27 에 확인한 결과:
   *   - 대장주 순위에 LMT 가 1위와 2위로 나란히 떴습니다
   *   - 1·2위가 같은 종목이라 점수 차가 없어 **"접전" 이 항상 켜졌습니다**
   *   - 테마 중앙값에서 그 종목의 등락률이 두 번 세어졌습니다
   *
   * 층별 계산은 층마다 따로 도니 그대로 두고, **테마 단위 계산에서만**
   * 중복을 뺍니다.
   */
  function themeMembers(theme: (typeof THEMES)[number]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const layer of theme.layers) {
      for (const stock of layer.stocks) {
        const t = stock.ticker.trim().toUpperCase();
        if (seen.has(t)) continue;
        seen.add(t);
        out.push(stock.ticker);
      }
    }
    return out;
  }

  for (const theme of THEMES) {
    const tickers = themeMembers(theme);
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

  type OneSync = {
    leader: string;
    threshold: number;
    events: number;
    window: number;
    leaderAvg: number | null;
    members: SyncMember[];
  };

  /** 기준 종목 하나에 대해 동조율을 계산합니다. */
  function syncFor(leader: string, tickers: string[]): OneSync | null {
    const leaderDaily = dailyByTicker.get(leader);
    if (!leaderDaily) return null;

    const dates = calendar().slice(-252);

    let threshold = THRESHOLDS[0];
    let eventDates: string[] = [];
    for (const th of THRESHOLDS) {
      eventDates = dates.filter((d) => (leaderDaily.get(d) ?? -Infinity) >= th);
      threshold = th;
      if (eventDates.length >= MIN_EVENTS) break;
    }
    if (eventDates.length === 0) return null;

    const leaderAvg = mean(eventDates.map((d) => leaderDaily.get(d) as number));

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

    return {
      leader,
      threshold,
      events: eventDates.length,
      window: dates.length,
      leaderAvg,
      members,
    };
  }

  const sync: Record<
    string,
    {
      default: string;
      candidates: string[];
      byLeader: Record<string, OneSync>;
      note: string;
    }
  > = {};

  for (const theme of THEMES) {
    const tickers = themeMembers(theme);
    const ranked = leaders[theme.slug]?.ranked ?? [];
    const pure = ranked.filter((r) => !r.peripheral);
    const fallback = pure[0]?.ticker ?? ranked[0]?.ticker ?? tickers[0];

    /**
     * 기준 종목 후보를 여러 개 둡니다.
     *
     * 계산으로 뽑은 대장이 기본값이지만, 사람들은 "NVDA 기준으로 보면?" 을
     * 당연히 궁금해합니다. 그래서 상위 3개에 더해 **그 테마에서 거래대금이
     * 가장 큰 종목**(대개 사람들이 아는 이름)을 후보에 넣습니다.
     */
    const byScore = pure.slice(0, 3).map((r) => r.ticker);
    const biggest = [...tickers]
      .filter((t) => stocks[t]?.dollarVol != null)
      .sort((a, b) => (stocks[b].dollarVol ?? 0) - (stocks[a].dollarVol ?? 0))[0];

    const candidates = [...new Set([...byScore, biggest].filter(Boolean))];

    const byLeader: Record<string, OneSync> = {};
    for (const c of candidates) {
      const s = syncFor(c, tickers);
      if (s) byLeader[c] = s;
    }
    if (Object.keys(byLeader).length === 0) continue;

    sync[theme.slug] = {
      default: byLeader[fallback] ? fallback : Object.keys(byLeader)[0],
      candidates: Object.keys(byLeader),
      byLeader,
      note: "기준 종목이 크게 오른 날만 골라 각 종목이 어떻게 반응했는지 센 것입니다. 과거 기록이며 앞으로도 그러리라는 뜻이 아닙니다.",
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

  /* ── 6. 층 순환 — 시간축 ──────────────────────────────────────── */

  /**
   * 지난 반년 동안 층 순위가 어떻게 뒤바뀌었는지.
   *
   * 지금까지의 화면은 "오늘" 한 시점만 보여줬습니다. 그래서 "메모리에서
   * 광통신으로 옮겨갔다"를 말로만 주장하고 그림으로 증명하지 못했습니다.
   * 여기서는 5거래일 간격으로 과거 시점을 되짚어, 각 시점에서 층들을
   * 20일 성과로 줄 세운 **순위**를 기록합니다.
   *
   * 수익률이 아니라 순위를 기록하는 이유: 시장 전체가 빠진 구간에는 모든
   * 층의 수익률이 같이 내려가 선이 뭉쳐 버립니다. 순위는 그 공통 요인에
   * 영향을 받지 않아 "누가 누구를 앞질렀나"만 남습니다.
   */
  const ROT_STEP = 5; // 5거래일(약 1주) 간격
  const ROT_POINTS = 26; // 약 반년

  type RotLayer = {
    n: number;
    key: string;
    name: string;
    /** 각 시점의 순위 (1이 가장 앞선 층). 데이터가 없으면 null */
    ranks: (number | null)[];
    /** 각 시점의 20일 중앙값 수익률 */
    rets: (number | null)[];
  };

  const rotation: Record<
    string,
    {
      dates: string[];
      layers: RotLayer[];
      /** 창 전체에서 순위가 가장 많이 올라간 층 / 내려간 층 */
      riser: string | null;
      faller: string | null;
    }
  > = {};

  // 티커별로 (날짜 배열, 수정종가 배열)을 미리 만들어 되짚기를 빠르게 합니다
  const seriesIndex = new Map<string, { d: string[]; a: number[] }>();
  for (const [t, bars] of byTicker) {
    seriesIndex.set(t, {
      d: bars.map((b) => dateKey(b.t)),
      a: bars.map((b) => b.a),
    });
  }

  /** 기준일 d 시점에서 이 종목의 20거래일 수익률 */
  function retAsOf(ticker: string, d: string, lookback = 20): number | null {
    const s = seriesIndex.get(ticker);
    if (!s) return null;
    // d 이하인 마지막 봉을 이분 탐색
    let lo = 0,
      hi = s.d.length - 1,
      idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (s.d[mid] <= d) {
        idx = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (idx < lookback) return null;
    const past = s.a[idx - lookback];
    const now = s.a[idx];
    if (!(past > 0)) return null;
    const pct = ((now - past) / past) * 100;
    if (!Number.isFinite(pct) || Math.abs(pct) > GUARD[20]) return null;
    return round(pct);
  }

  {
    const cal = calendar();
    const snapIdx: number[] = [];
    for (let k = ROT_POINTS - 1; k >= 0; k--) {
      const i = cal.length - 1 - k * ROT_STEP;
      if (i >= 0) snapIdx.push(i);
    }
    const dates = snapIdx.map((i) => cal[i]);

    for (const theme of THEMES) {
      const rows: RotLayer[] = theme.layers.map((l) => ({
        n: l.n,
        key: l.key,
        name: l.name,
        ranks: [],
        rets: [],
      }));

      for (const d of dates) {
        // 각 층의 이 시점 20일 중앙값
        const vals = theme.layers.map((l) =>
          median(
            l.stocks
              .map((s) => retAsOf(s.ticker, d))
              .filter((v): v is number => v != null),
          ),
        );

        const order = vals
          .map((v, i) => ({ v, i }))
          .filter((x): x is { v: number; i: number } => x.v != null)
          .sort((a, b) => b.v - a.v);

        const rankOf = new Map<number, number>();
        order.forEach((x, r) => rankOf.set(x.i, r + 1));

        rows.forEach((row, i) => {
          row.rets.push(vals[i]);
          row.ranks.push(rankOf.get(i) ?? null);
        });
      }

      // 창의 처음과 끝 순위를 비교해 가장 많이 오르내린 층을 찾습니다
      const delta = rows.map((r) => {
        const first = r.ranks.find((v) => v != null) ?? null;
        const last = [...r.ranks].reverse().find((v) => v != null) ?? null;
        return first != null && last != null ? first - last : null;
      });
      let riser: string | null = null;
      let faller: string | null = null;
      let best = 0;
      let worst = 0;
      rows.forEach((r, i) => {
        const dv = delta[i];
        if (dv == null) return;
        if (dv > best) {
          best = dv;
          riser = r.key;
        }
        if (dv < worst) {
          worst = dv;
          faller = r.key;
        }
      });

      rotation[theme.slug] = { dates, layers: rows, riser, faller };
    }
  }

  /* ── 층 전체가 움직였나, 이 종목만 움직였나 ──────────────────
   *
   * 밤에 종목이 빠졌을 때 가장 먼저 궁금한 것은 "업계 전체 문제인가, 이
   * 회사만의 문제인가" 입니다. CLAUDE.md 가 적어 둔 물음 그대로입니다.
   *
   * 답하는 방법은 간단합니다. 그 종목이 크게 움직인 날, **같은 층의 나머지
   * 종목들도 같이 움직였는지** 중앙값으로 보면 됩니다. 중앙값을 쓰는 이유는
   * 층 안의 한 종목이 실적으로 튀어도 층 전체가 왜곡되지 않게 하기 위해서고,
   * 자기 자신을 빼고 세는 이유는 그러지 않으면 구성원이 적은 층에서 자기가
   * 자기를 설명하게 되기 때문입니다.
   *
   * **판정은 사실 서술까지만 합니다.** "그러니 사라/팔아라" 로 넘어가지
   * 않습니다.
   */
  type MoveVerdict = "layer" | "solo" | "mixed";

  type MoveLayer = {
    theme: string;
    n: number;
    /** 같은 층에서 자기를 뺀 나머지의 중앙값 (%) */
    median1: number | null;
    median5: number | null;
    /** 중앙값을 낸 표본 수 */
    peers: number;
    verdict1: MoveVerdict | null;
    verdict5: MoveVerdict | null;
  };

  /** 이 정도는 움직여야 "움직였다"고 보고 판정합니다 */
  const MOVE_MIN_1 = 2;
  const MOVE_MIN_5 = 4;

  function verdictOf(
    own: number | null,
    peer: number | null,
    minMove: number,
  ): MoveVerdict | null {
    if (own == null || peer == null) return null;
    if (Math.abs(own) < minMove) return null; // 잠잠한 날은 판정하지 않습니다
    // 층이 반대로 갔거나 거의 안 움직였으면 이 종목만의 일입니다
    if (peer * own <= 0 || Math.abs(peer) < Math.abs(own) * 0.3) return "solo";
    if (Math.abs(peer) >= Math.abs(own) * 0.6) return "layer";
    return "mixed";
  }

  const moves: Record<string, { ret1: number | null; ret5: number | null; layers: MoveLayer[] }> = {};

  for (const theme of THEMES) {
    for (const layer of theme.layers) {
      const members = layer.stocks.map((s) => s.ticker.toUpperCase());
      if (members.length < 2) continue; // 혼자 있는 층은 비교 상대가 없습니다

      for (const t of members) {
        const own = stocks[t];
        if (!own) continue;

        const peers = members.filter((m) => m !== t && stocks[m]);
        const m1 = median(
          peers.map((p) => stocks[p].ret1).filter((x): x is number => x != null),
        );
        const m5 = median(
          peers.map((p) => stocks[p].ret5).filter((x): x is number => x != null),
        );

        const row: MoveLayer = {
          theme: theme.slug,
          n: layer.n,
          median1: m1 != null ? round(m1) : null,
          median5: m5 != null ? round(m5) : null,
          peers: peers.length,
          /*
           * 비교 상대가 하나뿐이면 그건 중앙값이 아니라 그냥 그 한 종목입니다.
           * 그걸로 "층 전체" 를 말하면 과장입니다. 표본이 둘 이상일 때만
           * 판정하고, 아니면 숫자만 보여 주고 읽는 사람에게 맡깁니다.
           */
          verdict1: peers.length >= 2 ? verdictOf(own.ret1, m1, MOVE_MIN_1) : null,
          verdict5: peers.length >= 2 ? verdictOf(own.ret5, m5, MOVE_MIN_5) : null,
        };

        if (!moves[t]) {
          moves[t] = { ret1: own.ret1, ret5: own.ret5, layers: [] };
        }
        moves[t].layers.push(row);
      }
    }
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
      "moves.json",
      {
        ...meta,
        minMove: { d1: MOVE_MIN_1, d5: MOVE_MIN_5 },
        stocks: moves,
        note: "그 종목이 크게 움직인 날 같은 층의 나머지도 같이 움직였는지 센 것입니다. 지나간 하루의 기록이며 앞날에 대한 말이 아닙니다.",
      },
    ],
    [
      "rotation.json",
      {
        ...meta,
        stepDays: ROT_STEP,
        points: ROT_POINTS,
        themes: rotation,
        note: "각 시점에서 층들을 20일 성과로 줄 세운 순위입니다. 수익률이 아니라 순위를 쓰는 이유는, 시장 전체가 빠진 구간에는 모든 층이 같이 내려가 비교가 되지 않기 때문입니다. 지나간 기록이며 앞날에 대한 말이 아닙니다.",
      },
    ],
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

  /*
   * 브리핑을 날짜별로 쌓아 둡니다.
   *
   * briefing.json 은 **오늘 것만** 담고 내일이면 덮어씁니다. 그러면 "이번 주에
   * 무슨 일이 있었나"를 영영 못 봅니다. 뉴스 아카이브와 같은 이유로, 지나가면
   * 되찾을 수 없으니 지금부터 쌓습니다.
   *
   * 하루치 전부가 아니라 **뒤에서 다시 볼 것만** 남깁니다 — 어느 층이 가장
   * 뜨거웠는지, 어느 층이 올라서고 내려앉았는지. 90일치면 한 분기입니다.
   */
  const HISTORY_DAYS = 90;
  const historyPath = `${OUT_DIR}/briefing-history.json`;
  type HistoryDay = {
    asOf: string;
    themes: Record<
      string,
      {
        hottest: { n: number; name: string; ret20: number } | null;
        riser: { n: number; name: string; delta: number } | null;
        faller: { n: number; name: string; delta: number } | null;
        rotated: boolean;
      }
    >;
  };

  let days: HistoryDay[] = [];
  try {
    const prev = JSON.parse(await readFile(historyPath, "utf8")) as {
      days?: HistoryDay[];
    };
    if (Array.isArray(prev.days)) days = prev.days;
  } catch {
    // 처음 도는 날에는 파일이 없습니다. 빈 목록으로 시작합니다
  }

  const today: HistoryDay = { asOf, themes: {} };
  for (const [slug, b] of Object.entries(briefing)) {
    today.themes[slug] = {
      hottest: b.hottest
        ? { n: b.hottest.n, name: b.hottest.name, ret20: b.hottest.ret20 }
        : null,
      riser: b.riser
        ? { n: b.riser.n, name: b.riser.name, delta: b.riser.delta }
        : null,
      faller: b.faller
        ? { n: b.faller.n, name: b.faller.name, delta: b.faller.delta }
        : null,
      rotated: b.rotated,
    };
  }

  // 같은 날 두 번 돌면 덮어씁니다 — 장중에 손으로 돌려볼 수 있으므로
  days = days.filter((d) => d.asOf !== asOf);
  days.push(today);
  days.sort((a, b) => (a.asOf < b.asOf ? -1 : 1));
  days = days.slice(-HISTORY_DAYS);

  files.push([
    "briefing-history.json",
    {
      generatedAt: meta.generatedAt,
      asOf,
      keepDays: HISTORY_DAYS,
      days,
      note: "하루 1회 계산할 때마다 그날의 브리핑을 덧붙인 기록입니다. 지나간 기록이며 앞날에 대한 말이 아닙니다.",
    },
  ]);

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
  const short = Object.entries(sync).filter(
    ([, v]) => v.byLeader[v.default].events < MIN_EVENTS,
  );
  if (short.length) {
    console.warn(
      `[compute] 사건 수가 ${MIN_EVENTS}회 미만인 테마: ` +
        short
          .map(([k, v]) => `${k}(${v.byLeader[v.default].events}회)`)
          .join(", "),
    );
  }
  for (const theme of THEMES) {
    const s = sync[theme.slug];
    const h = leaders[theme.slug]?.handover;
    if (!s) continue;
    const d = s.byLeader[s.default];
    const L = leaders[theme.slug];
    console.log(
      `  ${theme.name.padEnd(12)} 대장 ${d.leader.padEnd(6)} ` +
        `+${d.threshold}% ${String(d.events).padStart(3)}회` +
        (L?.close ? "  (접전)" : "") +
        `  기준 후보 ${s.candidates.join("·")}` +
        (h ? `  ← 손바뀜 ${h.from}→${h.to}` : ""),
    );
  }
}

main().catch((e) => {
  console.error("[compute] 실패:", e);
  process.exit(1);
});
