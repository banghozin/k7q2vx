/**
 * 보관해 둔 기사를 종목으로 되찾습니다.
 *
 * 차트 모달과 매매노트는 브라우저에서 도는 화면이라, 아카이브 파일을 직접
 * 가져오면 **기사 데이터가 통째로 브라우저 번들에 실려 갑니다.** 지금은 작아도
 * 쌓일수록 커집니다. 그래서 서버가 대신 찾아 필요한 것만 넘깁니다.
 *
 *   /api/news?ticker=NVDA            이 종목 기사 (최신순)
 *   /api/news?ticker=NVDA&day=2026-08-20   그 날 앞뒤 기사
 */

import { newsDaysForTicker, newsForTicker, newsOnDay } from "@/lib/news-archive";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  const day = url.searchParams.get("day");

  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) {
    return Response.json({ error: "잘못된 티커" }, { status: 400 });
  }

  if (day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return Response.json({ error: "잘못된 날짜" }, { status: 400 });
    }
    return Response.json(
      { ticker, day, items: newsOnDay(ticker, day) },
      { headers: { "Cache-Control": "public, s-maxage=3600" } },
    );
  }

  return Response.json(
    {
      ticker,
      items: newsForTicker(ticker, 8),
      // 차트에 점을 찍기 위한 날짜들
      days: newsDaysForTicker(ticker),
    },
    { headers: { "Cache-Control": "public, s-maxage=3600" } },
  );
}
