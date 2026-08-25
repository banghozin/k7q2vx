/**
 * 한국어 기사에서 회사명을 찾을 때 쓰는 경계 판정.
 *
 * 한국어는 띄어쓰기 없이 조사가 붙습니다 — "인텔이", "엔비디아는". 그래서
 * 단순 부분 문자열 검색을 쓰면 조사가 붙은 경우를 놓치고, 반대로 뒤에 한글이
 * 오면 무조건 통과시키면 **다른 낱말에 걸립니다.**
 *
 * 실제로 겪은 오탐:
 *   "인텔리시아, AI 서밋서…"  → 인텔(INTC) 로 잘못 걸림
 *   "삼성전자 갤럭시 버즈4"    → 갤럭시 디지털(GLXY) 로 잘못 걸림
 *
 * 규칙은 두 가지입니다.
 *   앞: 한글이 붙어 있으면 다른 낱말의 일부다 ("삼성인텔")
 *   뒤: 한글이 아니거나, 조사로 쓰이는 글자여야 한다
 */

/** 회사명 뒤에 붙어도 같은 낱말로 볼 수 있는 조사·접미사의 첫 글자 */
const PARTICLE_HEAD = new Set(
  "은는이가을를의에와과도만로으라나든부까처보밖조서사측대".split(""),
);

const isHangul = (ch: string | undefined): boolean =>
  !!ch && /[가-힣]/.test(ch);

export function hasName(text: string, name: string): boolean {
  let i = text.indexOf(name);
  while (i >= 0) {
    const before = i > 0 ? text[i - 1] : undefined;
    const after = text[i + name.length];
    if (!isHangul(before)) {
      if (!isHangul(after) || PARTICLE_HEAD.has(after as string)) return true;
    }
    i = text.indexOf(name, i + 1);
  }
  return false;
}
