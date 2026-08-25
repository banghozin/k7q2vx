/**
 * "이 종목에게 이 테마는 곁다리다" 표시.
 *
 * 왜 필요한가.
 * 양자컴퓨팅 테마에는 IBM·구글·마이크로소프트가 들어 있습니다. 이들이 양자를
 * 하는 건 사실이지만 **회사 전체 매출에서 양자는 티끌**입니다. 이런 종목을
 * 그대로 두고 대장주를 계산하면, 테마 고유의 흐름이 대기업 주가에 파묻혀
 * 엉뚱한 종목이 대장으로 뽑힙니다. 실제로 양자 대장에 광부품 회사가,
 * 사이버보안 대장에 마이크로소프트가 나왔습니다.
 *
 * 그래서 곁다리로 표시된 종목은:
 *   - 테마에는 그대로 남습니다 (구조 설명에 필요하므로)
 *   - 동조율의 구성원으로도 그대로 셉니다
 *   - **대장주 후보에서만 빠집니다**
 *
 * 판단 기준은 하나입니다 — "이 테마 소식으로 이 회사 실적이 눈에 띄게 바뀌는가".
 * 아니라면 곁다리입니다. 사람이 판단해 손으로 적는 목록이고, 그게 맞습니다.
 */

export const PERIPHERAL: Record<string, string[]> = {
  // 양자는 이들 매출의 티끌입니다. 양자 뉴스로 주가가 크게 움직이지 않습니다.
  quantum: [
    "NVDA",
    "AMD",
    "KEYS",
    "IBM",
    "GOOGL",
    "MSFT",
    "AMZN",
    "HON",
    "PANW",
    "COHR",
    "LITE",
    // 아래 셋은 반도체 장비가 본업이고 양자는 아주 작은 응용처입니다.
    // 빼지 않으면 반도체 업황이 양자 테마의 대장을 결정해 버립니다.
    "MKSI",
    "FORM",
    "AEIS",
  ],

  // 보안은 이들의 본업이 아니거나(시스코·MS) 사업의 일부입니다.
  security: ["MSFT", "CSCO"],

  // 로봇 매출이 아직 회사 실적을 좌우하지 않는 대형 산업재·반도체.
  robot: ["NVDA", "QCOM", "HON", "EMR", "PH", "AME", "TSLA"],

  // 자율주행이 지금 매출을 만들지 않는 회사들.
  autonomous: ["QCOM", "GOOGL", "UBER", "LYFT", "ALV"],

  // 전기차·충전이 매출의 작은 조각인 회사들.
  ev: ["ETN", "UUUU"],

  // 비만약이 실적을 좌우하지 않는 장비·유통 대기업.
  obesity: ["TMO", "DHR", "CRL", "MCK", "CVS", "BDX"],

  // 우주가 본업 실적을 좌우하지 않는 곳.
  space: ["BA"],

  // 디지털자산 노출이 재무에서 차지하는 비중이 작은 곳.
  crypto: ["PYPL", "BLK", "BNY"],

  // AI 테마는 대기업도 실제 수요·투자 주체라 곁다리로 보지 않습니다.
  ai: [],
  power: [],
  shipping: [],
};

const sets = new Map<string, Set<string>>(
  Object.entries(PERIPHERAL).map(([k, v]) => [k, new Set(v)]),
);

/** 이 테마에서 이 종목이 곁다리인가 */
export function isPeripheral(themeSlug: string, ticker: string): boolean {
  return sets.get(themeSlug)?.has(ticker.toUpperCase()) ?? false;
}
