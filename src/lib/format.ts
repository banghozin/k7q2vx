/**
 * 숫자를 화면에 쓰는 표기 도우미.
 *
 * market-data.ts 에서 떼어냈습니다. 그쪽은 계산된 JSON 을 통째로 가져오는데,
 * 브라우저에서 도는 컴포넌트가 표기 함수 하나 쓰려고 그 파일을 import 하면
 * **80KB 짜리 시세 데이터가 통째로 브라우저로 실려 갑니다.**
 * 표기 함수만 여기 따로 두면 그 일이 생기지 않습니다.
 */

/** 등락률을 "+3.2%" 형태로. 값이 없으면 "—" */
export function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

/** 한국 증시 관행: 상승 빨강, 하락 파랑 */
export function tone(v: number | null | undefined): "up" | "down" | "" {
  if (v == null || !Number.isFinite(v) || v === 0) return "";
  return v > 0 ? "up" : "down";
}

/**
 * 한글 조사를 받침에 맞춰 고릅니다.
 *
 *   josa("설계", "이/가")   → "가"   (설계는 받침 없음)
 *   josa("패키징", "이/가") → "이"   (징에 받침 ㅇ)
 *   josa("채굴", "은/는")   → "은"
 *
 * 자동으로 만든 문장에 "설계이", "네트워크을" 같은 게 섞이면 바로 기계가 쓴
 * 티가 납니다. 층 이름이 데이터에서 오기 때문에 반드시 필요합니다.
 */
export function josa(word: string, pair: string): string {
  const [withBatchim, withoutBatchim] = pair.split("/");
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);

  // 한글 음절 영역이면 종성 유무로 판단
  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 === 0 ? withoutBatchim : withBatchim;
  }

  /*
   * 영문·숫자로 끝나는 경우 — 소리 나는 대로 읽었을 때의 받침으로 판단.
   *
   * 받침이 있는 글자: 엘(ㄹ) 엠(ㅁ) 엔(ㄴ) **알(ㄹ)** 과
   * 영(ㅇ) 일(ㄹ) 삼(ㅁ) 육(ㄱ) 칠(ㄹ) 팔(ㄹ).
   *
   * `r` 이 빠져 있어서 동조율 화면이 **"MSTR가 크게 오른 날"** 이라고
   * 적었습니다(맞는 말은 "MSTR이"). 기준 종목으로 고를 수 있는 것 중
   * TER·PLTR·MSTR 셋이 걸렸습니다.
   *
   * 티커를 낱자로 읽는다고 보고 정합니다. UBER 처럼 낱말로 읽는 것(우버 →
   * "우버가")은 어긋나지만, 낱자로 읽는 티커가 훨씬 많고 지금 조사를 붙이는
   * 자리(동조율 기준 종목)에는 그런 티커가 없습니다.
   */
  const lower = ch.toLowerCase();
  const endsWithBatchim = "lmnr013678".includes(lower);
  if (/[a-z0-9]/.test(lower)) {
    return endsWithBatchim ? withBatchim : withoutBatchim;
  }

  // 판단이 안 되면 받침 있는 쪽으로 (더 자연스럽게 읽히는 편)
  return withBatchim;
}

/** 큰 금액을 읽기 쉽게. 달러라 조·억 대신 M·B 를 씁니다 */
export function money(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}
