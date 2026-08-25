import type { Metadata } from "next";
import { PracticeBoard } from "@/components/practice/practice-board";

export const metadata: Metadata = {
  title: "차트 훈련",
  description:
    "과거 어느 날로 돌아가 그 뒤를 가린 채 분석하고, 실제로 어떻게 됐는지 확인하는 연습장.",
};

export default function PracticePage() {
  return <PracticeBoard />;
}
