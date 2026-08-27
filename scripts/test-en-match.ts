/**
 * 영문 기사 종목 판정 시험.
 *
 * 한국어 쪽에서 "디지털 일자리센터"가 디지털 리얼티로 걸렸던 것과 같은 사고를
 * 영어에서 미리 막습니다. 실제 피드에서 볼 법한 문장을 그대로 넣었습니다.
 *
 * 실행: npx tsx scripts/test-en-match.ts
 */

import { enMatch } from "../src/lib/en-match";

type Case = {
  text: string;
  want?: string[];   // 반드시 걸려야 하는 티커
  never?: string[];  // 걸리면 안 되는 티커
  why: string;
};

const CASES: Case[] = [
  // ── 걸려야 하는 것 ──────────────────────────────────────────
  {
    text: "Nvidia wows Wall Street with a strong quarter and an eye-popping sales forecast",
    want: ["NVDA"],
    why: "회사 이름 그대로",
  },
  {
    text: "Micron shares jump as HBM demand outpaces supply",
    want: ["MU"],
    why: "첫 낱말 별칭 (Micron Technology)",
  },
  {
    text: "Broadcom (AVGO) beats on earnings; Marvell slides",
    want: ["AVGO", "MRVL"],
    why: "괄호 티커 + 이름",
  },
  {
    text: "Applied Materials guides higher on China orders",
    want: ["AMAT"],
    why: "회사 이름 전체는 걸려야 함 (첫 낱말 Applied 은 막혀 있음)",
  },
  {
    text: "Analysts raise targets on $CRWV after cloud deal",
    want: ["CRWV"],
    why: "달러 기호 표기",
  },
  {
    text: "Cloudflare said the outage lasted 40 minutes",
    want: ["NET"],
    why: "티커는 애매하지만 이름으로 잡힘",
  },
  {
    text: "Palo Alto Networks completes SailPoint integration",
    want: ["PANW", "SAIL"],
    why: "Palo 는 막혀 있지만 전체 이름은 걸림",
  },
  {
    text: "Constellation Energy signs a new data center power deal",
    want: ["CEG"],
    why: "두 낱말 이름",
  },
  {
    text: "Eli Lilly raises obesity drug outlook",
    want: ["LLY"],
    why: "Eli 는 막혀 있지만 'Eli Lilly' 전체는 걸림",
  },
  {
    text: "Shares of Vistra and Talen Energy rose on grid demand",
    want: ["VST", "TLN"],
    why: "한 문장에 둘",
  },

  // ── 2026-08-27 점검에서 실제로 놓치고 있던 것 ──────────────
  {
    text: "intel sources say Intel will delay the fab",
    want: ["INTC"],
    why: "나온 자리를 전부 봐야 함 — 처음 걸린 소문자만 보고 포기했었다",
  },
  {
    text: "lucid dreaming study published; Lucid shares rose 4%",
    want: ["LCID"],
    why: "같은 이유. 낱말 순서에 따라 답이 달라지면 안 된다",
  },
  {
    text: "nVent Electric lifts outlook on data center demand",
    want: ["NVT"],
    why: "소문자로 시작하는 상표(nVent·iRobot 꼴)",
  },
  {
    text: "Boeing wins a 200-plane order from Emirates",
    want: ["BA"],
    why: "야후는 'The Boeing Company' 라 주는데 기사는 'Boeing' 이라 쓴다",
  },
  {
    text: "Bank of New York Mellon raised its dividend",
    want: ["BNY"],
    why: "같은 이유 — 앞의 The 를 떼야 걸린다",
  },

  // ── 절대 걸리면 안 되는 것 ─────────────────────────────────
  {
    text: "Bank shares rose across the sector",
    never: ["BNY"],
    why: "The 를 떼면서 'Bank' 가 첫 낱말이 됐다. 전체 이름일 때만 잡아야",
  },
  {
    text: "Fed Chair Jerome Powell signals a pause in rate cuts",
    never: ["POWL"],
    why: "겪을 뻔한 오탐: 파월 의장 → Powell Industries",
  },
  {
    text: "Advanced manufacturing jobs grew last quarter",
    never: ["AMD", "AEIS"],
    why: "'Advanced' 는 AMD·AEIS 둘 다와 겹쳐서 막아야 함",
  },
  {
    text: "The company applied for a new permit",
    never: ["AMAT"],
    why: "동사 applied 는 소문자 — 대소문자를 구별해야 함",
  },
  {
    text: "A meta-analysis of clinical trials found no benefit",
    never: ["META"],
    why: "하이픈 뒤 — 낱말 경계에서 막아야 함",
  },
  {
    text: "Net income rose 12% year over year",
    never: ["NET"],
    why: "맨몸 'Net' 은 티커로 잡으면 안 됨",
  },
  {
    text: "The general market tone stayed cautious",
    never: ["GD", "GM"],
    why: "'general' 은 일반 낱말",
  },
  {
    text: "Digital advertising spending slowed in the quarter",
    never: ["DLR"],
    why: "한국어 쪽에서 실제로 겪은 오탐의 영어판",
  },
  {
    text: "Uranium prices climbed on supply concerns",
    never: ["UEC", "UUUU"],
    why: "원자재 이름은 회사 이름이 아님",
  },
  {
    text: "Quantum computing research advanced at MIT",
    never: ["QBTS", "QUBT"],
    why: "기술 분야 이름",
  },
  {
    text: "Investors are watching the Taiwan election closely",
    never: ["TSM"],
    why: "나라 이름 — 'Taiwan Semiconductor' 전체일 때만",
  },
  {
    text: "The arm of the agency will review the merger",
    never: ["ARM"],
    why: "일상어 arm",
  },
  {
    text: "Star performers in the S&P 500 this month",
    never: ["STNG", "SBLK"],
    why: "'Star' 는 흔한 낱말",
  },
  {
    text: "Riot police were deployed near the plant",
    never: ["RIOT"],
    why: "맨몸 RIOT 은 막혀 있고 'Riot' 도 첫 낱말 별칭에서 제외",
  },
  {
    text: "Hut occupancy at the ski resort hit a record",
    never: ["HUT"],
    why: "짧고 흔한 낱말",
  },
];

let pass = 0;
let fail = 0;
const failures: string[] = [];

for (const c of CASES) {
  const got = enMatch(c.text);
  const missing = (c.want ?? []).filter((t) => !got.includes(t));
  const bad = (c.never ?? []).filter((t) => got.includes(t));
  const ok = missing.length === 0 && bad.length === 0;

  if (ok) pass++;
  else {
    fail++;
    failures.push(
      `  ${c.text}\n     못 잡음: [${missing.join(", ")}]  잘못 잡음: [${bad.join(", ")}]  실제: [${got.join(", ")}]`,
    );
  }

  console.log(
    `  ${ok ? "OK  " : "FAIL"} ${c.text.slice(0, 58).padEnd(58)} → [${got.join(", ")}]`,
  );
}

console.log(`\n영문 판정 ${pass}/${pass + fail} 통과`);
if (fail > 0) {
  console.log("\n실패한 것:");
  for (const f of failures) console.log(f);
  process.exit(1);
}
