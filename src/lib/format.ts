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

/** 큰 금액을 읽기 쉽게. 달러라 조·억 대신 M·B 를 씁니다 */
export function money(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}
