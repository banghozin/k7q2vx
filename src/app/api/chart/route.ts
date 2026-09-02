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

/*
 * ⚠️ `range=max` 는 **요청한 봉 단위를 무시합니다.** 전체 기간 길이를 보고
 * 야후가 제 마음대로 정합니다. 2026-08-27 에 재어 본 것 — 전부 `1mo` 로
 * 요청했는데:
 *
 *   ETN·MU (1984년 상장)  → 3개월봉(분기봉)
 *   NVDA   (1999년 상장)  → 1개월봉
 *   IONQ   (2021년 상장)  → 1주봉
 *   GEV    (2024년 상장)  → 1주봉
 *
 * 그래서 "월봉" 버튼이 종목에 따라 분기봉이나 주봉을 보여주고 있었습니다.
 * **기간을 명시하면 어떤 값이든 요청한 단위가 그대로 옵니다.** 월봉은
 * `40y` 를 씁니다(ETN 481봉 = 40년치). `max` 는 목록에 두되 쓰지 마세요.
 */
const OK_RANGE = new Set([
  "1mo",
  "3mo",
  "6mo",
  "1y",
  "2y",
  "5y",
  "10y",
  "15y",
  "20y",
  "25y",
  "30y",
  "40y",
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
        /** 야후가 실제로 돌려준 봉 단위. 요청한 것과 다를 수 있습니다 */
        dataGranularity?: string;
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

  /*
   * ⚠️ 야후는 **점을 하이픈으로** 씁니다. 무그(Moog)의 A종 주식은 우리
   * 큐레이션에 `MOG.A` 로 적혀 있는데, 야후에 그대로 물으면 404 입니다
   * (`MOG-A` 는 200). 하루 1회 시세를 모으는 쪽(`scripts/lib/yahoo.ts`)에는
   * 이 정규화가 처음부터 있었는데 **브라우저가 부르는 이 자리에는 빠져
   * 있었습니다.** 그래서 층 지도에서 그 카드를 눌러도 차트가 안 열렸습니다.
   *
   * 지금 점이 든 티커는 이것 하나뿐이지만, 우선주·종류주는 앞으로도
   * 들어올 수 있으므로 규칙으로 둡니다.
   */
  const yahooTicker = ticker.replace(/\./g, "-");

  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooTicker,
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
      /*
       * `typeof x === "number"` 만 보면 **NaN 도 통과**하고 0·음수도
       * 통과합니다. 그런 봉 하나가 섞이면 고저점 검출이 통째로 멈추고
       * (NaN 비교는 전부 거짓) 차트 눈금도 0까지 늘어납니다.
       */
      if (
        typeof o !== "number" ||
        typeof h !== "number" ||
        typeof l !== "number" ||
        typeof c !== "number"
      )
        continue;
      // typeof 만으로는 NaN 이 통과합니다 — 위 설명 참고
      if (
        !Number.isFinite(o) ||
        !Number.isFinite(h) ||
        !Number.isFinite(l) ||
        !Number.isFinite(c) ||
        c <= 0
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

    /*
     * 야후는 주봉·월봉에 **진행 중인 기간 봉을 하나 더** 붙여 줍니다.
     * 2026-08-27 에 확인한 것:
     *
     *   1wk … 08-17(209.x) · 08-24(209.66) · 08-26(209.66)  ← 마지막이 중복
     *   1mo … 07-01(200.75) · 08-01(209.66) · 08-26(209.66)  ← 마지막이 중복
     *
     * 앞의 봉이 이미 오늘까지 반영하고 있어서 값이 똑같습니다. 그대로 두면
     * 차트에 가짜 봉이 하나 더 그려지고, 등락률이 **0.00%** 로 나옵니다.
     *
     * 간격의 중앙값으로 재는 방법을 먼저 써 봤는데 **월봉에서 안 걸립니다** —
     * 08-01 에서 08-26 은 25일이라 평소 간격(30일)의 절반을 넘습니다.
     * 그래서 봉 단위를 직접 보고, 마지막 봉이 앞 봉과 **같은 기간 안에**
     * 들어 있으면 덧붙은 것으로 봅니다. 일봉·분봉에는 적용하지 않습니다.
     */
    const PERIOD_SEC: Record<string, number> = {
      // 한 칸이 최소 며칠인가. 2월(28일)에도 안 걸리게 월봉은 27일로 둡니다.
      "1wk": 6 * 86400,
      "1mo": 27 * 86400,
    };
    const minSpan = PERIOD_SEC[interval];
    if (minSpan && candles.length >= 2) {
      const a = candles[candles.length - 2].time;
      const b = candles[candles.length - 1].time;
      if (b - a < minSpan) candles.pop();
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
        /*
         * 요청한 봉 단위와 **실제로 온 것**. range=max 처럼 야후가 제멋대로
         * 바꾸는 경우가 있어 나중에 되짚을 수 있게 같이 넘깁니다.
         */
        interval,
        granularity: result.meta.dataGranularity ?? null,
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
