import type { Metadata } from "next";
import { AnalyzeBoard } from "@/components/analyze/analyze-board";

export const metadata: Metadata = {
  title: "차트 분석",
  description:
    "종목과 봉 단위를 골라 추세선·피보나치·파동을 긋는 곳. 그린 것은 이 기기에 저장됩니다.",
};

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string; tf?: string; trade?: string }>;
}) {
  // `trade` 가 붙어 오면 매매노트에서 넘어온 회고입니다 — 그때 얼려 둔 그림을 봅니다
  const { ticker, tf, trade } = await searchParams;
  return <AnalyzeBoard initialTicker={ticker} initialTf={tf} tradeId={trade} />;
}
