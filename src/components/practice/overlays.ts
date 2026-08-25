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

/** 구간마다 깔 옅은 색. 위로 갈수록 진해집니다 */
const BAND = [
  "rgba(200,161,90,0.05)",
  "rgba(200,161,90,0.07)",
  "rgba(200,161,90,0.09)",
  "rgba(200,161,90,0.09)",
  "rgba(200,161,90,0.07)",
  "rgba(200,161,90,0.05)",
];

export const fibRetracement: OverlayTemplate = {
  name: "fibRetracement",
  totalStep: 3, // 점 두 개를 찍으면 완성
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, overlay, bounding }) => {
    if (coordinates.length < 2) return [];

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
        styles: { style: "fill", color: BAND[i] },
        ignoreEvent: true,
      });
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
          color: isEdge ? INK : GOLD,
          size: isEdge ? 1.4 : 1,
          style: isEdge ? "solid" : "dashed",
        },
      });
      /*
       * 라벨은 구간 **안쪽 왼쪽 위**에 붙입니다. 오른쪽 끝에 두면 가격축과
       * 겹치고, 비율이 촘촘한 구간(38.2·50·61.8)에서 서로 포개집니다.
       * 선 바로 위에 얹으면 어느 선의 값인지도 분명해집니다.
       */
      figures.push({
        type: "text",
        attrs: {
          x: left + 4,
          y: y - 2,
          text: `${(r * 100).toFixed(1)}%  ${priceOf(r).toFixed(2)}`,
          align: "left",
          baseline: "bottom",
        },
        styles: { ...BARE_TEXT, color: isEdge ? INK : MUTED, size: 10 },
        ignoreEvent: true,
      });
    }

    // 두 점을 잇는 기준선
    figures.push({
      type: "line",
      attrs: { coordinates: [a, b] },
      styles: { color: GOLD, size: 1, style: "dashed" },
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
  color: string,
  style: "solid" | "dashed",
): OverlayTemplate {
  return {
    name,
    totalStep: labels.length + 1, // 라벨 수만큼 점을 찍으면 완성
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length < 1) return [];
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
          styles: { color, size: 1.6, style },
        });
      }

      coordinates.forEach((c, i) => {
        const label = labels[i];
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
          styles: { ...BARE_TEXT, color, size: 13, weight: "bold" },
          ignoreEvent: true,
        });
      });

      return figures;
    },
  };
}

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
];
