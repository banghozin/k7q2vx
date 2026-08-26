/**
 * 일봉 차트 데이터.
 *
 * 브라우저에서 야후를 직접 부르면 차단(CORS)되므로 서버가 대신 받아서 넘깁니다.
 * 이건 차트를 열 때만 부르는 즉석 조회이고, 층별 성과·동조율 같은 계산은
 * 나중에 하루 1회 미리 만들어 두는 방식으로 따로 붙습니다.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/*
 * 훈련 화면에서 봉 단위를 고를 수 있어야 해서 분봉부터 월봉까지 엽니다.
 *
 * 야후는 짧은 봉일수록 보관 기간이 짧습니다 — 분봉은 두 달, 60분봉은 두 해,
 * 일봉 이상은 전 기간입니다. 4시간봉은 야후가 주지 않아 60분봉을 넷씩 묶어
 * 화면에서 만듭니다.
 */
const OK_INTERVAL = new Set(["5m", "15m", "30m", "60m", "1d", "1wk", "1mo"]);
const OK_RANGE = new Set([
  "1mo",
  "3mo",
  "6mo",
  "1y",
  "2y",
  "5y",
  "10y",
  "max",
  "7d",
  "60d",
  "730d",
]);

type YahooChart = {
  chart: {
    result?: Array<{
      meta: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency?: string;
        exchangeName?: string;
        longName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: unknown;
  };
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  const interval = url.searchParams.get("interval") ?? "1d";
  const range = url.searchParams.get("range") ?? "1y";

  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) {
    return Response.json({ error: "잘못된 티커" }, { status: 400 });
  }
  if (!OK_INTERVAL.has(interval) || !OK_RANGE.has(range)) {
    return Response.json({ error: "잘못된 구간" }, { status: 400 });
  }

  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=${interval}&range=${range}`;

  try {
    const r = await fetch(target, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 900 }, // 15분 캐시
    });
    if (!r.ok) {
      return Response.json({ error: "시세를 받지 못했습니다" }, { status: 502 });
    }
    const data = (await r.json()) as YahooChart;
    const result = data.chart.result?.[0];
    const q = result?.indicators?.quote?.[0];
    const ts = result?.timestamp;
    if (!result || !q || !ts) {
      return Response.json({ error: "데이터 없음" }, { status: 404 });
    }

    const candles = [];
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      if (
        typeof o !== "number" ||
        typeof h !== "number" ||
        typeof l !== "number" ||
        typeof c !== "number"
      )
        continue;
      candles.push({
        time: ts[i],
        open: o,
        high: h,
        low: l,
        close: c,
        volume: typeof q.volume?.[i] === "number" ? (q.volume[i] as number) : 0,
      });
    }

    const last = candles.at(-1);
    const prev = candles.at(-2);
    const changePct =
      last && prev && prev.close > 0
        ? ((last.close - prev.close) / prev.close) * 100
        : null;

    return Response.json(
      {
        ticker,
        candles,
        last: last?.close ?? null,
        changePct,
        currency: result.meta.currency ?? null,
        exchange: result.meta.exchangeName ?? null,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return Response.json({ error: "조회 실패" }, { status: 502 });
  }
}
