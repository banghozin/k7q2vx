"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { Chart, KLineData, Period } from "klinecharts";

/**
 * KLineChart 을 감싼 조각.
 *
 * 이 라이브러리는 불러오는 순간 `window` 를 건드립니다. Next 는 화면을 서버에서
 * 미리 만들어 두는데 서버에는 `window` 가 없어서, 그냥 import 하면 빌드가
 * 깨집니다. 그래서 **브라우저에서 화면이 뜬 뒤에** 동적으로 불러옵니다.
 * (실제로 그 오류를 먼저 만나고 이렇게 고쳤습니다.)
 */

/** 그릴 때 쓰는 펜 — 화면에서 고른 색과 굵기 */
export type Pen = { color: string; size: number };

export type KlineHandle = {
  /** 봉 데이터를 통째로 갈아끼웁니다. 봉 단위도 함께 알려 줍니다 */
  setData: (bars: KLineData[], period: Period) => void;
  /** 그리기 도구를 켭니다. 지금 고른 펜으로 그립니다 */
  startDraw: (name: string, pen: Pen) => void;
  /** 아직 다 못 그린 도형을 물립니다 (도구를 끌 때) */
  cancelDraw: () => void;
  /** 이미 그린 것 하나의 색·굵기를 바꿉니다 */
  restyle: (id: string, pen: Pen) => void;
  /** 그린 것을 모두 지웁니다 */
  clearDrawings: () => void;
  /** 마지막에 그린 것 하나를 지웁니다 */
  undo: () => void;
  /** 보조지표를 켜고 끕니다 */
  toggleIndicator: (name: string, onCandle: boolean) => boolean;
  /**
   * 오른쪽에 빈 자리를 만듭니다.
   *
   * **이게 훈련의 핵심 장치입니다.** 마지막 봉 오른쪽에 여백이 있어야 앞날
   * 구간에 선을 그을 수 있고, 나중에 진짜 캔들이 그 자리를 채우면서
   * 내가 그은 선과 실제 경로가 겹쳐 보입니다.
   */
  setFutureSpace: (px: number) => void;
  /** 내가 그린 것을 잠시 감추거나 다시 보입니다 (겹쳐 보기 비교용) */
  setDrawingsVisible: (visible: boolean) => void;
  /** 내가 그은 수평선들의 가격 — 실제가 그 자리를 건드렸는지 대조할 때 씁니다 */
  horizontalLevels: () => number[];
  /** 지금 그려져 있는 것들의 목록 (개별로 지우기 위해) */
  listDrawings: () => { id: string; name: string }[];
  /** 하나만 지웁니다 */
  removeDrawing: (id: string) => void;
  /**
   * 봉 전체가 한 화면에 들어오게 맞춥니다.
   *
   * 이게 없으면 파동을 길게 그었을 때 왼쪽이 화면 밖으로 밀려 안 보입니다.
   * 검증 중에 실제로 ①~⑤ 라벨이 통째로 사라져 보였습니다.
   */
  fitAll: (barCount: number) => void;
  /** 지금 차트가 차지한 가로 폭 — 화면 크기에 맞춰 봉 수를 정할 때 씁니다 */
  width: () => number;
  /** 그려 둔 것을 저장할 수 있는 모양으로 꺼냅니다 */
  exportDrawings: () => SavedDrawing[];
  /** 저장해 둔 것을 도로 그립니다 */
  importDrawings: (list: SavedDrawing[]) => void;
};

/**
 * 저장해 두는 그림 하나.
 *
 * 화면 좌표(px)가 아니라 **시각과 가격**으로 적습니다. 그래야 나중에 확대·축소
 * 하거나 창 크기가 달라져도 같은 자리에 다시 그려집니다.
 */
export type SavedDrawing = {
  name: string;
  points: { timestamp?: number; value?: number }[];
  color: string;
  size: number;
};

/** 펜 하나를 klinecharts 가 아는 모양으로 바꿉니다 */
function penStyles(pen: Pen) {
  return {
    line: { color: pen.color, size: pen.size },
    point: { color: pen.color, borderColor: "rgba(255,255,255,.18)" },
    text: { color: pen.color },
    polygon: { color: pen.color, borderColor: pen.color },
  };
}

export function Kline({
  ref,
  onReady,
  onSelect,
  onDrawEnd,
}: {
  ref: React.Ref<KlineHandle>;
  onReady?: () => void;
  /** 그려진 것을 클릭해 고르거나 풀었을 때 알려 줍니다 (색·굵기를 바꾸려고) */
  onSelect?: (picked: { id: string; name: string } | null) => void;
  /** 하나를 다 그렸을 때. 같은 도구를 다시 물리는 데 씁니다 */
  onDrawEnd?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  // 고른 것 알림은 ref 로 들고 있습니다 — 그리기 시작할 때 건 함수가
  // 나중 렌더의 것을 가리키게 하려는 것입니다
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  /** 지금이 분·시간봉인가 — 날짜에 시각을 붙일지 정할 때 씁니다 */
  const intradayRef = useRef(false);
  /** 아직 다 못 그린 도형의 id */
  const pendingRef = useRef<string | null>(null);
  const drawEndRef = useRef(onDrawEnd);
  drawEndRef.current = onDrawEnd;

  /** 그리다 만 도형을 물립니다 */
  const cancelPending = () => {
    const id = pendingRef.current;
    if (!id) return;
    pendingRef.current = null;
    chartRef.current?.removeOverlay({ id });
    drawnRef.current = drawnRef.current.filter((x) => x !== id);
  };
  const drawnRef = useRef<string[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let disposed = false;
    let api: typeof import("klinecharts") | null = null;

    (async () => {
      // 브라우저에서만 불러옵니다 — 위 주석 참고
      api = await import("klinecharts");
      if (disposed || !boxRef.current) return;

      // 트레이딩뷰 방식으로 새로 만든 도구들을 등록합니다 (overlays.ts 참고)
      const { CUSTOM_OVERLAYS } = await import("./overlays");
      for (const t of CUSTOM_OVERLAYS) api.registerOverlay(t);

      const chart = api.init(boxRef.current, {
        styles: {
          grid: {
            horizontal: { color: "#1a1f27" },
            vertical: { color: "#1a1f27" },
          },
          candle: {
            // 한국 증시 관행에 맞춰 상승 빨강, 하락 파랑
            bar: {
              upColor: "#ff5445",
              downColor: "#4a90ff",
              upBorderColor: "#ff5445",
              downBorderColor: "#4a90ff",
              upWickColor: "#ff5445",
              downWickColor: "#4a90ff",
            },
            priceMark: {
              high: { color: "#b3ada2" },
              low: { color: "#b3ada2" },
              last: {
                upColor: "#ff5445",
                downColor: "#4a90ff",
                noChangeColor: "#7d8590",
              },
            },
            tooltip: {
              // 종목명을 감춰야 훈련이 됩니다. 기본 표시를 끕니다.
              title: { show: false },
              legend: {
                template: [
                  { title: "시", value: "{open}" },
                  { title: "고", value: "{high}" },
                  { title: "저", value: "{low}" },
                  { title: "종", value: "{close}" },
                ],
              },
            },
          },
          indicator: {
            tooltip: { title: { show: true } },
          },
          xAxis: {
            axisLine: { color: "#232932" },
            tickLine: { color: "#232932" },
            tickText: { color: "#7d8590" },
          },
          yAxis: {
            axisLine: { color: "#232932" },
            tickLine: { color: "#232932" },
            tickText: { color: "#7d8590" },
          },
          crosshair: {
            horizontal: {
              line: { color: "#545c67" },
              text: { backgroundColor: "#333b47" },
            },
            vertical: {
              line: { color: "#545c67" },
              text: { backgroundColor: "#333b47" },
            },
          },
          overlay: {
            line: { color: "#c8a15a", size: 1.5 },
            point: {
              color: "#c8a15a",
              borderColor: "rgba(200,161,90,.25)",
              activeColor: "#e9e5dd",
            },
            text: { color: "#e9e5dd" },
          },
        },
      });

      if (!chart) return;
      chartRef.current = chart;

      /*
       * 일봉만 다루므로 시각은 군더더기입니다. 기본값은 축과 십자선에
       * "2025-06-24 22:30" 처럼 시각까지 붙여 놓는데, 미국장 마감을 한국
       * 시각으로 옮긴 숫자라 오해를 부릅니다("이거 일봉 맞나?").
       * 날짜만 남깁니다.
       */
      chart.setFormatter({
        formatDate: ({ timestamp }) => {
          const d = new Date(timestamp);
          const p = (n: number) => String(n).padStart(2, "0");
          const day = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
          if (!intradayRef.current) return day;
          // 분·시간봉은 시각이 있어야 어느 봉인지 알 수 있습니다
          return `${day} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
        },
      });

      /*
       * 좁은 화면에서 가격 눈금이 사라지는 일이 있었습니다. 화면 배치가
       * 끝나기 전에 차트가 크기를 재서 생긴 문제라, 배치가 끝난 뒤 한 번 더
       * 재게 합니다. 창 크기가 바뀔 때도 같이 다시 잽니다.
       */
      const remeasure = () => chartRef.current?.resize();
      requestAnimationFrame(remeasure);
      setTimeout(remeasure, 250);
      window.addEventListener("resize", remeasure);
      window.addEventListener("orientationchange", remeasure);
      cleanupRef.current = () => {
        window.removeEventListener("resize", remeasure);
        window.removeEventListener("orientationchange", remeasure);
      };

      onReady?.();
    })();

    return () => {
      disposed = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (chartRef.current && api) {
        api.dispose(chartRef.current);
        chartRef.current = null;
      }
    };
    // 최초 한 번만 만듭니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    setData(bars, period) {
      const chart = chartRef.current;
      if (!chart) return;
      // 분·시간봉이면 축과 십자선에 시각까지 보여야 합니다
      intradayRef.current = period.type === "minute" || period.type === "hour";
      chart.setSymbol({ ticker: "PRACTICE" });
      chart.setPeriod(period);
      chart.setDataLoader({
        getBars: ({ callback }) => callback(bars, false),
      });
    },
    startDraw(name, pen) {
      /*
       * 색·굵기를 만들 때 함께 넘깁니다. klinecharts 는 이걸 `overlay.styles`
       * 로 들고 있고, 우리 도구들은 그 값을 읽어 그립니다(overlays.ts 참고).
       * 기본 도구들은 라이브러리가 알아서 씁니다.
       *
       * 클릭해서 고르면 알려 주도록 `onSelected` 도 같이 겁니다 — 그래야
       * 이미 그은 선의 색을 나중에 바꿀 수 있습니다.
       */
      // 아직 안 끝난 도형이 있으면 먼저 물립니다 — 반쯤 그린 게 남지 않게
      cancelPending();
      const id = chartRef.current?.createOverlay({
        name,
        styles: penStyles(pen),
        onSelected: (e) => {
          selectRef.current?.({ id: String(e.overlay.id), name: e.overlay.name });
          return false;
        },
        onDeselected: () => {
          selectRef.current?.(null);
          return false;
        },
        onRemoved: () => {
          selectRef.current?.(null);
          return false;
        },
        /*
         * 하나를 다 그리면 **같은 도구를 곧바로 다시 물립니다.**
         *
         * 그러지 않으면 한 번 그릴 때마다 도구가 풀려서, 다음 선을 그으려고
         * 끌면 화면만 움직입니다. 도구를 다시 눌러야 하는 걸 모르면 "그리기가
         * 안 된다"고 느낍니다. 트레이딩뷰도 도구를 물려 두는 쪽입니다.
         *
         * 곧바로 부르면 지금 끝나는 도형 처리 중에 끼어들게 되므로 한 박자
         * 뒤로 미룹니다.
         */
        onDrawEnd: () => {
          pendingRef.current = null;
          setTimeout(() => drawEndRef.current?.(), 0);
          return false;
        },
      });
      if (typeof id === "string") {
        drawnRef.current.push(id);
        pendingRef.current = id;
      }
    },
    cancelDraw: cancelPending,
    restyle(id, pen) {
      chartRef.current?.overrideOverlay({ id, styles: penStyles(pen) });
    },
    clearDrawings() {
      const chart = chartRef.current;
      if (!chart) return;
      for (const id of drawnRef.current) chart.removeOverlay({ id });
      drawnRef.current = [];
    },
    undo() {
      const id = drawnRef.current.pop();
      if (id) chartRef.current?.removeOverlay({ id });
    },
    toggleIndicator(name, onCandle) {
      const chart = chartRef.current;
      if (!chart) return false;

      /*
       * 지금 붙어 있는지 **차트에 직접 물어봅니다.**
       *
       * 예전에는 우리가 따로 적어 뒀는데, `createIndicator` 가 돌려주는 값을
       * paneId 로 잘못 알고 저장했습니다. 실제로는 **지표 id** 입니다. 그래서
       * 지울 때 `{paneId: 지표id}` 로 찾게 되어 아무것도 안 지워졌고,
       * 적어 둔 것도 비어 있어서 다시 누르면 **같은 지표가 하나 더** 붙었습니다.
       * (거래량을 세 번 누르면 판이 두 개가 됐습니다.)
       *
       * 차트에 물어보면 우리가 세는 일 자체가 없어지므로 어긋날 수가 없고,
       * 이미 중복으로 붙어 있던 것도 이번에 같이 정리됩니다.
       */
      const existing = chart.getIndicators({ name });
      if (existing.length > 0) {
        for (const ind of existing) chart.removeIndicator({ id: ind.id });
        return false;
      }

      // 이동평균·볼린저는 캔들 위에, 나머지는 아래 판에 따로 그립니다
      chart.createIndicator(
        onCandle ? { name, paneId: "candle_pane" } : name,
        true,
      );
      return true;
    },
    setFutureSpace(px) {
      /*
       * 좁은 화면에서 260px 를 그대로 비우면 폭 390px 중 가격축 70px 을 빼고
       * 봉이 설 자리가 60px 밖에 안 남습니다. 실제로 휴대폰에서 봉 스무 개만
       * 보였습니다. 그래서 **폭의 3분의 1**을 넘지 않게 묶습니다.
       */
      const box = boxRef.current;
      const cap = box ? box.clientWidth * 0.34 : px;
      chartRef.current?.setOffsetRightDistance(Math.min(px, cap));
    },
    setDrawingsVisible(visible) {
      const chart = chartRef.current;
      if (!chart) return;
      for (const id of drawnRef.current) chart.overrideOverlay({ id, visible });
    },
    horizontalLevels() {
      const chart = chartRef.current;
      if (!chart) return [];
      return chart
        .getOverlays()
        .filter((o) =>
          ["horizontalStraightLine", "horizontalRayLine", "horizontalSegment", "priceLine"].includes(
            o.name,
          ),
        )
        .map((o) => o.points?.[0]?.value)
        .filter((v): v is number => typeof v === "number");
    },
    listDrawings() {
      return (chartRef.current?.getOverlays() ?? []).map((o) => ({
        id: o.id,
        name: o.name,
      }));
    },
    removeDrawing(id) {
      chartRef.current?.removeOverlay({ id });
      drawnRef.current = drawnRef.current.filter((x) => x !== id);
    },
    fitAll(barCount) {
      const chart = chartRef.current;
      const box = boxRef.current;
      if (!chart || !box || barCount <= 0) return;
      // 오른쪽 가격축과 앞날 여백을 뺀 폭을 봉 수로 나눕니다
      const usable = box.clientWidth - 70 - chart.getOffsetRightDistance();
      chart.setBarSpace(Math.max(1.5, usable / barCount));
    },
    width() {
      return boxRef.current?.clientWidth ?? 0;
    },
    exportDrawings() {
      const chart = chartRef.current;
      if (!chart) return [];
      const pending = pendingRef.current;
      return chart
        .getOverlays()
        // 그리다 만 것은 저장하지 않습니다
        .filter((o) => o.id !== pending && (o.points?.length ?? 0) > 0)
        .map((o) => {
          const line = (
            o.styles as { line?: { color?: string; size?: number } } | undefined
          )?.line;
          return {
            name: o.name,
            points: (o.points ?? []).map((p) => ({
              timestamp: p.timestamp,
              value: p.value,
            })),
            color: line?.color ?? "#c8a15a",
            size: line?.size ?? 2,
          };
        });
    },
    importDrawings(list) {
      const chart = chartRef.current;
      if (!chart) return;
      for (const s of list) {
        const id = chart.createOverlay({
          name: s.name,
          points: s.points,
          styles: penStyles({ color: s.color, size: s.size }),
          onSelected: (e) => {
            selectRef.current?.({
              id: String(e.overlay.id),
              name: e.overlay.name,
            });
            return false;
          },
          onDeselected: () => {
            selectRef.current?.(null);
            return false;
          },
          onRemoved: () => {
            selectRef.current?.(null);
            return false;
          },
        });
        if (typeof id === "string") drawnRef.current.push(id);
      }
    },
  }));

  return <div ref={boxRef} className="kline" />;
}
