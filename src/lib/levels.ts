import type { SavedDrawing } from "@/components/practice/kline";

/**
 * 그어 둔 수평선이 실제로 닿았는지 되짚는 계산.
 *
 * 왜 수평선만인가
 * ----------------
 * 차트에 긋는 선은 여러 종류지만, **"이 자리"** 를 뜻하는 것은 수평선입니다.
 * 추세선은 모양을 보는 것이고 파동은 흐름을 세는 것이라, 거기에 전부 알림을
 * 걸면 켜 둔 적도 없는 알림이 화면을 덮습니다. 수평선은 애초에 지지·저항
 * 자리를 표시하려고 긋는 것이므로 **따로 켜고 끌 필요가 없습니다.**
 *
 * 하루 단위입니다
 * ----------------
 * 이 사이트는 하루 1회 갱신이 의도된 선택입니다. 여기서도 마찬가지로
 * **일봉의 고가·저가**와 견줍니다. "지금 막 닿았다" 가 아니라 "어제 닿았다"
 * 를 알리는 것입니다. 실시간 알림이 아니고, 그렇게 보이게 쓰지도 않습니다.
 *
 * 이것은 **지나간 종가와 견준 사실**이지 앞날에 대한 말이 아닙니다.
 */

export type Candle = {
  time: number;
  high: number;
  low: number;
  close: number;
};

/** 자리를 뜻하는 그림. klinecharts 의 도구 이름입니다 */
const LEVEL_TOOLS = new Set(["horizontalStraightLine", "priceLine"]);

/** 되짚어 볼 거래일 수 — 석 달치를 받아 이 범위만 봅니다 */
export const LOOKBACK = 30;

/** 며칠 안에 닿은 것을 "최근" 으로 볼지 */
export const RECENT = 5;

export type WatchLevel = {
  ticker: string;
  value: number;
  /** 마지막 종가 */
  last: number;
  /** 마지막으로 닿은 거래일(YYYY-MM-DD). 되짚은 범위 안에 없으면 null */
  touchedAt: string | null;
  /** 그 날이 몇 거래일 전인지. 0 이면 마지막 거래일 */
  barsAgo: number | null;
  /** 지금 종가에서 선까지 몇 % 인지. 양수면 선이 위에 있습니다 */
  awayPct: number;
};

/** 한 벌에 그어 둔 수평선들의 가격을 뽑습니다 */
export function levelsOf(drawings: SavedDrawing[]): number[] {
  const out: number[] = [];
  for (const d of drawings) {
    if (!LEVEL_TOOLS.has(d.name)) continue;
    const v = d.points?.[0]?.value;
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    out.push(v);
  }
  /*
   * 같은 자리에 두 번 그어 둔 것은 한 줄로 봅니다. 소수점 끝자리만 다른
   * 것도 사람 눈에는 같은 선이라 0.01% 안이면 하나로 칩니다.
   */
  const uniq: number[] = [];
  for (const v of out.sort((a, b) => a - b)) {
    const prev = uniq[uniq.length - 1];
    if (prev != null && Math.abs(v - prev) / prev < 0.0001) continue;
    uniq.push(v);
  }
  return uniq;
}

/**
 * 일봉 하나가 그 자리를 지나갔는지.
 *
 * 종가만 보면 장중에 찍고 되돌아온 것을 놓칩니다. 고가·저가 사이에 들어오면
 * 닿은 것으로 봅니다.
 */
function touched(c: Candle, value: number): boolean {
  return c.low <= value && value <= c.high;
}

/**
 * 일봉의 거래일.
 *
 * 야후의 일봉 시각은 그날 미국장이 열린 때(표준시로 13:30 또는 14:30)라
 * **표준시 날짜가 곧 거래일**입니다. 여기에 아홉 시간을 더하면(`kstDay`)
 * 오히려 하루가 밀립니다 — 거래일에는 쓰지 말라고 적어 둔 이유입니다.
 */
export function barDay(sec: number): string {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}

/** 그어 둔 자리들을 일봉과 견줍니다 */
export function checkLevels(
  ticker: string,
  values: number[],
  candles: Candle[],
): WatchLevel[] {
  const last = candles[candles.length - 1];
  if (!last || !Number.isFinite(last.close) || last.close <= 0) return [];

  const window = candles.slice(-LOOKBACK);

  return values.map((value) => {
    let touchedAt: string | null = null;
    let barsAgo: number | null = null;

    for (let i = window.length - 1; i >= 0; i--) {
      if (!touched(window[i], value)) continue;
      touchedAt = barDay(window[i].time);
      barsAgo = window.length - 1 - i;
      break;
    }

    return {
      ticker,
      value,
      last: last.close,
      touchedAt,
      barsAgo,
      awayPct: ((value - last.close) / last.close) * 100,
    };
  });
}

/**
 * 눈에 걸려야 하는 것부터.
 *
 * ① 최근에 닿은 것 → ② 가까운 것. 닿은 것끼리는 최근일수록 위로 오고,
 * 안 닿은 것끼리는 지금 값에서 가까울수록 위로 옵니다.
 */
export function sortLevels(rows: WatchLevel[]): WatchLevel[] {
  return rows.slice().sort((a, b) => {
    const ar = a.barsAgo != null && a.barsAgo < RECENT;
    const br = b.barsAgo != null && b.barsAgo < RECENT;
    if (ar !== br) return ar ? -1 : 1;
    if (ar && br) return (a.barsAgo ?? 0) - (b.barsAgo ?? 0);
    return Math.abs(a.awayPct) - Math.abs(b.awayPct);
  });
}
