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
  searchParams: Promise<{ ticker?: string }>;
}) {
  const { ticker } = await searchParams;
  return <AnalyzeBoard initialTicker={ticker} />;
}
