/**
 * 기사에서 우리 종목을 찾아내는 판정.
 *
 * fetch-news 스크립트와 회귀 테스트가 **같은 코드**를 쓰도록 여기 둡니다.
 * 예전에는 스크립트 안에 있어서, 테스트는 통과하는데 실제 별칭 만들기에서
 * 오탐이 나는 일이 있었습니다("디지털"이 디지털 리얼티로 걸린 건).
 */

import { THEMES } from "../data/themes";
import { hasName } from "./korean-match";

/**
 * 회사 이름의 첫 낱말이지만 **일상어라 남의 기사에 걸리는** 것들.
 *
 * 회사명이 두 낱말 이상이면 첫 낱말도 별칭으로 씁니다("엔비디아 코퍼레이션"
 * → "엔비디아"). 그런데 그 첫 낱말이 흔한 말이면 엉뚱한 기사가 걸립니다.
 * 실제로 걸렸던 것:
 *   "AI·디지털 일자리센터 개관"      → 디지털 리얼티(DLR)
 *   "사우디 원전 협정, 우라늄 농축"  → 우라늄 에너지(UEC)
 *   "삼성전자 갤럭시 버즈"           → 갤럭시 디지털(GLXY)
 *
 * 여기 적힌 낱말은 **첫 낱말 별칭으로 쓰지 않습니다.** 회사 전체 이름
 * ("디지털 리얼티")이 통째로 나오면 그때는 정상적으로 걸립니다.
 */
const AMBIGUOUS_NAMES = new Set([
  "블록",
  "서클",
  "코어",
  "스트래티지",
  "리듬",
  "에너지",
  "글로벌",
  "아메리카스",
  "갤럭시",
  // 아래는 2026-08-26 에 실제 오탐을 보고 추가했습니다
  "디지털",
  "우라늄",
  "이리듐",
  "웨스트",
  "플렉스",
  "바이킹",
  "오로라",
  "헌팅턴", // 헌팅턴 무도병 기사에 걸립니다
  "솔리드",
  "제너럴",
  "체크포인트",
  "블링크",
  "플래닛",
  "일라이",
]);

/**
 * 두 글자라도 써도 되는 회사명.
 *
 * 짧은 이름은 아무 문장에나 걸려서 원칙적으로 뺍니다. 그런데 그 규칙 때문에
 * "인텔·IBM 등 경쟁사들도" 라는 문장에서 IBM 은 잡히고 **인텔은 놓쳤습니다.**
 * 한국어 기사에서 다른 뜻으로 쓰일 일이 거의 없는 것만 골라 되살립니다.
 * ("메타", "포드" 처럼 일반 낱말과 겹치는 것은 넣지 않습니다.)
 */
const SAFE_SHORT = new Set(["인텔", "퀄컴", "마벨"]);

/**
 * 한글 회사명 → 티커.
 *
 * 회사명 전체("포드 모터")뿐 아니라 **첫 어절**("포드")도 넣습니다. 기사에서는
 * 정식 명칭보다 줄여 쓰는 일이 훨씬 많기 때문입니다. 다만 첫 어절이 세 글자
 * 미만이면(예: "델") 아무 문장에나 걸리므로 넣지 않습니다.
 */
export function buildMatchers() {
  const byName = new Map<string, string>();
  const tickers = new Set<string>();
  for (const theme of THEMES) {
    for (const layer of theme.layers) {
      for (const s of layer.stocks) {
        tickers.add(s.ticker.toUpperCase());
        const full = s.name.trim();
        const usable = (w: string) =>
          !AMBIGUOUS_NAMES.has(w) && (w.length >= 3 || SAFE_SHORT.has(w));

        if (usable(full)) byName.set(full, s.ticker);

        /*
         * 첫 낱말 별칭은 **한글일 때만** 씁니다.
         *
         * "AST 스페이스모바일" 의 "AST" 를 별칭으로 두면 FAST·LAST 안에서도
         * 걸립니다. 이름 판정은 앞뒤에 한글이 있는지만 보기 때문에 영문
         * 낱말의 경계를 못 지킵니다. 영문 약칭은 어차피 티커 판정이
         * 앞뒤 영숫자까지 확인하며 잡으므로 여기서 뺍니다.
         */
        const head = full.split(/\s+/)[0];
        if (/[가-힣]/.test(head) && usable(head) && !byName.has(head)) {
          byName.set(head, s.ticker);
        }
      }
    }
  }
  return { byName, tickers };
}

const { byName, tickers } = buildMatchers();

/** 티커는 앞뒤가 영문·숫자가 아닐 때만 잡습니다. 세 글자 미만은 오탐이 심해 뺍니다. */
export function tickersIn(text: string): string[] {
  const hit = new Set<string>();
  const upper = text.toUpperCase();
  for (const t of tickers) {
    if (t.length < 3) continue;
    const i = upper.indexOf(t);
    if (i < 0) continue;
    const before = i === 0 ? " " : upper[i - 1];
    const after = upper[i + t.length] ?? " ";
    if (/[A-Z0-9]/.test(before) || /[A-Z0-9]/.test(after)) continue;
    hit.add(t);
  }
  return [...hit];
}

export function namesIn(text: string): string[] {
  const hit = new Set<string>();
  for (const [name, ticker] of byName) {
    if (hasName(text, name)) hit.add(ticker);
  }
  return [...hit];
}
