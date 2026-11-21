/**
 * 차트 분석에서 켤 수 있는 보조지표 목록과 각 지표의 설정 칸.
 *
 * 처음에는 6개만 꺼내 놓고 설정도 못 바꿨습니다. 트레이딩뷰 무료판이 지표를
 * 두 개로 묶어 둬서 이 화면을 만들었는데, 정작 여기는 **종류가 적고 기간을
 * 못 바꿔서** 대신 쓰기 어려웠습니다.
 *
 * `defaults` 는 비워 두면 klinecharts 기본값을 씁니다. 원래 있던 여섯 개는
 * 예전에 보던 그대로 보이도록 기본값을 바꾸지 않았습니다 — 설정 칸에서
 * 얼마든지 바꿀 수 있습니다.
 */

export type ParamSpec = {
  /** 칸 이름 — 짧게 */
  label: string;
  min: number;
  max: number;
  /** 소수 허용(볼린저 표준편차 배수 같은 것) */
  decimal?: boolean;
};

export type IndicatorSpec = {
  key: string;
  label: string;
  /** 캔들 위에 겹치는가(이동평균류), 아래 판에 따로 서는가 */
  onCandle: boolean;
  /** 지금 기본값 — klinecharts 기본값과 같게 둡니다 */
  defaults: number[];
  /**
   * 설정 칸.
   * - `list` 면 "5, 20, 60, 120" 처럼 개수를 마음대로 — 이동평균 여러 줄
   * - 아니면 정해진 칸 수
   */
  params: ParamSpec[];
  list?: { min: number; max: number; maxCount: number };
  /** 분·시간봉에서만 뜻이 있는 것 (VWAP) */
  intradayOnly?: boolean;
  /** 짧은 설명 — 버튼에 마우스를 올리면 보입니다 */
  hint: string;
};

const P = (label: string, min: number, max: number, decimal = false): ParamSpec => ({
  label,
  min,
  max,
  decimal,
});

export const INDICATOR_SPECS: IndicatorSpec[] = [
  /* ── 캔들 위 ── */
  {
    key: "MA",
    label: "이동평균",
    onCandle: true,
    defaults: [5, 10, 30, 60],
    params: [],
    list: { min: 1, max: 500, maxCount: 6 },
    hint: "단순 이동평균. 기간을 쉼표로 여러 개 넣을 수 있습니다",
  },
  {
    key: "EMA",
    label: "지수이평",
    onCandle: true,
    defaults: [6, 12, 20],
    params: [],
    list: { min: 1, max: 500, maxCount: 6 },
    hint: "최근 값에 무게를 더 주는 이동평균",
  },
  {
    key: "BOLL",
    label: "볼린저",
    onCandle: true,
    defaults: [20, 2],
    params: [P("기간", 2, 300), P("배수", 0.5, 5, true)],
    hint: "이동평균 ± 표준편차 배수",
  },
  {
    key: "SAR",
    label: "파라볼릭",
    onCandle: true,
    defaults: [2, 2, 20],
    params: [P("시작%", 1, 20), P("증가%", 1, 20), P("최대%", 5, 50)],
    hint: "추세가 이어지는 동안 따라붙는 점. 가속 계수는 % 로 적습니다",
  },
  {
    key: "VWAP",
    label: "VWAP",
    onCandle: true,
    defaults: [],
    params: [],
    intradayOnly: true,
    hint: "거래량 가중 평균가. 하루마다 새로 셉니다 — 분·시간봉 전용",
  },
  {
    key: "ICHIMOKU",
    label: "일목균형",
    onCandle: true,
    defaults: [9, 26, 52],
    params: [P("전환", 1, 100), P("기준", 1, 200), P("선행B", 1, 300)],
    hint: "전환·기준·선행스팬(구름)·후행스팬. 앞날 26봉치 구름은 그릴 자리가 없어 비어 있습니다",
  },

  /* ── 아래 판 ── */
  {
    key: "VOL",
    label: "거래량",
    onCandle: false,
    defaults: [5, 10, 20],
    params: [],
    list: { min: 1, max: 300, maxCount: 4 },
    hint: "거래량 막대와 그 이동평균",
  },
  {
    key: "MACD",
    label: "MACD",
    onCandle: false,
    defaults: [12, 26, 9],
    params: [P("짧은", 1, 100), P("긴", 2, 200), P("시그널", 1, 100)],
    hint: "두 지수이평의 간격과 그 평균",
  },
  {
    key: "RSI",
    label: "RSI",
    onCandle: false,
    defaults: [6, 12, 24],
    params: [],
    list: { min: 2, max: 200, maxCount: 3 },
    hint: "상대강도. 트레이딩뷰 기본은 14 하나입니다",
  },
  {
    key: "KDJ",
    label: "스토캐스틱",
    onCandle: false,
    defaults: [9, 3, 3],
    params: [P("기간", 2, 100), P("K", 1, 50), P("D", 1, 50)],
    hint: "기간 안에서 지금 값이 어디쯤인가 (K·D·J)",
  },
  {
    key: "ATR",
    label: "ATR",
    onCandle: false,
    defaults: [14],
    params: [P("기간", 1, 200)],
    hint: "한 봉에 평균 얼마나 움직이는가. 손절 폭 잡을 때",
  },
  {
    key: "DMI",
    label: "DMI·ADX",
    onCandle: false,
    defaults: [14, 6],
    params: [P("기간", 2, 100), P("ADX", 1, 100)],
    hint: "추세의 방향(+DI·−DI)과 세기(ADX)",
  },
  {
    key: "CCI",
    label: "CCI",
    onCandle: false,
    defaults: [20],
    params: [P("기간", 2, 200)],
    hint: "평균에서 얼마나 벗어났나",
  },
  {
    key: "WR",
    label: "윌리엄스%R",
    onCandle: false,
    defaults: [6, 10, 14],
    params: [],
    list: { min: 2, max: 200, maxCount: 3 },
    hint: "기간 안 최고가 대비 지금 위치",
  },
  {
    key: "OBV",
    label: "OBV",
    onCandle: false,
    defaults: [30],
    params: [P("평균", 1, 200)],
    hint: "오른 날 거래량은 더하고 내린 날은 빼서 쌓은 것",
  },
  {
    key: "ROC",
    label: "ROC",
    onCandle: false,
    defaults: [12, 6],
    params: [P("기간", 1, 200), P("평균", 1, 100)],
    hint: "N봉 전 대비 변화율",
  },
  {
    key: "TRIX",
    label: "TRIX",
    onCandle: false,
    defaults: [12, 9],
    params: [P("기간", 1, 200), P("평균", 1, 100)],
    hint: "세 번 평탄화한 지수이평의 변화율",
  },
  {
    key: "AO",
    label: "AO",
    onCandle: false,
    defaults: [5, 34],
    params: [P("짧은", 1, 100), P("긴", 2, 200)],
    hint: "어썸 오실레이터 — 중간값의 짧은·긴 이평 차",
  },
];

export const SPEC_BY_KEY = new Map(INDICATOR_SPECS.map((s) => [s.key, s]));

/** 지금 쓸 값 — 저장된 것이 있으면 그것, 없으면 기본값 */
export function paramsOf(key: string, saved: Record<string, number[]>): number[] {
  const spec = SPEC_BY_KEY.get(key);
  const s = saved[key];
  if (spec && s && isValidParams(spec, s)) return s;
  return spec?.defaults ?? [];
}

/** 저장해 둔 설정이 이 지표에 맞는 모양인가 — 어긋나면 차트가 깨집니다 */
export function isValidParams(spec: IndicatorSpec, v: unknown): v is number[] {
  if (!Array.isArray(v) || !v.every((x) => typeof x === "number" && Number.isFinite(x))) return false;
  if (spec.list) {
    return (
      v.length >= 1 &&
      v.length <= spec.list.maxCount &&
      v.every((x) => x >= spec.list!.min && x <= spec.list!.max && Number.isInteger(x))
    );
  }
  if (v.length !== spec.params.length) return false;
  return v.every((x, i) => {
    const p = spec.params[i];
    return x >= p.min && x <= p.max && (p.decimal || Number.isInteger(x));
  });
}

/**
 * "5, 20, 60" 같은 글을 숫자 목록으로. 틀린 것이 있으면 이유를 돌려줍니다.
 */
export function parseList(spec: IndicatorSpec, text: string): number[] | string {
  const l = spec.list;
  if (!l) return "목록형이 아닙니다";
  const parts = text
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "하나 이상 넣으세요";
  if (parts.length > l.maxCount) return `최대 ${l.maxCount}개까지`;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n))) return "정수만 넣을 수 있습니다";
  if (nums.some((n) => n < l.min || n > l.max)) return `${l.min}~${l.max} 사이로`;
  return nums;
}
