/**
 * 그리기 도구 표식.
 *
 * 글자만 늘어놓으면 **눈에 안 띕니다.** "추세선 / 연장선 / 반직선" 은 읽어야
 * 구분되는데, 그림이면 모양 자체가 무엇을 긋는지 말해 줍니다. 트레이딩뷰를
 * 비롯한 차트 도구들이 전부 그림을 쓰는 이유입니다.
 *
 * 모두 20×20 격자에 맞춰 그렸습니다. 선 굵기는 1.6 으로 통일해서 나란히
 * 놓았을 때 어느 하나가 튀지 않게 했습니다. 점은 **집는 자리**(끌어서 옮기는
 * 점)를 나타냅니다 — 그래서 도구마다 점 개수가 실제로 찍어야 하는 점 수와
 * 같습니다. 두 점을 찍는 추세선은 점이 둘, 세 점을 찍는 채널은 셋입니다.
 */

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" {...S}>
      {children}
    </svg>
  );
}

/** 집는 자리 */
const Dot = ({ x, y }: { x: number; y: number }) => (
  <circle cx={x} cy={y} r="1.7" fill="currentColor" stroke="none" />
);

export const TOOL_ICONS: Record<string, () => React.ReactElement> = {
  /* ── 파동 ───────────────────────────────────────────────────── */

  // 1→5 로 올라가는 다섯 마디. 위로 셋, 되돌림 둘
  elliottImpulse: () => (
    <Svg>
      <path d="M2 17 L5.5 10 L8 13 L12 5 L14.5 8.5 L18 3" />
      <Dot x={2} y={17} />
      <Dot x={12} y={5} />
      <Dot x={18} y={3} />
    </Svg>
  ),

  // A-B-C 세 마디. 되돌림이라 내려갑니다
  elliottCorrection: () => (
    <Svg>
      <path d="M2.5 4 L7.5 13 L12 8 L17.5 16.5" />
      <Dot x={2.5} y={4} />
      <Dot x={12} y={8} />
      <Dot x={17.5} y={16.5} />
    </Svg>
  ),

  // 폭이 좁아지는 삼각형 — 위아래 경계선을 함께 그려 수렴이 보이게
  elliottTriangle: () => (
    <Svg>
      <path d="M2 3.5 L17.5 9.5" opacity=".45" />
      <path d="M2 16.5 L17.5 10.5" opacity=".45" />
      <path d="M2.5 4.5 L6 15 L9.5 6.5 L12.5 13.5 L15.5 8.8" />
      <Dot x={2.5} y={4.5} />
      <Dot x={15.5} y={8.8} />
    </Svg>
  ),

  // 고점·저점 두 점 사이에 되돌림 눈금이 깔립니다
  fibRetracement: () => (
    <Svg>
      <path d="M3 4 H17" />
      <path d="M3 8 H17" opacity=".5" />
      <path d="M3 12 H17" opacity=".5" />
      <path d="M3 16 H17" />
      <Dot x={3} y={4} />
      <Dot x={17} y={16} />
    </Svg>
  ),

  /* ── 선 ─────────────────────────────────────────────────────── */

  // 찍은 두 점 사이만
  segment: () => (
    <Svg>
      <path d="M4 15.5 L16 4.5" />
      <Dot x={4} y={15.5} />
      <Dot x={16} y={4.5} />
    </Svg>
  ),

  // 양쪽으로 끝없이 — 가장자리를 흐리게 빼서 "계속 간다" 를 나타냅니다
  straightLine: () => (
    <Svg>
      <path d="M1 18.5 L5.5 14.5" opacity=".4" />
      <path d="M5.5 14.5 L14.5 5.5" />
      <path d="M14.5 5.5 L19 1.5" opacity=".4" />
      <Dot x={5.5} y={14.5} />
      <Dot x={14.5} y={5.5} />
    </Svg>
  ),

  // 한쪽으로만
  rayLine: () => (
    <Svg>
      <path d="M4 15.5 L14 6.5" />
      <path d="M14 6.5 L19 2" opacity=".4" />
      <Dot x={4} y={15.5} />
      <Dot x={14} y={6.5} />
    </Svg>
  ),

  // 지지·저항 자리
  horizontalStraightLine: () => (
    <Svg>
      <path d="M1.5 10 H18.5" />
      <Dot x={6.5} y={10} />
    </Svg>
  ),

  // 평행한 두 선 사이를 채워 "통로" 로 보이게. 점 셋 = 찍는 점 셋
  priceChannelLine: () => (
    <Svg>
      <path d="M2 13.5 L18 4.5 L18 8.5 L2 17.5 Z" opacity=".16" fill="currentColor" stroke="none" />
      <path d="M2 13.5 L18 4.5" />
      <path d="M2 17.5 L18 8.5" />
      <Dot x={2} y={13.5} />
      <Dot x={18} y={4.5} />
      <Dot x={2} y={17.5} />
    </Svg>
  ),

  // 평행선 — 채널과 달리 사이를 안 채웁니다
  parallelStraightLine: () => (
    <Svg>
      <path d="M2 12 L18 3.5" />
      <path d="M2 16.5 L18 8" />
      <Dot x={2} y={12} />
      <Dot x={18} y={3.5} />
      <Dot x={2} y={16.5} />
    </Svg>
  ),

  // 손으로 그은 자국
  freeCurve: () => (
    <Svg>
      <path d="M2 14 C5 5, 8 18, 11 9 S16 3, 18 7" />
    </Svg>
  ),

  // 글자를 적는 자리
  simpleAnnotation: () => (
    <Svg>
      <path d="M3 4.5 H17" />
      <path d="M10 4.5 V15.5" />
      <path d="M7 15.5 H13" />
    </Svg>
  ),
};

/**
 * 보조지표 표식.
 *
 * 이름이 짧고(이동평균·볼린저) 업계에서 굳은 말이라 글자를 지우지는 않습니다.
 * 대신 그림을 나란히 붙여 목록에서 눈이 걸리게 합니다.
 */
export const INDICATOR_ICONS: Record<string, () => React.ReactElement> = {
  // 값을 부드럽게 편 선
  MA: () => (
    <Svg>
      <path d="M2 14 C6 14, 6 6, 10 6 S14 12, 18 5" />
    </Svg>
  ),
  // 가운데 선과 위아래 띠
  BOLL: () => (
    <Svg>
      <path d="M2 5 C6 5, 6 2.5, 10 2.5 S14 6, 18 3" opacity=".55" />
      <path d="M2 10.5 C6 10.5, 6 7.5, 10 7.5 S14 12, 18 8.5" />
      <path d="M2 16 C6 16, 6 12.5, 10 12.5 S14 17.5, 18 14" opacity=".55" />
    </Svg>
  ),
  // 막대
  VOL: () => (
    <Svg>
      <path d="M3.5 17 V11" />
      <path d="M7.5 17 V6.5" />
      <path d="M11.5 17 V13" />
      <path d="M15.5 17 V8.5" />
    </Svg>
  ),
  // 0선 위아래로 뻗는 막대
  MACD: () => (
    <Svg>
      <path d="M2 10 H18" opacity=".4" />
      <path d="M4.5 10 V5.5" />
      <path d="M8 10 V7.5" />
      <path d="M11.5 10 V13" />
      <path d="M15 10 V15" />
    </Svg>
  ),
  // 위아래 한계선 사이를 오가는 선
  RSI: () => (
    <Svg>
      <path d="M2 5.5 H18" opacity=".4" />
      <path d="M2 14.5 H18" opacity=".4" />
      <path d="M2 12 C5 4, 8 16, 11 7 S16 13, 18 9" />
    </Svg>
  ),
  // 엇갈리는 두 선
  KDJ: () => (
    <Svg>
      <path d="M2 5 C6 5, 8 15, 12 15 S16 7, 18 7" />
      <path d="M2 14 C6 14, 8 5, 12 5 S16 13, 18 13" opacity=".55" />
    </Svg>
  ),
};
