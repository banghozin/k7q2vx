/**
 * Yahoo Finance 일봉 조회 공통 모듈.
 *
 * 원래 계획은 stooq 의 공개 CSV 였으나, 2026년 8월 현재 stooq 는 자바스크립트
 * 증명(proof-of-work) 방식 봇 차단을 걸어 CSV 대신 검증 페이지를 돌려준다.
 * 스크립트로는 쓸 수 없어 Yahoo Finance v8 chart 엔드포인트로 전환했다.
 *
 * 예의:
 *   - 동시 4개까지만, 요청 사이 200ms
 *   - 429/503 이면 지수 백오프로 2회까지 재시도
 *   - 하루 1회만 도는 스크립트라 총 부하가 크지 않다
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export const CONCURRENCY = 4;
export const GAP_MS = 200;
export const RETRIES = 2;

export type Bar = {
  /** 거래일 (unix seconds, UTC 자정 기준이 아니라 Yahoo 가 주는 값 그대로) */
  t: number;
  /** 종가 */
  c: number;
  /** 수정 종가 — 분할·배당이 반영된 값. 수익률 계산은 반드시 이걸 쓴다 */
  a: number;
  /** 거래량 */
  v: number;
};

export type Series = {
  ticker: string;
  bars: Bar[];
};

/**
 * 우리 데이터의 티커 표기를 Yahoo 표기로 바꾼다.
 * 예: MOG.A → MOG-A (Yahoo 는 클래스 구분에 하이픈을 쓴다)
 */
export function toYahoo(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, "-");
}

export const sleep = (ms: number) =>
  new Promise((r) => setTimeout(r, ms));

type YahooChart = {
  chart: {
    result?: Array<{
      meta?: { longName?: string; currency?: string };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

export class FetchError extends Error {
  constructor(
    public ticker: string,
    message: string,
  ) {
    super(message);
  }
}

/** 티커 하나의 일봉을 받아온다. 실패하면 FetchError 를 던진다. */
export async function fetchSeries(
  ticker: string,
  range = "2y",
  attempt = 0,
): Promise<Series> {
  const sym = toYahoo(ticker);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}` +
    `?interval=1d&range=${range}&events=div%2Csplit`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
  } catch (e) {
    if (attempt < RETRIES) {
      await sleep(1500 * (attempt + 1));
      return fetchSeries(ticker, range, attempt + 1);
    }
    throw new FetchError(ticker, `네트워크 실패: ${String(e)}`);
  }

  if (res.status === 429 || res.status === 503) {
    if (attempt < RETRIES) {
      // 지수 백오프 — 2초, 4초
      await sleep(2000 * Math.pow(2, attempt));
      return fetchSeries(ticker, range, attempt + 1);
    }
    throw new FetchError(ticker, `요청이 막혔습니다 (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new FetchError(ticker, `HTTP ${res.status}`);
  }

  const json = (await res.json()) as YahooChart;
  if (json.chart.error) {
    throw new FetchError(
      ticker,
      json.chart.error.description ?? "상장폐지되었거나 없는 티커",
    );
  }

  const r = json.chart.result?.[0];
  const ts = r?.timestamp;
  const q = r?.indicators?.quote?.[0];
  const adj = r?.indicators?.adjclose?.[0]?.adjclose;
  if (!r || !ts || !q) {
    throw new FetchError(ticker, "데이터 없음");
  }

  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close?.[i];
    if (typeof c !== "number" || !Number.isFinite(c) || c <= 0) continue;
    const a = adj?.[i];
    bars.push({
      t: ts[i],
      c,
      // 수정 종가가 없으면 종가로 대체 (수익률이 분할 때 튈 수 있으므로
      // compute 단계에서 이상치 상한으로 한 번 더 거른다)
      a: typeof a === "number" && Number.isFinite(a) && a > 0 ? a : c,
      v: typeof q.volume?.[i] === "number" ? (q.volume[i] as number) : 0,
    });
  }

  if (bars.length === 0) throw new FetchError(ticker, "유효한 봉이 없음");
  return { ticker: ticker.trim().toUpperCase(), bars };
}

/**
 * 여러 티커를 동시성 제한을 지키며 받아온다.
 * 개별 실패는 죽이지 않고 모아서 돌려준다 — 한 종목 때문에 전체가 멈추면 안 된다.
 */
export async function fetchMany(
  tickers: string[],
  range = "2y",
  onProgress?: (done: number, total: number, ticker: string, ok: boolean) => void,
): Promise<{ series: Series[]; failed: { ticker: string; reason: string }[] }> {
  const series: Series[] = [];
  const failed: { ticker: string; reason: string }[] = [];
  let done = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < tickers.length) {
      const t = tickers[cursor++];
      try {
        const s = await fetchSeries(t, range);
        series.push(s);
        done++;
        onProgress?.(done, tickers.length, t, true);
      } catch (e) {
        failed.push({
          ticker: t,
          reason: e instanceof Error ? e.message : String(e),
        });
        done++;
        onProgress?.(done, tickers.length, t, false);
      }
      await sleep(GAP_MS);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tickers.length) }, worker),
  );

  // 입력 순서대로 정렬해 결과가 실행마다 흔들리지 않게 한다 (diff 안정)
  const order = new Map(tickers.map((t, i) => [t.toUpperCase(), i]));
  series.sort(
    (a, b) => (order.get(a.ticker) ?? 0) - (order.get(b.ticker) ?? 0),
  );
  failed.sort(
    (a, b) =>
      (order.get(a.ticker.toUpperCase()) ?? 0) -
      (order.get(b.ticker.toUpperCase()) ?? 0),
  );

  return { series, failed };
}
