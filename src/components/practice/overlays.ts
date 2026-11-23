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

/* ── 도우미 ─────────────────────────────────────────────────────── */

type Fig = { type: string; attrs: unknown; styles?: unknown; ignoreEvent?: boolean };

/** `#rrggbb` → 옅게 칠할 rgba */
function tint(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(200,161,90,${alpha})`;
  const n = Number.parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** 글자에 어두운 받침을 깝니다 — 캔들 위에 얹혀도 읽히게 */
const LABEL_BOX = {
  backgroundColor: "rgba(13,17,23,0.82)",
  borderSize: 0,
  borderColor: "transparent",
  borderRadius: 3,
  paddingLeft: 5,
  paddingRight: 5,
  paddingTop: 3,
  paddingBottom: 3,
} as const;

const signed = (v: number, digits = 2) => `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;

/* ── 사각형 ──────────────────────────────────────────────────────
 *
 * 매물대·횡보 구간을 표시할 때 씁니다. 두 모서리를 찍으면 됩니다.
 * 안쪽은 펜 색을 아주 옅게 칠해 캔들이 비쳐 보이게 둡니다.
 */
export const box: OverlayTemplate = {
  name: "box",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, overlay }) => {
    if (coordinates.length < 2) return [];
    const pen = penOf(overlay, GOLD);
    const [a, b] = coordinates;
    return [
      {
        type: "rect",
        attrs: {
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          width: Math.abs(b.x - a.x),
          height: Math.abs(b.y - a.y),
        },
        styles: {
          style: "stroke_fill",
          color: tint(pen.color, 0.12),
          borderColor: pen.color,
          borderSize: Math.max(1, pen.size * 0.8),
        },
      },
    ];
  },
};

/* ── 측정 ────────────────────────────────────────────────────────
 *
 * 두 점 사이가 **몇 % · 몇 봉 · 며칠** 인지. 트레이딩뷰에서 Shift 를 누르고
 * 끌면 나오는 그것입니다. 오르는 쪽이면 빨강, 내리는 쪽이면 파랑으로 칠합니다
 * (이 사이트의 상승·하락 색).
 */
export const measure: OverlayTemplate = {
  name: "measure",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, overlay }) => {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates;
    const [p0, p1] = overlay.points;
    if (typeof p0?.value !== "number" || typeof p1?.value !== "number") return [];
    const diff = p1.value - p0.value;
    const pct = p0.value !== 0 ? (diff / p0.value) * 100 : 0;
    const up = diff >= 0;
    const color = up ? "#ff5445" : "#4a90ff";
    const bars =
      typeof p0.dataIndex === "number" && typeof p1.dataIndex === "number"
        ? Math.abs(p1.dataIndex - p0.dataIndex)
        : null;
    const days =
      typeof p0.timestamp === "number" && typeof p1.timestamp === "number"
        ? Math.round(Math.abs(p1.timestamp - p0.timestamp) / 86_400_000)
        : null;
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    const midX = left + w / 2;
    const parts = [`${signed(diff)} (${signed(pct)}%)`];
    if (bars !== null) parts.push(`${bars}봉`);
    if (days !== null && days > 0) parts.push(`${days}일`);
    return [
      {
        type: "rect",
        attrs: { x: left, y: top, width: w, height: h },
        styles: { style: "fill", color: tint(color, 0.14) },
        ignoreEvent: true,
      },
      // 가운데를 가로지르는 화살 대신 세로·가로 기준선
      {
        type: "line",
        attrs: { coordinates: [{ x: midX, y: a.y }, { x: midX, y: b.y }] },
        styles: { color, size: 1, style: "solid" },
      },
      {
        type: "line",
        attrs: { coordinates: [{ x: a.x, y: top + h / 2 }, { x: b.x, y: top + h / 2 }] },
        styles: { color, size: 1, style: "dashed" },
      },
      {
        type: "text",
        attrs: {
          x: midX,
          y: up ? top - 6 : top + h + 6,
          text: parts.join(" · "),
          align: "center",
          baseline: up ? "bottom" : "top",
        },
        styles: { ...LABEL_BOX, color, size: 11, weight: "bold" },
        ignoreEvent: true,
      },
    ];
  },
};

/* ── 포지션 (손익비) ─────────────────────────────────────────────
 *
 * 진입 → 손절 → 목표 순서로 세 점을 찍으면 위아래로 구간이 칠해지고
 * **손익비** 와 각 구간의 % 가 붙습니다. 목표가 진입보다 위면 매수(롱),
 * 아래면 매도(숏)로 봅니다.
 *
 * 매매노트의 R 배수와 같은 셈입니다. 사고팔 자리를 이 사이트가 정해 주는
 * 것이 아니라, **내가 정한 자리의 비율을 재 보는 계산기**입니다.
 *
 * 색은 상승·하락 색(빨강·파랑)과 겹치지 않게 골랐습니다 — 손절 구간을
 * 빨강으로 칠하면 이 사이트에서는 "오른다" 로 읽힙니다.
 */
const TARGET = "#5bc8d6";
const STOP = "#d97fb8";

export const position: OverlayTemplate = {
  name: "position",
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, overlay }) => {
    if (coordinates.length < 2) return [];
    const pts = overlay.points;
    const entry = pts[0]?.value;
    const stop = pts[1]?.value;
    if (typeof entry !== "number" || typeof stop !== "number") return [];
    const target = typeof pts[2]?.value === "number" ? (pts[2].value as number) : null;

    const x0 = coordinates[0].x;
    const xs = coordinates.map((c) => c.x);
    let right = Math.max(...xs);
    if (right - x0 < 40) right = x0 + 140; // 한 자리에 찍으면 폭을 줍니다
    const left = Math.min(...xs);
    const yE = coordinates[0].y;
    const yS = coordinates[1].y;
    const yT = coordinates[2]?.y;

    const figs: Fig[] = [];
    const band = (y1: number, y2: number, color: string) =>
      figs.push({
        type: "rect",
        attrs: { x: left, y: Math.min(y1, y2), width: right - left, height: Math.abs(y2 - y1) },
        styles: { style: "fill", color: tint(color, 0.16) },
        ignoreEvent: true,
      });
    const line = (y: number, color: string, dashed = false) =>
      figs.push({
        type: "line",
        attrs: { coordinates: [{ x: left, y }, { x: right, y }] },
        styles: { color, size: 1.2, style: dashed ? "dashed" : "solid" },
      });
    const label = (y: number, text: string, color: string, above: boolean) =>
      figs.push({
        type: "text",
        attrs: { x: right - 4, y: above ? y - 4 : y + 4, text, align: "right", baseline: above ? "bottom" : "top" },
        styles: { ...LABEL_BOX, color, size: 11 },
        ignoreEvent: true,
      });

    const risk = Math.abs(entry - stop);
    const stopPct = ((stop - entry) / entry) * 100;
    band(yE, yS, STOP);
    line(yS, STOP);
    label(yS, `손절 ${stop.toFixed(2)} (${signed(stopPct)}%)`, STOP, yS < yE);

    if (target !== null && yT !== undefined) {
      const long = target >= entry;
      const reward = Math.abs(target - entry);
      const tPct = ((target - entry) / entry) * 100;
      band(yE, yT, TARGET);
      line(yT, TARGET);
      label(yT, `목표 ${target.toFixed(2)} (${signed(tPct)}%)`, TARGET, yT < yE);
      const rr = risk > 0 ? reward / risk : 0;
      // 손절이 목표와 같은 쪽에 있으면 계산이 뜻이 없습니다
      const sane = long ? stop < entry : stop > entry;
      label(
        yE,
        sane
          ? `${long ? "매수" : "매도"} ${entry.toFixed(2)} · 손익비 1 : ${rr.toFixed(2)}`
          : `진입 ${entry.toFixed(2)} · 손절이 목표와 같은 쪽입니다`,
        INK,
        yT > yE,
      );
    } else {
      label(yE, `진입 ${entry.toFixed(2)} — 목표를 찍으세요`, INK, yS > yE);
    }
    line(yE, MUTED);
    return figs;
  },
};

/* ── 화살표 ─────────────────────────────────────────────────────── */
export const arrow: OverlayTemplate = {
  name: "arrow",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }) => {
    if (coordinates.length < 2) return [];
    const pen = penOf(overlay, GOLD);
    const [a, b] = coordinates;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const len = 9 + pen.size * 2;
    const wing = (d: number) => ({
      x: b.x - len * Math.cos(ang + d),
      y: b.y - len * Math.sin(ang + d),
    });
    return [
      { type: "line", attrs: { coordinates: [a, b] }, styles: { color: pen.color, size: pen.size } },
      {
        type: "polygon",
        attrs: { coordinates: [b, wing(0.45), wing(-0.45)] },
        styles: { style: "fill", color: pen.color },
      },
    ];
  },
};

/* ── 메모 ───────────────────────────────────────────────────────
 *
 * 포토샵 글자 도구처럼 **누른 자리에 바로 적습니다.** 점 하나를 찍으면
 * 차트 위에 입력 칸이 뜨고(kline.tsx), 적은 글자가 `extendData.text` 로
 * 들어옵니다. 찍은 점이 글자의 왼쪽 가운데입니다 — 입력 칸도 같은 자리에
 * 뜨므로 치던 글자가 그대로 차트에 내려앉는 것처럼 보입니다.
 *
 * 예전 메모(`simpleAnnotation`, 라이브러리 기본)는 글자를 넣을 길이 없어
 * 빈 화살표만 찍혔습니다. 저장된 것은 그대로 그려지게 둡니다.
 */
export const NOTE_FONT = (size: number) => Math.round(12 + size * 2);

export const textNote: OverlayTemplate = {
  name: "textNote",
  totalStep: 2,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }) => {
    if (coordinates.length < 1) return [];
    const text = (overlay.extendData as { text?: string } | undefined)?.text ?? "";
    // 적는 중(칸이 떠 있는 동안)에는 칸이 글자를 보여 줍니다
    if (!text) return [];
    const pen = penOf(overlay, GOLD);
    const [p] = coordinates;
    return [
      {
        type: "text",
        attrs: { x: p.x, y: p.y, text, align: "left", baseline: "middle" },
        styles: { ...LABEL_BOX, color: pen.color, size: NOTE_FONT(pen.size), weight: 500 },
      },
    ];
  },
};

/* ── 원 ─────────────────────────────────────────────────────────
 *
 * 가운데를 찍고 → 테두리 한 곳을 찍습니다. 매수·매도 자리를 동그라미로
 * 표시하는 용도라 **화면에서 늘 동그랗게** 그립니다(반지름 = 두 점 사이의
 * 화면 거리). 가격·시간으로 반지름을 재면 확대할 때 찌그러집니다.
 */
export const circle: OverlayTemplate = {
  name: "circle",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }) => {
    if (coordinates.length < 2) return [];
    const pen = penOf(overlay, GOLD);
    const [c, e] = coordinates;
    const r = Math.hypot(e.x - c.x, e.y - c.y);
    return [
      {
        type: "circle",
        attrs: { x: c.x, y: c.y, r },
        styles: {
          style: "stroke_fill",
          color: tint(pen.color, 0.1),
          borderColor: pen.color,
          borderSize: Math.max(1, pen.size),
        },
      },
    ];
  },
};

/** 두 모서리 안에 꼭 맞는 타원 — 라이브러리에 타원 모양이 없어 다각형으로 */
function ellipsePoints(a: { x: number; y: number }, b: { x: number; y: number }) {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  const n = 72;
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  });
}

/* ── 타원 ─────────────────────────────────────────────────────── */
export const ellipse: OverlayTemplate = {
  name: "ellipse",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }) => {
    if (coordinates.length < 2) return [];
    const pen = penOf(overlay, GOLD);
    return [
      {
        type: "polygon",
        attrs: { coordinates: ellipsePoints(coordinates[0], coordinates[1]) },
        styles: {
          style: "stroke_fill",
          color: tint(pen.color, 0.1),
          borderColor: pen.color,
          borderSize: Math.max(1, pen.size),
        },
      },
    ];
  },
};

/* ── 삼각형 ───────────────────────────────────────────────────── */
export const triangle: OverlayTemplate = {
  name: "triangle",
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }) => {
    if (coordinates.length < 2) return [];
    const pen = penOf(overlay, GOLD);
    // 두 점까지는 선으로 — 세 번째 점을 찍을 때까지 모양을 미리 봅니다
    if (coordinates.length === 2) {
      return [{ type: "line", attrs: { coordinates }, styles: { color: pen.color, size: pen.size } }];
    }
    return [
      {
        type: "polygon",
        attrs: { coordinates },
        styles: {
          style: "stroke_fill",
          color: tint(pen.color, 0.1),
          borderColor: pen.color,
          borderSize: Math.max(1, pen.size),
        },
      },
    ];
  },
};

export const CUSTOM_OVERLAYS: OverlayTemplate[] = [
  textNote,
  circle,
  ellipse,
  triangle,
  fibRetracement,
  elliottImpulse,
  elliottCorrection,
  elliottTriangle,
  freeCurve,
  box,
  measure,
  position,
  arrow,
];
