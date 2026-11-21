/**
 * 직접 만든 보조지표들.
 *
 * klinecharts 에는 27개가 들어 있지만 **트레이딩뷰에서 많이 쓰는 셋이 없습니다** —
 * VWAP·ATR·일목균형표. 그리고 다른 종목을 겹쳐 보는 "비교" 도 지표 자리를
 * 빌려 만듭니다(차트 판에 선을 하나 더 얹는 일이라 구조가 같습니다).
 */

import type { IndicatorTemplate, KLineData } from "klinecharts";

/* ── VWAP ──────────────────────────────────────────────────────────
 *
 * 거래량으로 가중한 평균 가격. **하루가 바뀌면 처음부터 다시 셉니다** —
 * 트레이딩뷰 기본값("세션")과 같습니다.
 *
 * 하루를 가를 때 **뉴욕 날짜**로 봅니다. 그냥 UTC 날짜로 자르면 시간외
 * 거래를 켰을 때 겨울(표준시)엔 장후 거래가 다음 날로 넘어가 거기서
 * 끊깁니다(장후는 뉴욕 20시 = UTC 01시까지).
 *
 * 일봉 이상에서는 하루가 봉 하나라 VWAP 가 그 봉의 평균값과 같아집니다.
 * 뜻이 없으므로 화면에서 분·시간봉일 때만 켤 수 있게 둡니다.
 */
const nyDay = (() => {
  let fmt: Intl.DateTimeFormat | null = null;
  return (ts: number) => {
    fmt ??= new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(ts);
  };
})();

export const vwap: IndicatorTemplate<{ vwap?: number }> = {
  name: "VWAP",
  shortName: "VWAP",
  series: "price",
  precision: 2,
  calcParams: [],
  figures: [{ key: "vwap", title: "VWAP: ", type: "line" }],
  calc: (list: KLineData[]) => {
    let day = "";
    let pv = 0;
    let vol = 0;
    return list.map((k) => {
      const d = nyDay(k.timestamp);
      if (d !== day) {
        day = d;
        pv = 0;
        vol = 0;
      }
      const v = k.volume ?? 0;
      const typical = (k.high + k.low + k.close) / 3;
      pv += typical * v;
      vol += v;
      return vol > 0 ? { vwap: pv / vol } : {};
    });
  },
};

/* ── ATR ───────────────────────────────────────────────────────────
 *
 * 하루(한 봉)에 얼마나 움직이는가. 손절 폭을 잡을 때 많이 봅니다.
 * 트레이딩뷰와 같은 윌더 방식(RMA)으로 평탄화합니다 — 단순 평균을 쓰면
 * 값이 트레이딩뷰와 달라 대조할 때 헷갈립니다.
 */
export const atr: IndicatorTemplate<{ atr?: number }, number> = {
  name: "ATR",
  shortName: "ATR",
  precision: 2,
  calcParams: [14],
  figures: [{ key: "atr", title: "ATR: ", type: "line" }],
  calc: (list: KLineData[], ind) => {
    const n = Math.max(1, Math.round(ind.calcParams[0] ?? 14));
    let prevClose: number | null = null;
    let sum = 0;
    let value: number | null = null;
    return list.map((k, i) => {
      const tr =
        prevClose === null
          ? k.high - k.low
          : Math.max(
              k.high - k.low,
              Math.abs(k.high - prevClose),
              Math.abs(k.low - prevClose),
            );
      prevClose = k.close;
      if (value === null) {
        sum += tr;
        if (i === n - 1) value = sum / n;
      } else {
        value = (value * (n - 1) + tr) / n;
      }
      return value === null ? {} : { atr: value };
    });
  },
};

/* ── 일목균형표 ─────────────────────────────────────────────────────
 *
 * 전환선·기준선·선행스팬 A/B·후행스팬. 기본값 9·26·52.
 *
 * 선행스팬은 원래 **26봉 앞으로** 그립니다. 그런데 차트에는 아직 오지 않은
 * 날의 봉이 없어서 마지막 26봉치 구름은 그릴 자리가 없습니다. 그래서 i 번째
 * 자리에 "26봉 전에 계산된 값" 을 놓는 방식으로 그립니다 — 과거 구간의 구름은
 * 트레이딩뷰와 정확히 같은 자리에 오고, **앞날 26봉치만 비어 있습니다.**
 * 후행스팬도 같은 이유로 마지막 26봉은 비어 있습니다.
 *
 * 구름(두 선행스팬 사이)은 직접 칠합니다. A 가 위면 옅은 빨강(상승),
 * B 가 위면 옅은 파랑(하락) — 이 사이트의 상승·하락 색과 맞춥니다.
 */
type Ichi = {
  tenkan?: number;
  kijun?: number;
  spanA?: number;
  spanB?: number;
  chikou?: number;
};

function midpoint(list: KLineData[], end: number, n: number): number | undefined {
  if (end - n + 1 < 0) return undefined;
  let hi = -Infinity;
  let lo = Infinity;
  for (let j = end - n + 1; j <= end; j++) {
    if (list[j].high > hi) hi = list[j].high;
    if (list[j].low < lo) lo = list[j].low;
  }
  return (hi + lo) / 2;
}

export const ichimoku: IndicatorTemplate<Ichi, number> = {
  name: "ICHIMOKU",
  shortName: "일목",
  series: "price",
  precision: 2,
  calcParams: [9, 26, 52],
  figures: [
    { key: "tenkan", title: "전환: ", type: "line" },
    { key: "kijun", title: "기준: ", type: "line" },
    { key: "spanA", title: "선행A: ", type: "line" },
    { key: "spanB", title: "선행B: ", type: "line" },
    { key: "chikou", title: "후행: ", type: "line" },
  ],
  styles: {
    lines: [
      { color: "#4a90ff", size: 1, style: "solid", smooth: false, dashedValue: [2, 2] },
      { color: "#ff5445", size: 1, style: "solid", smooth: false, dashedValue: [2, 2] },
      { color: "#d47a72", size: 1, style: "solid", smooth: false, dashedValue: [2, 2] },
      { color: "#6c8fc4", size: 1, style: "solid", smooth: false, dashedValue: [2, 2] },
      { color: "#7fa86b", size: 1, style: "solid", smooth: false, dashedValue: [2, 2] },
    ],
  },
  calc: (list: KLineData[], ind) => {
    const [t = 9, k = 26, s = 52] = ind.calcParams.map((x) => Math.max(1, Math.round(x)));
    const tenkan = list.map((_, i) => midpoint(list, i, t));
    const kijun = list.map((_, i) => midpoint(list, i, k));
    return list.map((_, i) => {
      const j = i - k; // 26봉 전에 계산된 선행값을 지금 자리에
      const a =
        j >= 0 && tenkan[j] !== undefined && kijun[j] !== undefined
          ? ((tenkan[j] as number) + (kijun[j] as number)) / 2
          : undefined;
      const b = j >= 0 ? midpoint(list, j, s) : undefined;
      const ahead = list[i + k];
      return {
        tenkan: tenkan[i],
        kijun: kijun[i],
        spanA: a,
        spanB: b,
        chikou: ahead ? ahead.close : undefined,
      };
    });
  },
  draw: ({ ctx, chart, indicator, xAxis, yAxis }) => {
    const { from, to } = chart.getVisibleRange();
    const res = indicator.result as Ichi[];
    // A·B 가 뒤바뀌는 자리마다 끊어서 색을 바꿔 칠합니다
    let run: { x: number; a: number; b: number }[] = [];
    let up: boolean | null = null;
    const flush = () => {
      if (run.length >= 2 && up !== null) {
        ctx.beginPath();
        run.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.a) : ctx.lineTo(p.x, p.a)));
        for (let i = run.length - 1; i >= 0; i--) ctx.lineTo(run[i].x, run[i].b);
        ctx.closePath();
        ctx.fillStyle = up ? "rgba(255,84,69,0.10)" : "rgba(74,144,255,0.10)";
        ctx.fill();
      }
      run = [];
    };
    for (let i = Math.max(0, from - 1); i < Math.min(res.length, to + 1); i++) {
      const r = res[i];
      if (r?.spanA === undefined || r?.spanB === undefined) {
        flush();
        up = null;
        continue;
      }
      const nowUp = r.spanA >= r.spanB;
      const p = {
        x: xAxis.convertToPixel(i),
        a: yAxis.convertToPixel(r.spanA),
        b: yAxis.convertToPixel(r.spanB),
      };
      if (up !== null && nowUp !== up) {
        // 뒤바뀌는 자리를 앞 구간의 끝이자 다음 구간의 시작으로 씁니다
        run.push(p);
        flush();
      }
      up = nowUp;
      run.push(p);
    }
    flush();
    return false; // 선은 기본 방식대로 위에 그립니다
  },
};

/* ── 비교 종목 ──────────────────────────────────────────────────────
 *
 * 다른 종목을 **% 변화로** 지금 차트 위에 겹칩니다. 트레이딩뷰의 "비교" 와
 * 같습니다.
 *
 * 기준점은 **화면 왼쪽 끝 봉**입니다. 거기서 두 종목이 같은 자리에서
 * 출발하게 맞춰 그리므로, 화면을 끌어 옮기면 출발점도 따라 바뀝니다 —
 * "이 구간에서 누가 더 갔나" 를 보는 도구라 그게 맞습니다.
 *
 * 계산은 시각으로 맞춘 상대 종가만 들고 있고, 실제 위치는 그릴 때 정합니다.
 * 그래야 화면을 옮길 때마다 다시 계산할 필요가 없습니다.
 *
 * 같은 판에 같은 이름의 지표를 둘 붙일 수 없어서 칸을 셋 만들어 둡니다.
 */
export type CompareExtend = {
  ticker: string;
  color: string;
  /** 시각(ms) → 그 종목 종가 */
  closes: Record<number, number>;
  /**
   * 화면 왼쪽 끝 봉 번호. 여기서 두 종목이 같은 자리에서 출발합니다.
   * 화면을 옮기면 차트 감싸개(kline.tsx)가 이 값을 바꿔 다시 계산하게 합니다.
   */
  from?: number;
};

type Cmp = { other?: number; cmp?: number };

function compareTemplate(slot: number): IndicatorTemplate<Cmp, number, CompareExtend> {
  return {
    name: `CMP${slot}`,
    shortName: "비교",
    series: "price",
    precision: 2,
    calcParams: [],
    /*
     * 선을 **지표 값(figure)으로** 둡니다. 처음에는 직접 칠했는데 그러면 가격
     * 눈금이 이 선을 몰라서, 많이 오른 종목을 겹치면 선이 차트 위로 넘어가
     * 잘렸습니다(NVDA 에 AMD +78% 를 겹쳤을 때). 지표 값이면 눈금이 알아서
     * 넓어집니다.
     */
    figures: [
      {
        key: "cmp",
        title: "",
        type: "line",
        styles: ({ indicator }) => ({
          color: (indicator.extendData as CompareExtend | undefined)?.color ?? "#cccccc",
          size: 1.5,
          style: "solid",
        }),
      },
    ],
    calc: (list: KLineData[], ind) => {
      const ext = ind.extendData;
      const closes = ext?.closes ?? {};
      const other = list.map((k) => closes[k.timestamp]);
      // 출발점: 화면 왼쪽 끝에서 두 종목 값이 모두 있는 첫 봉
      const from = Math.max(0, Math.min(ext?.from ?? 0, list.length - 1));
      let start = -1;
      for (let i = from; i < list.length; i++) {
        if (typeof other[i] === "number") {
          start = i;
          break;
        }
      }
      const base = start >= 0 ? (other[start] as number) : NaN;
      const anchor = start >= 0 ? list[start].close : NaN;
      return list.map((_, i) => {
        const v = other[i];
        if (typeof v !== "number") return {};
        return Number.isFinite(base) ? { other: v, cmp: anchor * (v / base) } : { other: v };
      });
    },
    /*
     * 지표 이름 줄에 "AMD +12.3%" 처럼 **화면 왼쪽 끝 대비** 얼마나 갔는지
     * 보여 줍니다. 차트 종목과 나란히 견주는 것이 이 도구의 목적이라서요.
     */
    createTooltipDataSource: ({ chart, indicator, crosshair }) => {
      // 이 자리에서는 타입이 넓게(unknown) 잡혀 와서 좁혀 씁니다
      const ext = indicator.extendData as CompareExtend | undefined;
      const res = indicator.result as Cmp[];
      const { from } = chart.getVisibleRange();
      const base = firstValue(res, from);
      const at = crosshair.dataIndex ?? res.length - 1;
      const cur = res[at]?.other;
      const pct =
        base && typeof cur === "number" ? `${cur >= base ? "+" : ""}${(((cur - base) / base) * 100).toFixed(2)}%` : "—";
      return {
        name: ext?.ticker ?? "",
        calcParamsText: "",
        features: [],
        legends: [{ title: { text: "", color: ext?.color ?? "#ccc" }, value: { text: pct, color: ext?.color ?? "#ccc" } }],
      };
    },
  };
}

function firstValue(res: Cmp[], from: number): number | undefined {
  for (let i = Math.max(0, from); i < res.length; i++) {
    if (typeof res[i]?.other === "number") return res[i].other;
  }
  return undefined;
}

export const COMPARE_SLOTS = ["CMP1", "CMP2", "CMP3"] as const;

export const CUSTOM_INDICATORS = [
  vwap,
  atr,
  ichimoku,
  compareTemplate(1),
  compareTemplate(2),
  compareTemplate(3),
] as IndicatorTemplate[];
