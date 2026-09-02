/**
 * 화면 표기 시험 — 조사·등락률·금액.
 *
 * 자동으로 만든 문장에 "설계이" "MSTR가" 같은 것이 섞이면 바로 기계가 쓴
 * 티가 납니다. 층 이름과 티커가 데이터에서 오기 때문에 사람이 눈으로
 * 잡을 수 없는 자리입니다.
 *
 * 실행: npx tsx scripts/test-format.ts
 */

import { josa, money, pct, tone } from "../src/lib/format";

let fail = 0;
function eq(got: unknown, want: unknown, why: string) {
  if (got === want) {
    console.log(`  ✓ ${why}`);
    return;
  }
  fail++;
  console.log(`  ✗ ${why}\n      받음 ${JSON.stringify(got)}  바람 ${JSON.stringify(want)}`);
}

console.log("\n── 조사 · 한글 받침");
eq(josa("설계", "이/가"), "가", "받침 없음 → 가");
eq(josa("패키징", "이/가"), "이", "받침 있음 → 이");
eq(josa("채굴", "은/는"), "은", "은/는 도 같은 규칙");
eq(josa("메모리", "을/를"), "를", "을/를 도 같은 규칙");

console.log("\n── 조사 · 티커를 낱자로 읽을 때");
// 실제로 동조율 기준 종목으로 고를 수 있는 것들입니다
eq(josa("NVDA", "이/가"), "가", "에이 — 받침 없음");
eq(josa("ASML", "이/가"), "이", "엘 — ㄹ");
eq(josa("TSM", "이/가"), "이", "엠 — ㅁ");
eq(josa("MSTR", "이/가"), "이", "알 — ㄹ (예전에 '가' 로 틀렸던 자리)");
eq(josa("PLTR", "이/가"), "이", "알 — ㄹ");
eq(josa("TER", "이/가"), "이", "알 — ㄹ");
eq(josa("ROK", "이/가"), "가", "케이 — 받침 없음");
eq(josa("RRX", "이/가"), "가", "엑스 — 받침 없음");
eq(josa("LMT", "이/가"), "가", "티 — 받침 없음");
eq(josa("MU", "이/가"), "가", "유 — 받침 없음");

console.log("\n── 조사 · 숫자와 빈 값");
eq(josa("층 1", "이/가"), "이", "일 — ㄹ");
eq(josa("층 2", "이/가"), "가", "이 — 받침 없음");
eq(josa("층 6", "이/가"), "이", "육 — ㄱ");
eq(josa("", "이/가"), "이", "빈 문자열이어도 터지지 않습니다");
eq(josa("층 ·", "이/가"), "이", "판단이 안 되면 받침 있는 쪽");

console.log("\n── 등락률");
eq(pct(3.21), "+3.2%", "양수에는 + 를 붙입니다");
eq(pct(-3.25), "-3.3%", "음수");
eq(pct(0), "0.0%", "0 에는 + 를 붙이지 않습니다 — 오른 것이 아니므로");
eq(pct(null), "—", "없으면 줄표");
eq(pct(Number.NaN), "—", "NaN 도 줄표");
eq(pct(Number.POSITIVE_INFINITY), "—", "무한대도 줄표");

console.log("\n── 색 (상승 빨강 · 하락 파랑)");
eq(tone(1), "up", "양수");
eq(tone(-1), "down", "음수");
eq(tone(0), "", "0 은 색 없음");
eq(tone(null), "", "없으면 색 없음");
eq(tone(Number.NaN), "", "NaN 도 색 없음");

console.log("\n── 금액");
eq(money(2_500_000_000), "$2.5B", "십억");
eq(money(2_500_000), "$3M", "백만 — 반올림");
eq(money(1234), "$1,234", "천 단위 쉼표");
eq(money(null), "—", "없으면 줄표");
eq(money(Number.NaN), "—", "NaN 도 줄표");

console.log(fail === 0 ? "\n전부 통과.\n" : `\n${fail}건 실패.\n`);
process.exit(fail === 0 ? 0 : 1);
