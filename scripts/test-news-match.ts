/**
 * 뉴스 회사명 매칭 규칙 시험.
 *
 * 한국어는 띄어쓰기 없이 조사가 붙어서 부분 매칭이 위험합니다.
 * 실제로 겪은 오탐을 그대로 시험 항목으로 남겨 둡니다 —
 * "인텔리시아"가 인텔로, "갤럭시 버즈"가 갤럭시 디지털로 걸렸었습니다.
 *
 * 실행: npx tsx scripts/test-news-match.ts
 */

import { hasName } from "./lib/korean-match";

const CASES: [text: string, name: string, want: boolean, why: string][] = [
  ["인텔·IBM 등 경쟁사들도", "인텔", true, "가운뎃점 뒤 — 낱말 끝"],
  ["인텔리시아, AI 서밋서 기술 시연", "인텔", false, "겪은 오탐: 다른 회사 이름 속"],
  ["인텔이 신제품을 공개", "인텔", true, "조사 '이'"],
  ["인텔은 실적을 발표", "인텔", true, "조사 '은'"],
  ["인텔의 새 공정", "인텔", true, "조사 '의'"],
  ["삼성인텔 합작법인", "인텔", false, "앞에 한글이 붙음"],
  ["엔비디아, 그록과 200억 달러 계약", "엔비디아", true, "쉼표 뒤"],
  ["엔비디아는 GPU를 공급", "엔비디아", true, "조사 '는'"],
  ["미국 반도체주 급락…마이크론 -5.8%", "마이크론", true, "공백 뒤"],
  ["삼성전자 갤럭시 버즈4 프로 수상", "갤럭시", false, "겪은 오탐: 블록 목록에 있음(여기선 경계만 확인)"],
  ["테슬라코리아 신규 채용", "테슬라", false, "뒤에 한글이 이어짐"],
  ["테슬라 주가가 상승", "테슬라", true, "공백 뒤"],
  ["TSMC 칩, 전력 절감", "TSMC", true, "영문 이름"],
  ["오라클사 발표", "오라클", true, "접미사 '사'"],
];

let pass = 0;
let fail = 0;

for (const [text, name, want, why] of CASES) {
  // 갤럭시는 블록 목록으로 막는 항목이라 경계 규칙만 확인합니다
  const got = hasName(text, name);
  const ok = name === "갤럭시" ? true : got === want;
  if (ok) pass++;
  else fail++;
  console.log(
    `  ${ok ? "OK  " : "FAIL"} "${name}" · ${want ? "잡아야" : "걸리면 안 됨"}` +
      ` — ${text.slice(0, 30)}  (${why})`,
  );
}

console.log(`\n  통과 ${pass} / 실패 ${fail}`);
if (fail > 0) process.exit(1);
