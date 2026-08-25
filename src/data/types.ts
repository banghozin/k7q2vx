/**
 * 테마 지도의 데이터 골격.
 *
 * 여기 정의된 모양만 지키면 테마를 몇 개든 붙일 수 있습니다.
 * 새 테마를 추가하는 일 = `src/data/themes/` 에 파일 하나를 더 만드는 일.
 */

export type Stock = {
  /** 미국 상장 티커. 이 사이트는 미국 상장 종목만 다룹니다. */
  ticker: string;
  /** 한국어 표기 회사명 */
  name: string;
  /**
   * 이 사이트의 핵심. "왜 이 종목이 이 층에 있는가"를 한 줄로.
   * 여기에 매수/매도 의견을 쓰지 않습니다. 산업 구조상의 위치만 씁니다.
   */
  why: string;
  /** 이 층의 대표격이라 화면에서 먼저 보여줄 종목 (시총 1위라는 뜻이 아님) */
  anchor?: boolean;
};

export type Layer = {
  /** 층 번호. 1이 가장 아래(원재료·설계), 숫자가 클수록 최종 서비스에 가깝습니다. */
  n: number;
  /** 딥링크용 키. /theme/ai#layer-gpu 같은 주소에 쓰입니다. */
  key: string;
  /** 층 이름 */
  name: string;
  /** 이 층이 밸류체인에서 하는 일, 한 줄 */
  role: string;
  /**
   * 이 층을 볼 때 오해하기 쉬운 점.
   * 예: "미국 상장 HBM 공급사는 MU 하나뿐입니다."
   * 숨기지 않고 그대로 적는 것이 이 사이트의 태도입니다.
   */
  caution?: string;
  stocks: Stock[];
};

export type Theme = {
  /** 주소에 쓰이는 영문 키 */
  slug: string;
  /** 화면에 뜨는 테마 이름 */
  name: string;
  /** 테마 한 줄 요약 */
  tagline: string;
  /** 이 테마에서 사람들이 실제로 던지는 질문 */
  question: string;
  /** 테마별 강조 색조 (CSS 색상값) */
  accent: string;
  /** 뉴스 매칭에 쓰이는 한국어 키워드 */
  newsKeywords: string[];
  /** 큐레이션을 마지막으로 손본 날짜 (YYYY-MM-DD) */
  curatedAt: string;
  /** 1층부터 오름차순으로 적습니다. 화면에서는 뒤집어서 위가 최상층이 됩니다. */
  layers: Layer[];
};

/** 티커 하나가 어느 테마 · 어느 층에 있는지 되짚는 결과 */
export type Placement = {
  themeSlug: string;
  themeName: string;
  layerN: number;
  layerName: string;
  stock: Stock;
};
