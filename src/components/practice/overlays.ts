/**
 * 직접 만든 그리기 도구들.
 *
 * klinecharts 기본 도구는 쓸 수는 있지만 생김새가 트레이딩뷰와 딴판입니다.
 * 특히 기본 피보나치는
 *   - 선이 화면 **끝에서 끝까지** 뻗고
 *   - 비율 라벨이 **왼쪽 가장자리**에 파란 뱃지로 붙고
 *   - 구간 사이에 색이 없어 어디가 어느 구간인지 눈에 안 들어옵니다
 * 그래서 실제 분석 화면처럼 **찍은 두 점 사이에만** 선을 긋고, 라벨을
 * 오른쪽 끝에 붙이고, 구간마다 옅은 색을 깔도록 새로 만들었습니다.
 *
 * 엘리어트 파동도 마찬가지로, 점을 순서대로 찍으면 선이 이어지고 번호가
 * 자동으로 붙는 도구를 만들었습니다. 기본 도구로는 선과 라벨을 따로 그려야
 * 해서 실제로 쓰기 번거롭습니다.
 */

import type { OverlayTemplate } from "klinecharts";

const GOLD = "#c8a15a";
const INK = "#e9e5dd";
const MUTED = "#9aa2ae";

/**
 * 그릴 때 고른 색과 굵기를 도형에 그대로 씁니다.
 *
 * klinecharts 는 도형마다 `styles` 를 주면 그게 최우선입니다. 우리 도구들은
 * 색을 코드에 박아 뒀었는데, 그러면 화면에서 색을 골라도 먹히지 않습니다.
 * 그래서 도구를 만들 때 넘긴 `styles.line` 을 먼저 보고, 없으면 기본값을
 * 씁니다.
 */
type OverlayLike = { styles?: { line?: { color?: string; size?: number } } };

function penOf(overlay: unknown, fallback: string) {
  const line = (overlay as OverlayLike | undefined)?.styles?.line;
  return { color: line?.color ?? fallback, size: line?.size ?? 1.6 };
}

/**
 * klinecharts 의 글자 도형은 기본으로 **배경 상자**가 붙습니다. 그대로 두면
 * 비율 라벨마다 파란 알약이 생겨 서로 겹치고 가격축까지 침범합니다.
 * 배경과 여백을 전부 없애 트레이딩뷰처럼 글자만 남깁니다.
 */
const BARE_TEXT = {
  backgroundColor: "transparent",
  borderSize: 0,
  borderColor: "transparent",
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
  paddingBottom: 0,
} as const;

/* ── 피보나치 되돌림 ─────────────────────────────────────────────── */

const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/**
 * 눈금마다 **다른 색**을 씁니다.
 *
 * 처음에는 한 가지 색을 진하기만 달리해 깔았는데, 눈금 여섯이 다 비슷해 보여
 * "지금 이게 38.2 인지 61.8 인지" 를 색으로 못 알아봤습니다. 트레이딩뷰가
 * 눈금마다 색을 나눠 쓰는 이유가 그것입니다.
 *
 * 색은 이 사이트가 이미 쓰는 팔레트에서 골랐고, 캔들의 빨강·파랑과는
 * 겹치지 않게 했습니다 — 상승·하락으로 잘못 읽히면 안 되니까요.
 * 가장 많이 보는 61.8 을 가장 눈에 띄는 하늘색으로 뒀습니다.
 */
const LEVEL_COLOR: Record<string, string> = {
  "0": "#b3ada2", // 기준선 — 돌빛
  "0.236": "#d97fb8", // 자주
  "0.382": "#f0a23c", // 주황
  "0.5": "#7fa86b", // 풀색
  "0.618": "#5bc8d6", // 하늘 — 가장 많이 보는 자리
  "0.786": "#9b8ec4", // 연보라
  "1": "#b3ada2", // 기준선 — 돌빛
};

const colorOf = (r: number) => LEVEL_COLOR[String(r)] ?? GOLD;

/** 구간을 채울 색 — 그 구간 위쪽 눈금의 색을 아주 옅게 */
function bandOf(i: number): string {
  const hex = colorOf(FIB[i + 1] ?? FIB[i]);
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.07)`;
}

export const fibRetracement: OverlayTemplate = {
  name: "fibRetracement",
  totalStep: 3, // 점 두 개를 찍으면 완성
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false, // 일봉이라 "22:30" 같은 시각 표기는 군더더기입니다
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, overlay, bounding }) => {
    if (coordinates.length < 2) return [];
    const pen = penOf(overlay, GOLD);

    const [a, b] = coordinates;
    const pa = overlay.points[0]?.value;
    const pb = overlay.points[1]?.value;
    if (typeof pa !== "number" || typeof pb !== "number") return [];

    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    // 오른쪽으로 조금 더 뻗어 앞날 구간에서도 자리를 볼 수 있게 합니다
    const tail = Math.min(bounding.width, right + 90);

    const yOf = (r: number) => a.y + (b.y - a.y) * r;
    const priceOf = (r: number) => pa + (pb - pa) * r;

    const figures: {
      type: string;
      attrs: unknown;
      styles?: unknown;
      ignoreEvent?: boolean;
    }[] = [];

    // 구간 색부터 깔고 그 위에 선을 얹습니다
    for (let i = 0; i < FIB.length - 1; i++) {
      const y1 = yOf(FIB[i]);
      const y2 = yOf(FIB[i + 1]);
      figures.push({
        type: "polygon",
        attrs: {
          coordinates: [
            { x: left, y: y1 },
            { x: tail, y: y1 },
            { x: tail, y: y2 },
            { x: left, y: y2 },
          ],
        },
        styles: { style: "fill", color: bandOf(i) },
        ignoreEvent: true,
      });
    }

    /*
     * 좁은 구간을 잡으면 눈금 일곱 개가 한 뼘에 몰려 라벨이 서로 포개집니다.
     * 그래서 **선은 전부 긋되 라벨만 솎아냅니다.** 양 끝(0·100%)은 구간이
     * 어디서 어디까지인지 알려 주므로 항상 남기고, 중간은 실제로 많이 보는
     * 61.8 → 38.2 → 50 → 23.6 → 78.6 순으로 자리가 남을 때만 붙입니다.
     */
    const MIN_LABEL_GAP = 13;
    const labelled = new Set<number>([0, 1]);
    const takenY = [yOf(0), yOf(1)];
    for (const r of [0.618, 0.382, 0.5, 0.236, 0.786]) {
      const y = yOf(r);
      if (takenY.every((t) => Math.abs(y - t) >= MIN_LABEL_GAP)) {
        labelled.add(r);
        takenY.push(y);
      }
    }

    for (const r of FIB) {
      const y = yOf(r);
      const isEdge = r === 0 || r === 1;
      figures.push({
        type: "line",
        attrs: {
          coordinates: [
            { x: left, y },
            { x: tail, y },
          ],
        },
        styles: {
          // 눈금마다 제 색. 양 끝만 실선으로 두어 구간의 시작·끝이 분명하게
          color: colorOf(r),
          size: isEdge ? Math.max(1.3, pen.size * 0.9) : Math.max(0.9, pen.size * 0.7),
          style: isEdge ? "solid" : "dashed",
        },
      });
      /*
       * 라벨은 구간 **안쪽 왼쪽 위**에 붙입니다. 오른쪽 끝에 두면 가격축과
       * 겹치고, 선 바로 위에 얹으면 어느 선의 값인지도 분명해집니다.
       */
      if (!labelled.has(r)) continue;
      figures.push({
        type: "text",
        attrs: {
          x: left + 4,
          y: y - 2,
          text: `${(r * 100).toFixed(1)}%  ${priceOf(r).toFixed(2)}`,
          align: "left",
          baseline: "bottom",
        },
        styles: { ...BARE_TEXT, color: colorOf(r), size: 10, weight: isEdge ? "bold" : "normal" },
        ignoreEvent: true,
      });
    }

    // 두 점을 잇는 기준선
    figures.push({
      type: "line",
      attrs: { coordinates: [a, b] },
      styles: { color: pen.color, size: 1, style: "dashed" },
    });

    return figures;
  },
};

/* ── 엘리어트 파동 ───────────────────────────────────────────────── */

/**
 * 점을 순서대로 찍으면 선이 이어지고 라벨이 붙는 도구를 만듭니다.
 * 트레이딩뷰의 임펄스·조정 파동 도구와 같은 방식입니다.
 */
function wave(
  name: string,
  labels: string[],
  fallback: string,
  style: "solid" | "dashed",
): OverlayTemplate {
  /*
   * **점은 라벨보다 하나 많습니다.**
   *
   * ABC 조정은 A·B·C 세 점이 아니라 *출발점* + A·B·C 네 점입니다. 세 점만
   * 찍으면 선분이 둘뿐이라 V 자가 되고, 조정파의 Z(번개) 모양이 안 나옵니다.
   * 처음에 세 점으로 만들었다가 "z자 그리기도 전에 끝난다"는 지적을 받고
   * 고쳤습니다. 12345 파동도 같은 이유로 0 에서 출발해 여섯 점입니다.
   *
   * 트레이딩뷰의 엘리어트 도구도 같은 방식입니다.
   */
  const pointLabels = ["", ...labels]; // 출발점은 라벨 없이
  const points = pointLabels.length;

  return {
    name,
    totalStep: points + 1, // 점 수만큼 찍으면 완성
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false, // 일봉인데 "22:30" 같은 시각이 붙어 지저분합니다
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates, overlay }) => {
      if (coordinates.length < 1) return [];
      const pen = penOf(overlay, fallback);
      const figures: {
        type: string;
        attrs: unknown;
        styles?: unknown;
        ignoreEvent?: boolean;
      }[] = [];

      if (coordinates.length >= 2) {
        figures.push({
          type: "line",
          attrs: { coordinates },
          styles: { color: pen.color, size: pen.size, style },
        });
      }

      coordinates.forEach((c, i) => {
        const label = pointLabels[i];
        if (!label) return;
        // 파동 방향에 따라 라벨을 봉 위나 아래에 둡니다 — 캔들을 가리지 않게
        const prev = coordinates[i - 1];
        const up = prev ? c.y < prev.y : true;
        figures.push({
          type: "text",
          attrs: {
            x: c.x,
            y: c.y + (up ? -12 : 12),
            text: label,
            align: "center",
            baseline: up ? "bottom" : "top",
          },
          styles: {
            ...BARE_TEXT,
            color: pen.color,
            size: 13,
            weight: "bold",
          },
          ignoreEvent: true,
        });
      });

      return figures;
    },
  };
}

/**
 * 자유 곡선 — 누른 채로 끌면 그려집니다.
 *
 * klinecharts 기본 `brush` 와 같은 방식(`drawingMode: "continuous"`)이지만
 * 두 가지가 다릅니다. 꺾인 자리를 부드럽게 잇고(`smooth`), 화면에서 고른
 * 색과 굵기를 따릅니다. 기본 brush 는 각져서 손으로 그은 느낌이 안 납니다.
 */
export const freeCurve: OverlayTemplate = {
  name: "freeCurve",
  totalStep: 2,
  drawingMode: "continuous",
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }) => {
    if (coordinates.length < 2) return [];
    const pen = penOf(overlay, GOLD);
    return [
      {
        type: "line",
        attrs: { coordinates },
        styles: {
          color: pen.color,
          size: pen.size,
          smooth: true,
          lineCap: "round",
          lineJoin: "round",
        },
      },
    ];
  },
};

export const elliottImpulse = wave(
  "elliottImpulse",
  ["1", "2", "3", "4", "5"],
  "#c8a15a",
  "solid",
);

export const elliottCorrection = wave(
  "elliottCorrection",
  ["A", "B", "C"],
  "#4a90ff",
  "dashed",
);

export const elliottTriangle = wave(
  "elliottTriangle",
  ["a", "b", "c", "d", "e"],
  "#7fa86b",
  "dashed",
);

export const CUSTOM_OVERLAYS: OverlayTemplate[] = [
  fibRetracement,
  elliottImpulse,
  elliottCorrection,
  elliottTriangle,
  freeCurve,
];
