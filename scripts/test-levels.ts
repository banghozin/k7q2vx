/**
 * 그어 둔 자리 판정 시험.
 *
 * 화면에서는 눈으로 확인했지만, 여기 걸린 규칙들은 **조용히 틀리는** 종류라
 * 고정해 둡니다 — 종가만 보다가 장중에 찍고 되돌아온 것을 놓친다거나,
 * 수평선이 아닌 것까지 자리로 세거나, 거래일이 하루 밀리는 것들입니다.
 *
 * 실행: npx tsx scripts/test-levels.ts
 */

import type { SavedDrawing } from "../src/components/practice/kline";
import { barDay, checkLevels, levelsOf, sortLevels } from "../src/lib/levels";

const hz = (v: number): SavedDrawing => ({
  name: "horizontalStraightLine",
  points: [{ timestamp: 1_756_000_000_000, value: v }],
  color: "#fff",
  size: 2,
});

const other = (name: string): SavedDrawing => ({
  name,
  points: [
    { timestamp: 1_756_000_000_000, value: 100 },
    { timestamp: 1_756_600_000_000, value: 110 },
  ],
  color: "#fff",
  size: 2,
});

/** 미국장 개장 시각(표준시 13:30)으로 만든 일봉 */
const day = (d: string, low: number, high: number, close: number) => ({
  time: Date.parse(`${d}T13:30:00Z`) / 1000,
  low,
  high,
  close,
});

let fail = 0;
function eq(got: unknown, want: unknown, why: string) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) {
    console.log(`  ✓ ${why}`);
    return;
  }
  fail++;
  console.log(`  ✗ ${why}\n      받음 ${a}\n      바람 ${b}`);
}

console.log("\n── 어떤 그림이 자리가 되는가 ──");
eq(levelsOf([hz(100)]), [100], "수평선은 자리가 됩니다");
eq(
  levelsOf([other("segment"), other("straightLine"), other("freeCurve")]),
  [],
  "추세선·연장선·자유곡선은 자리가 아닙니다",
);
eq(levelsOf([hz(200), hz(100)]), [100, 200], "값 순으로 정렬됩니다");
eq(levelsOf([hz(100), hz(100.005)]), [100], "사람 눈에 같은 선은 하나로");
eq(levelsOf([hz(100), hz(100.5)]), [100, 100.5], "0.5% 떨어지면 다른 선");
eq(
  levelsOf([
    { ...hz(0), points: [{ timestamp: 1, value: 0 }] },
    { ...hz(1), points: [] },
    { ...hz(1), points: [{ timestamp: 1, value: Number.NaN }] },
  ]),
  [],
  "0·빈 점·NaN 은 버립니다",
);

console.log("\n── 닿았는지 ──");
const bars = [
  day("2026-08-27", 220.9, 230.47, 227.98),
  day("2026-08-28", 216.81, 229.26, 217.55),
  day("2026-08-31", 216.21, 221.3, 220.78),
  day("2026-09-01", 215.1, 220.41, 217.44),
];

const r = checkLevels("NVDA", [218, 228, 260, 150], bars);
eq(r[0].barsAgo, 0, "마지막 봉이 지나간 자리는 0거래일 전");
eq(r[0].touchedAt, "2026-09-01", "거래일은 표준시 날짜 그대로 (아홉 시간 더하지 않음)");
eq(r[1].barsAgo, 2, "이틀 전 고가에 스친 자리");
eq(r[1].touchedAt, "2026-08-28", "그날로 적힙니다");
eq(r[2].touchedAt, null, "닿은 적 없으면 null");
eq(Number(r[2].awayPct.toFixed(1)), 19.6, "위에 있는 자리는 양수");
eq(Number(r[3].awayPct.toFixed(1)), -31.0, "아래에 있는 자리는 음수");

/*
 * 종가만 봤다면 놓쳤을 자리. 장중에 229 까지 갔다가 217 로 닫은 날입니다 —
 * "닿았다" 를 종가로 재면 이런 날이 통째로 사라집니다.
 */
eq(checkLevels("X", [229], bars)[0].barsAgo, 2, "장중에만 스친 것도 셉니다");
eq(checkLevels("X", [], bars), [], "자리가 없으면 빈 목록");
eq(checkLevels("X", [100], []), [], "봉이 없으면 빈 목록");

console.log("\n── 차례 ──");
const sorted = sortLevels([
  { ticker: "A", value: 1, last: 1, touchedAt: null, barsAgo: null, awayPct: 1 },
  { ticker: "B", value: 1, last: 1, touchedAt: "x", barsAgo: 3, awayPct: 40 },
  { ticker: "C", value: 1, last: 1, touchedAt: "x", barsAgo: 0, awayPct: 90 },
  { ticker: "D", value: 1, last: 1, touchedAt: "x", barsAgo: 20, awayPct: 50 },
]);
eq(
  sorted.map((s) => s.ticker),
  ["C", "B", "A", "D"],
  "최근에 닿은 것 → 가까운 것 순 (오래전에 닿은 것은 안 닿은 것과 같이 취급)",
);

console.log("\n── 거래일 ──");
eq(barDay(Date.parse("2026-09-01T13:30:00Z") / 1000), "2026-09-01", "여름(EDT) 개장");
eq(barDay(Date.parse("2026-01-05T14:30:00Z") / 1000), "2026-01-05", "겨울(EST) 개장");

console.log(fail === 0 ? "\n전부 통과.\n" : `\n${fail}건 실패.\n`);
process.exit(fail === 0 ? 0 : 1);
