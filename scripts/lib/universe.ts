import { THEMES } from "../../src/data/themes";

/**
 * 상대강도 기준이 되는 지수 ETF. 테마 종목은 아니지만 계산에 필요해 함께 받아옵니다.
 */
export const BENCHMARKS = ["SPY", "QQQ"] as const;

/** 테마 파일에 올라 있는 모든 티커 (중복 제거, 정렬) */
export function themeTickers(): string[] {
  const set = new Set<string>();
  for (const theme of THEMES) {
    for (const layer of theme.layers) {
      for (const stock of layer.stocks) {
        set.add(stock.ticker.trim().toUpperCase());
      }
    }
  }
  return [...set].sort();
}

/** 조회해야 하는 전체 티커 = 테마 종목 + 벤치마크 */
export function allFetchTickers(): string[] {
  const set = new Set(themeTickers());
  for (const b of BENCHMARKS) set.add(b);
  return [...set].sort();
}
