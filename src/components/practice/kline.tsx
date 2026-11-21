"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { AxisCreateRangeParams, AxisRange, Chart, KLineData, Period } from "klinecharts";

/** klinecharts 가 가격 눈금 위·아래에 두는 여백 (라이브러리 기본값) */
const GAP_TOP = 0.2;
const GAP_BOTTOM = 0.1;

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
   * 보조지표를 **이 목록 그대로** 맞춥니다.
   *
   * 저장해 둔 것을 되살릴 때 씁니다. `toggleIndicator` 로 되살리면 켜고 끄기라
   * 한 번 더 불리는 순간 도로 꺼집니다 — 차트를 다시 만들 때(종목·봉단위를
   * 바꿀 때) 실제로 그럴 수 있습니다. 몇 번을 불러도 결과가 같게 둡니다.
   */
  setIndicators: (list: { name: string; onCandle: boolean; params?: number[] }[]) => void;
  /** 가격 눈금 — 보통 / 로그 / % */
  setYScale: (name: "normal" | "logarithm" | "percentage") => void;
  /** 그을 때 고가·저가에 붙이기 */
  setMagnet: (mode: "normal" | "weak_magnet" | "strong_magnet") => void;
  /** 그린 것 하나를 잠그거나 풉니다. 잠긴 것은 눌러도 안 골라지고 안 움직입니다 */
  setDrawingLocked: (id: string, locked: boolean) => void;
  /** 그린 것 하나만 감추거나 다시 보입니다 */
  setDrawingHidden: (id: string, hidden: boolean) => void;
  /** 그린 것을 **이 목록 그대로** 맞춥니다 — 되돌리기·다시 하기에 씁니다 */
  restoreDrawings: (list: SavedDrawing[]) => void;
  /** 지금 화면을 그림 파일 주소로 (PNG) */
  picture: () => string;
  /** 비교 종목을 붙이거나(값) 뗍니다(null) */
  setCompare: (
    slot: string,
    data: { ticker: string; color: string; closes: Record<number, number> } | null,
  ) => void;
  /**
   * 그리기를 멈추고 **화면 이동·선택 모드**로 돌립니다.
   *
   * 도구가 물려 있는 동안에는 화면 아무 곳을 눌러도 "새로 그리기" 로 먹힙니다.
   * 그래서 이미 그어 둔 선을 고르거나 점을 끌어 옮길 수가 없었습니다.
   * 고른 것이 있으면 그 선택도 함께 풉니다.
   */
  stopDraw: () => void;
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
  /**
   * 지금 그려져 있는 것들 — id 와 함께 **무엇으로 그렸는지**까지.
   *
   * 색·굵기·좌표가 같이 나오는 이유는, 자동으로 그어 주는 것(고저점·피보나치)이
   * **새로고침 뒤에도 자기가 그은 것을 알아볼 수 있어야** 하기 때문입니다.
   * id 만으로는 화면을 새로 여는 순간 연결이 끊깁니다.
   */
  listDrawings: () => {
    id: string;
    name: string;
    color: string;
    size: number;
    points: { timestamp?: number; value?: number }[];
    locked: boolean;
    hidden: boolean;
  }[];
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
  /** 저장해 둔 것을 도로 그리고, 만들어진 id 를 돌려줍니다 */
  importDrawings: (list: SavedDrawing[]) => string[];
  /**
   * 가격·봉 비율 고정 (트레이딩뷰의 Lock price to bar ratio).
   * 켜면 확대·축소해도 **선의 기울기와 봉 모양이 그대로** 입니다.
   */
  setPriceLock: (on: boolean) => void;
  /** 가격 눈금 뒤집기 — 위가 싼 값, 아래가 비싼 값 */
  setInvert: (on: boolean) => void;
  /** 가격 눈금을 다시 봉에 맞춥니다 (눈금을 손으로 끌어 늘였을 때 되돌리기) */
  autoFitPrice: () => void;
  /** 화면 좌표(clientX·Y)가 가리키는 가격. 캔들 판 밖이면 null */
  priceAt: (clientX: number, clientY: number) => number | null;
  /** 방금 오른쪽 단추로 누른 그림 — 우클릭 메뉴가 묻습니다 */
  takeRightHit: () => { id: string; name: string } | null;
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
  /** 잠금 — 실수로 끌어 옮기지 않게 (없으면 풀림) */
  locked?: boolean;
  /** 감춤 — 지우지 않고 잠시 안 보이게 (없으면 보임) */
  hidden?: boolean;
};

/**
 * 빠르게 두 번 누르면 두 번째가 통째로 무시되는 것을 고칩니다.
 *
 * klinecharts 안을 열어 보면 이렇습니다(`EventHandlerImp`).
 *
 *     ++this._clickCount;
 *     if (this._clickTimeoutId !== null && this._clickCount > 1) {
 *         // 5px 안이면 더블클릭으로 보냅니다
 *         ...
 *         this._resetClickTimeout();
 *     } else {
 *         this._processEvent(compatEvent, this._handler.mouseClickEvent);
 *     }
 *
 * **두 번째 클릭은 `else` 로 안 가므로 클릭이 아예 전달되지 않습니다.**
 * 거리와 무관합니다 — 5px 는 "더블클릭으로 볼지" 를 가를 뿐이고, 멀리 떨어진
 * 곳을 눌러도 삼켜집니다. 창은 `Delay.ResetClick = 500ms` 로 꽤 깁니다.
 * 추세선 두 점을 보통 속도로 찍으면 그냥 걸립니다.
 *
 * 그래서 클릭을 처리한 뒤 곧바로 세던 것을 되돌립니다. 그러면 **모든 클릭이
 * 늘 "첫 클릭"** 이 되어 하나도 안 삼켜집니다.
 *
 * 잃는 것: 더블클릭 묶기. 이 라이브러리에서 더블클릭이 쓰이는 곳은 **그리다
 * 만 도형을 강제로 끝내는 것** 하나뿐인데(`overlay.forceComplete()`), 우리
 * 도구는 전부 찍을 점 수가 정해져 있어 마지막 점에서 저절로 끝납니다.
 * 오히려 그 강제 종료가 "가까이 두 번 누르면 그리기가 튕긴다" 의 원인이었습니다.
 *
 * 클래스가 밖으로 나와 있지 않아 **차트 안을 훑어 그 물건을 찾습니다.** 못
 * 찾으면 조용히 넘어갑니다 — 예전처럼 동작할 뿐 깨지지는 않습니다.
 */
type ClickState = {
  _clickCount: number;
  _clickTimeoutId: unknown;
  _resetClickTimeout?: () => void;
};

function relaxClickCoalescing(root: object): boolean {
  const seen = new Set<object>();
  const queue: object[] = [root];

  for (let step = 0; step < 6000 && queue.length > 0; step++) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    seen.add(cur);

    if ("_clickCount" in cur && "_clickTimeoutId" in cur) {
      const proto = Object.getPrototypeOf(cur) as {
        _mouseUpHandler?: (e: unknown) => void;
        __relaxed?: boolean;
      } | null;
      const orig = proto?._mouseUpHandler;
      if (!proto || typeof orig !== "function") return false;
      if (proto.__relaxed) return true;
      proto._mouseUpHandler = function (this: ClickState, e: unknown) {
        orig.call(this, e);
        // 다음 클릭이 늘 첫 클릭이 되게
        this._resetClickTimeout?.();
      };
      proto.__relaxed = true;
      return true;
    }

    for (const v of Object.values(cur)) {
      if (!v || typeof v !== "object") continue;
      // DOM 과 캔버스는 들어가 봐야 소득 없이 크기만 합니다
      if (v instanceof Node || ArrayBuffer.isView(v)) continue;
      queue.push(v as object);
    }
  }
  return false;
}

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
  onMoveEnd,
}: {
  ref: React.Ref<KlineHandle>;
  onReady?: () => void;
  /** 그려진 것을 클릭해 고르거나 풀었을 때 알려 줍니다 (색·굵기를 바꾸려고) */
  onSelect?: (picked: { id: string; name: string } | null) => void;
  /** 하나를 다 그렸을 때. 저장하고 이동·선택으로 돌아가는 데 씁니다 */
  onDrawEnd?: () => void;
  /**
   * 이미 그린 것을 **끌어서 옮기고 손을 뗐을 때.**
   *
   * 이게 없으면 자리를 옮겨 놓고 나갔다가 돌아왔을 때 **옮기기 전 자리로
   * 되돌아가 있습니다.** 저장은 그릴 때·지울 때·색을 바꿀 때만 하고 있었고
   * "옮겼을 때" 가 빠져 있었습니다.
   */
  onMoveEnd?: () => void;
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
  const moveEndRef = useRef(onMoveEnd);
  moveEndRef.current = onMoveEnd;

  /* ── 가격 눈금 상태 ─────────────────────────────────────────────
   *
   * klinecharts 는 눈금 이름(보통·로그·%)을 바꿀 때 축을 **새로 만들면서
   * 넘겨준 설정만** 남깁니다. 뒤집기·비율 고정을 따로따로 걸면 이름을 바꿀
   * 때 앞의 것이 사라집니다. 그래서 셋을 여기 들고 있다가 늘 함께 넘깁니다.
   */
  const yNameRef = useRef<"normal" | "logarithm" | "percentage">("normal");
  const invertRef = useRef(false);
  const lockOnRef = useRef(false);
  /**
   * 고정한 비율 = (화면 1px 이 나타내는 눈금 값) × (봉 하나의 폭 px).
   * 봉 폭이 두 배가 되면 1px 의 값은 절반이 되어야 모양이 그대로입니다.
   * 로그 눈금이면 값이 로그라서 종목 가격대와 상관없이 뜻이 같습니다.
   */
  const lockRatioRef = useRef<number | null>(null);
  const rightHitRef = useRef<{ id: string; name: string; at: number } | null>(null);
  /**
   * 비율 고정 중 화면 가운데의 **가격**. 처음 잠글 때 그때 봉들의 가운데로
   * 정하고, 그 뒤로는 끌어 옮길 때만 바뀝니다.
   *
   * 예전에는 늘 화면 봉들의 가운데를 따라가게 했더니, 위아래로 끌어도
   * 도로 제자리로 돌아와 **위아래로는 못 움직였습니다.** 트레이딩뷰도 비율을
   * 고정하면 자동 맞춤이 꺼지고 위아래가 자유롭습니다.
   *
   * 가격(봉 값)으로 들고 있는 까닭: % 눈금은 화면 왼쪽 끝 봉이 기준이라
   * 좌우로 옮길 때마다 눈금 값이 바뀝니다. 가격은 안 바뀝니다.
   */
  const lockCenterRef = useRef<number | null>(null);
  /** 마지막으로 그린 눈금의 가격 ↔ 눈금 값 바꾸기 — 끌어 옮길 때 씁니다 */
  const lockMapRef = useRef<{ toReal: (v: number) => number; toValue: (r: number) => number } | null>(null);
  /** 지금 끌고 있는 것이 그림인가 — 그림을 옮길 때는 화면을 위아래로 움직이지 않습니다 */
  const overlayDragRef = useRef(false);

  /*
   * 그린 것 하나에 거는 손잡이들.
   *
   * 새로 그릴 때(`startDraw`)와 저장해 둔 것을 되살릴 때(`importDrawings`)
   * **똑같이** 걸어야 합니다. 예전에는 되살린 것에 `onPressedMoveEnd` 가
   * 빠져 있어서, 다시 들어와 옮긴 것은 저장되지 않았습니다.
   */
  const overlayHooks = () => ({
    onSelected: (e: { overlay: { id: string | number; name: string } }) => {
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
    onPressedMoveStart: () => {
      overlayDragRef.current = true;
      return false;
    },
    onPressedMoveEnd: () => {
      // 끌어 옮기고 손을 뗀 순간. 한 박자 뒤에 알려야 좌표가 확정돼 있습니다
      setTimeout(() => moveEndRef.current?.(), 0);
      return false;
    },
    /*
     * 오른쪽 단추. klinecharts 는 그림을 오른쪽 단추로 누르면 **말없이 지웁니다.**
     * 저장도 되돌리기 기록도 안 거치고 사라져서, 다시 들어오면 되살아나 있었습니다.
     * 지우지 않게 막고, 무엇을 눌렀는지 적어 둡니다 — 뒤이어 뜨는 우클릭
     * 메뉴가 "이 그림 지우기·잠그기" 를 보여 줍니다.
     */
    onRightClick: (e: { overlay: { id: string | number; name: string }; preventDefault?: () => void }) => {
      e.preventDefault?.();
      rightHitRef.current = { id: String(e.overlay.id), name: e.overlay.name, at: Date.now() };
      return false;
    },
  });

  /*
   * 가격 눈금의 범위를 정하는 자리. 라이브러리가 화면을 다시 그릴 때마다
   * 부릅니다(`createRange`). 고정이 꺼져 있으면 라이브러리 기본과 똑같이 돌려줍니다.
   *
   * 로그·% 눈금은 각자 범위 계산이 있는데, 여기를 갈아 끼우면 그것까지
   * 덮어씁니다. 그래서 세 눈금의 계산을 여기서 똑같이 다시 합니다.
   */
  const createRange = ({ chart, defaultRange }: AxisCreateRangeParams): AxisRange => {
    const name = yNameRef.current;
    const { from, to, range } = defaultRange;
    let base: AxisRange = defaultRange;
    if (name === "logarithm") {
      const lg = (v: number) => (v < 0 ? -Math.log10(Math.abs(v)) : Math.log10(v));
      const realFrom = lg(from);
      const realTo = lg(to);
      base = { from, to, range, realFrom, realTo, realRange: realTo - realFrom, displayFrom: from, displayTo: to, displayRange: range };
    } else if (name === "percentage") {
      const k = chart.getDataList()[chart.getVisibleRange().from];
      if (k && k.close !== 0) {
        const realFrom = ((from - k.close) / k.close) * 100;
        const realTo = ((to - k.close) / k.close) * 100;
        base = { from, to, range, realFrom, realTo, realRange: realTo - realFrom, displayFrom: realFrom, displayTo: realTo, displayRange: realTo - realFrom };
      }
    }

    const ratio = lockRatioRef.current;
    if (ratio == null || !lockOnRef.current) return base;
    const h = chart.getSize("candle_pane", "main")?.height ?? 0;
    const bar = chart.getBarSpace().bar;
    if (!(h > 0) || !(bar > 0) || !(base.realRange > 0)) return base;

    /*
     * 라이브러리는 여기서 돌려준 범위에 위 20%·아래 10% 여백을 덧붙입니다.
     * 비율은 여백까지 넣은 전체로 쟀으니 그만큼 덜어서 돌려줍니다.
     */
    const span = ((ratio / bar) * h) / (1 + GAP_TOP + GAP_BOTTOM);
    // 눈금 값 ↔ 봉 가격 — 눈금마다 다릅니다 (로그는 라이브러리 식 그대로)
    const toValue = (r: number) =>
      name === "logarithm"
        ? r < 0
          ? -(10 ** Math.abs(r))
          : 10 ** r
        : name === "percentage"
          ? base.from + ((r - base.realFrom) / base.realRange) * base.range
          : r;
    const toReal = (v: number) =>
      name === "logarithm"
        ? v < 0
          ? -Math.log10(Math.abs(v))
          : Math.log10(v)
        : name === "percentage"
          ? base.realFrom + ((v - base.from) / base.range) * base.realRange
          : v;
    lockMapRef.current = { toReal, toValue };
    // 가운데 — 처음 한 번만 그때 봉들의 가운데로 정하고 그 뒤로는 그대로 (위 lockCenterRef 참고)
    if (lockCenterRef.current == null) lockCenterRef.current = toValue((base.realFrom + base.realTo) / 2);
    const mid = toReal(lockCenterRef.current);
    if (!Number.isFinite(mid)) return base;
    const realFrom = mid - span / 2;
    const realTo = mid + span / 2;
    const f = toValue(realFrom);
    const t = toValue(realTo);
    const display = (r: number, v: number) => (name === "logarithm" ? v : r);
    return {
      from: f,
      to: t,
      range: t - f,
      realFrom,
      realTo,
      realRange: realTo - realFrom,
      displayFrom: display(realFrom, f),
      displayTo: display(realTo, t),
      displayRange: display(realTo, t) - display(realFrom, f),
    };
  };

  /** 지금 들고 있는 눈금 설정 셋을 한꺼번에 축에 넘깁니다 */
  const applyYAxis = () => {
    chartRef.current?.overrideYAxis({
      paneId: "candle_pane",
      name: yNameRef.current,
      reverse: invertRef.current,
      createRange,
    });
  };

  /**
   * 비율을 새로 잽니다. 종목·봉 단위·눈금이 바뀌면 예전 비율은 뜻이 없습니다
   * ($5 짜리와 $500 짜리는 1px 의 값이 100배 다릅니다). 고정을 잠깐 풀고
   * 라이브러리가 봉에 맞춘 범위를 그린 다음, 그 모양을 그대로 잠급니다.
   */
  const relockTimer = useRef(0);
  const relock = () => {
    lockRatioRef.current = null;
    // 새로 잠그면 가운데도 그때 봉들에 맞춰 다시 정합니다
    lockCenterRef.current = null;
    applyYAxis();
    window.clearTimeout(relockTimer.current);
    if (!lockOnRef.current) return;
    // 그리기는 다음 장면에 일어납니다 — 그 뒤에 재야 새 범위가 잡혀 있습니다
    relockTimer.current = window.setTimeout(() => {
      const chart = chartRef.current;
      if (!chart || !lockOnRef.current) return;
      const axis = chart.getYAxes({ paneId: "candle_pane" })[0];
      const h = chart.getSize("candle_pane", "main")?.height ?? 0;
      const bar = chart.getBarSpace().bar;
      const r = axis?.getRange().realRange ?? 0;
      if (h > 0 && bar > 0 && r > 0) {
        lockRatioRef.current = (r / h) * bar;
        applyYAxis();
      }
    }, 60);
  };

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
  /** 자석 — 새로 그리는 것에 붙여 줍니다 */
  const magnetRef = useRef<"normal" | "weak_magnet" | "strong_magnet">("normal");

  /** 그린 것 하나를 저장할 모양으로 */
  const toSaved = (o: {
    name: string;
    points?: { timestamp?: number; value?: number }[];
    styles?: unknown;
    lock?: boolean;
    visible?: boolean;
  }): SavedDrawing => {
    const line = (o.styles as { line?: { color?: string; size?: number } } | undefined)?.line;
    const s: SavedDrawing = {
      name: o.name,
      points: (o.points ?? []).map((p) => ({ timestamp: p.timestamp, value: p.value })),
      color: line?.color ?? "#c8a15a",
      size: line?.size ?? 2,
    };
    // 기본값(풀림·보임)이면 적지 않습니다 — 저장 크기와 예전 자료와의 호환
    if (o.lock) s.locked = true;
    if (o.visible === false) s.hidden = true;
    return s;
  };

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
      // 라이브러리에 없는 지표(VWAP·ATR·일목·비교)도 같은 식으로
      const { CUSTOM_INDICATORS } = await import("./indicators");
      for (const t of CUSTOM_INDICATORS) api.registerIndicator(t);

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

      // 빠르게 두 번 누르면 두 번째가 무시되던 것 — 위 설명 참고
      if (!relaxClickCoalescing(chart as unknown as object)) {
        console.warn(
          "[차트] 클릭 묶기를 풀 자리를 못 찾았습니다. 빠르게 두 번 누르면 " +
            "두 번째가 무시될 수 있습니다 (klinecharts 안쪽이 바뀐 듯합니다).",
        );
      }

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
      /*
       * klinecharts 가 차트 판에 `tabindex="1"` 을 답니다.
       *
       * **0 보다 큰 tabindex 는 탭 순서를 통째로 가로챕니다.** 그 요소가
       * 문서 어디에 있든 맨 앞으로 튀어나옵니다. 그래서 `/analyze` 와
       * `/practice` 에서 탭을 처음 누르면 "본문으로 건너뛰기" 가 아니라
       * **테두리도 안 보이는 차트 판**으로 갔습니다(`outline: none`).
       * 키보드로 쓰는 사람 눈에는 아무 일도 안 일어난 것처럼 보입니다.
       *
       * 우리 단축키(Ctrl+Z·Delete)는 창 전체에 걸어 두었으므로 이 판이
       * 포커스를 받을 필요가 없습니다. 탭 고리에서 빼되(-1) 눌러서 잡는 것은
       * 그대로 둡니다.
       */
      const dropTabStop = () => {
        // 우리가 만든 껍데기가 아니라 **klinecharts 가 안에 만든 판**입니다
        for (const el of boxRef.current?.querySelectorAll("[tabindex]") ?? []) {
          if (Number(el.getAttribute("tabindex")) > 0)
            el.setAttribute("tabindex", "-1");
        }
      };
      dropTabStop();
      // 판을 다시 만드는 경우가 있어 한 번 더
      setTimeout(dropTabStop, 300);

      /*
       * 비교 종목은 **화면 왼쪽 끝 봉에서** 같이 출발해야 합니다. 화면을 끌어
       * 옮길 때마다 출발점을 바꿔 다시 계산하게 합니다. 끄는 동안 신호가 아주
       * 잦으므로 한 화면 그리기에 한 번만, 그리고 출발점이 실제로 바뀔 때만.
       */
      let rangeFrame = 0;
      chart.subscribeAction("onVisibleRangeChange", () => {
        cancelAnimationFrame(rangeFrame);
        rangeFrame = requestAnimationFrame(() => {
          const c = chartRef.current;
          if (!c) return;
          const from = c.getVisibleRange().from;
          for (const ind of c.getIndicators()) {
            if (!ind.name.startsWith("CMP")) continue;
            const ext = ind.extendData as { from?: number } | undefined;
            if (ext && ext.from !== from) {
              c.overrideIndicator({ name: ind.name, extendData: { ...ext, from } });
            }
          }
        });
      });

      const remeasure = () => chartRef.current?.resize();
      requestAnimationFrame(remeasure);
      setTimeout(remeasure, 250);
      window.addEventListener("resize", remeasure);
      window.addEventListener("orientationchange", remeasure);
      /*
       * 창 크기는 그대로인데 **차트 칸만** 달라지는 일이 생겼습니다 — 화면을
       * 2·4칸으로 나누거나 전체 화면으로 키울 때. 창 크기 신호만 듣고 있으면
       * 차트가 예전 크기로 그려져 잘리거나 빈 자리가 남습니다. 칸 자체를 지켜봅니다.
       */
      const ro =
        typeof ResizeObserver !== "undefined" && boxRef.current
          ? new ResizeObserver(() => remeasure())
          : null;
      if (ro && boxRef.current) ro.observe(boxRef.current);
      /*
       * 비율 고정 중 위아래로 끌기.
       *
       * 라이브러리는 자동 맞춤이 켜져 있으면 판을 끌어도 좌우로만 옮깁니다.
       * 좌우는 그대로 라이브러리에 맡기고, 위아래 움직임만 여기서 받아 가운데
       * 가격을 옮깁니다. 그림을 끌어 옮기는 중이거나, 그리는 중이거나,
       * 손가락 두 개(확대)일 때는 건드리지 않습니다.
       */
      const drag = { id: -1, y: 0, active: false, frame: 0, pending: 0 };
      const pointers = new Set<number>();
      const onDown = (e: PointerEvent) => {
        pointers.add(e.pointerId);
        overlayDragRef.current = false;
        drag.active = false;
        if (!lockOnRef.current || pointers.size > 1 || e.button !== 0 || pendingRef.current) return;
        const main = chartRef.current?.getDom("candle_pane", "main");
        if (!main || !(e.target instanceof Node) || !main.contains(e.target)) return;
        drag.id = e.pointerId;
        drag.y = e.clientY;
        drag.active = true;
      };
      const onMove = (e: PointerEvent) => {
        if (!drag.active || e.pointerId !== drag.id) return;
        // 그림을 눌렀는지는 누른 직후(라이브러리가 처리한 뒤)에야 압니다
        if (overlayDragRef.current || pendingRef.current || pointers.size > 1) {
          drag.active = false;
          return;
        }
        drag.pending += e.clientY - drag.y;
        drag.y = e.clientY;
        if (drag.frame) return;
        drag.frame = requestAnimationFrame(() => {
          drag.frame = 0;
          const chart = chartRef.current;
          const map = lockMapRef.current;
          const ratio = lockRatioRef.current;
          const center = lockCenterRef.current;
          const dy = drag.pending;
          drag.pending = 0;
          if (!chart || !map || ratio == null || center == null || dy === 0) return;
          // 아래로 끌면 차트가 따라 내려옵니다 = 화면 가운데는 더 비싼 값으로
          const perPx = ratio / chart.getBarSpace().bar;
          const next = map.toValue(map.toReal(center) + dy * perPx * (invertRef.current ? -1 : 1));
          if (Number.isFinite(next)) {
            lockCenterRef.current = next;
            applyYAxis();
          }
        });
      };
      const onUp = (e: PointerEvent) => {
        pointers.delete(e.pointerId);
        if (e.pointerId === drag.id) drag.active = false;
      };
      const box = boxRef.current;
      box?.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);

      cleanupRef.current = () => {
        box?.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        cancelAnimationFrame(drag.frame);
        window.removeEventListener("resize", remeasure);
        window.removeEventListener("orientationchange", remeasure);
        ro?.disconnect();
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
      // 다른 종목의 비율은 뜻이 없습니다 — 새 봉에 맞춰 다시 잽니다
      if (lockOnRef.current) relock();
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
        mode: magnetRef.current,
        ...overlayHooks(),
        /*
         * 하나를 다 그렸을 때 위쪽에 알립니다. 받는 쪽은 저장하고 **이동·선택
         * 으로 돌아갑니다.**
         *
         * 한때는 여기서 같은 도구를 다시 물렸습니다. 그런데 도구가 물려 있는
         * 동안에는 화면 아무 곳을 눌러도 "새로 그리기" 로 먹혀서, **방금 그은
         * 선을 고칠 수가 없었습니다.** 그리는 사람이 실제로 하는 일은 한 줄
         * 긋고 자리를 맞추는 것이라 이쪽이 맞습니다.
         *
         * 곧바로 부르면 지금 끝나는 도형 처리 중에 끼어들게 되므로 한 박자
         * 뒤로 미룹니다. `pendingRef` 를 먼저 비워야 뒤이어 오는 `stopDraw`
         * 가 **방금 그린 것을 지우지 않습니다.**
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
    setIndicators(list) {
      const chart = chartRef.current;
      if (!chart) return;
      const want = new Map(list.map((i) => [i.name, i]));
      // 원하지 않는 것은 걷어냅니다 — 비교 종목(CMP*)은 따로 다루므로 건드리지 않습니다
      for (const ind of chart.getIndicators()) {
        if (ind.name.startsWith("CMP")) continue;
        if (!want.has(ind.name)) chart.removeIndicator({ id: ind.id });
      }
      // 없는 것만 붙입니다 — 이미 있는 것을 또 붙이면 판이 하나 더 생깁니다
      for (const [name, { onCandle, params }] of want) {
        const existing = chart.getIndicators({ name });
        if (existing.length > 0) {
          /*
           * 이미 붙어 있으면 **설정만** 바꿉니다. 떼었다 다시 붙이면 아래 판의
           * 순서와 높이가 매번 뒤섞입니다.
           */
          const cur = existing[0].calcParams as number[];
          if (params && JSON.stringify(cur) !== JSON.stringify(params)) {
            chart.overrideIndicator({ name, calcParams: params });
          }
          continue;
        }
        const create = params ? { name, calcParams: params } : { name };
        chart.createIndicator(
          onCandle ? { ...create, paneId: "candle_pane" } : create,
          true,
        );
      }
    },
    setYScale(name) {
      /*
       * 라이브러리에 로그·% 눈금이 들어 있습니다. 캔들 판의 축만 바꿉니다
       * (아래 지표 판은 제 눈금 그대로).
       */
      yNameRef.current = name;
      // 뒤집기·비율 고정도 함께 넘깁니다 (위 "가격 눈금 상태" 참고)
      relock();
    },
    setPriceLock(on) {
      lockOnRef.current = on;
      relock();
    },
    setInvert(on) {
      invertRef.current = on;
      applyYAxis();
    },
    autoFitPrice() {
      // 같은 이름으로 다시 넘기면 라이브러리가 "손으로 맞춤" 을 풀고 봉에 다시 맞춥니다
      relock();
    },
    priceAt(clientX, clientY) {
      const chart = chartRef.current;
      const dom = chart?.getDom("candle_pane", "main");
      if (!chart || !dom) return null;
      const r = dom.getBoundingClientRect();
      const x = clientX - r.left;
      const y = clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) return null;
      const p = chart.convertFromPixel([{ x, y }], { paneId: "candle_pane" });
      const v = (Array.isArray(p) ? p[0] : p)?.value;
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    },
    takeRightHit() {
      const h = rightHitRef.current;
      rightHitRef.current = null;
      /*
       * 그림 위에서 누른 순간(단추를 누를 때)과 메뉴가 뜨는 순간(윈도에서는
       * 단추를 뗄 때)은 사람이 꾹 누르고 있으면 벌어집니다. 넉넉히 3초.
       */
      return h && Date.now() - h.at < 3000 ? { id: h.id, name: h.name } : null;
    },
    setMagnet(mode) {
      magnetRef.current = mode;
      // 이미 그린 것도 끌어 옮길 때 붙도록 함께 바꿉니다
      const chart = chartRef.current;
      if (!chart) return;
      for (const id of drawnRef.current) chart.overrideOverlay({ id, mode });
    },
    setDrawingLocked(id, locked) {
      chartRef.current?.overrideOverlay({ id, lock: locked });
    },
    setDrawingHidden(id, hidden) {
      chartRef.current?.overrideOverlay({ id, visible: !hidden });
    },
    restoreDrawings(list) {
      const chart = chartRef.current;
      if (!chart) return;
      cancelPending();
      for (const id of drawnRef.current) chart.removeOverlay({ id });
      drawnRef.current = [];
      for (const s of list) {
        const id = chart.createOverlay({
          name: s.name,
          points: s.points,
          styles: penStyles({ color: s.color, size: s.size }),
          lock: s.locked === true,
          visible: s.hidden !== true,
          mode: magnetRef.current,
          ...overlayHooks(),
        });
        if (typeof id === "string") drawnRef.current.push(id);
      }
    },
    picture() {
      // 어두운 배경을 깔아야 그림 파일에서 투명이 아니라 차트처럼 보입니다
      return chartRef.current?.getConvertPictureUrl(true, "png", "#0d1117") ?? "";
    },
    setCompare(slot, data) {
      const chart = chartRef.current;
      if (!chart) return;
      const existing = chart.getIndicators({ name: slot });
      if (!data) {
        for (const ind of existing) chart.removeIndicator({ id: ind.id });
        return;
      }
      // 지금 화면 왼쪽 끝에서 출발하게
      const ext = { ...data, from: chart.getVisibleRange().from };
      if (existing.length > 0) {
        chart.overrideIndicator({ name: slot, extendData: ext });
      } else {
        chart.createIndicator({ name: slot, paneId: "candle_pane", extendData: ext }, true);
      }
    },
    stopDraw() {
      cancelPending();
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
      return (chartRef.current?.getOverlays() ?? []).map((o) => {
        const line = (
          o.styles as { line?: { color?: string; size?: number } } | undefined
        )?.line;
        return {
          id: o.id,
          name: o.name,
          color: line?.color ?? "#c8a15a",
          size: line?.size ?? 2,
          points: (o.points ?? []).map((p) => ({
            timestamp: p.timestamp,
            value: p.value,
          })),
          locked: o.lock === true,
          hidden: o.visible === false,
        };
      });
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
      // 화면을 처음처럼 맞췄으니 고정 비율도 이 모양으로 다시 잡습니다
      if (lockOnRef.current) relock();
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
        .map(toSaved);
    },
    importDrawings(list) {
      const chart = chartRef.current;
      const made: string[] = [];
      if (!chart) return made;
      for (const s of list) {
        const id = chart.createOverlay({
          name: s.name,
          points: s.points,
          styles: penStyles({ color: s.color, size: s.size }),
          lock: s.locked === true,
          visible: s.hidden !== true,
          mode: magnetRef.current,
          ...overlayHooks(),
        });
        if (typeof id === "string") {
          drawnRef.current.push(id);
          made.push(id);
        }
      }
      return made;
    },
  }));

  return <div ref={boxRef} className="kline" />;
}
