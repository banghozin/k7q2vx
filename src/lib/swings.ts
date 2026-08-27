/**
 * 주요 고점·저점(스윙) 찾기.
 *
 * 눈으로 차트를 보면 "여기가 고점, 여기가 저점" 이 대충 보입니다. 그걸 규칙
 * 하나로 바꾼 것이 이 파일입니다. 규칙은 한 줄로 말할 수 있습니다 —
 * **되돌림이 정해진 폭을 넘으면 그 전 극단값을 고점(또는 저점)으로 인정한다.**
 *
 * 되돌림 폭(`threshold`)을 크게 잡으면 큰 파동만, 작게 잡으면 잔파동까지
 * 잡힙니다. 봉 단위에 따라 알맞은 값이 다릅니다 — 5분봉의 3% 와 월봉의 3% 는
 * 전혀 다른 이야기입니다. 그래서 화면에서 고를 수 있게 두었습니다.
 *
 * **여기 있는 것은 판단이 아니라 눈금입니다.** "이 자리에서 사라" 같은 말은
 * 나오지 않습니다. 어디가 고점이고 저점이었는지 세어 줄 뿐이고, 그 위에
 * 무슨 선을 긋고 어떻게 읽을지는 사람이 합니다.
 */

export type SwingBar = {
  time: number;
  high: number;
  low: number;
  close: number;
};

export type Swing = {
  /**
   * 몇 번째 봉인가.
   *
   * ⚠️ 값이 성치 않은 봉(NaN·0·음수)을 걸러낸 **뒤의** 번호입니다. 원본
   * 배열의 번호와 다를 수 있으니 위치를 되짚을 때는 `time` 을 쓰세요.
   */
  index: number;
  /** 봉의 시각 (초 단위) */
  time: number;
  price: number;
  type: "high" | "low";
  /**
   * 아직 확정되지 않은 마지막 극단값인가.
   *
   * 마지막 고점은 "여기서 얼마나 되돌렸는가" 를 아직 다 보지 못했으므로
   * 나중에 더 높은 자리로 옮겨갈 수 있습니다. 숨기지 않고 표시합니다.
   */
  tentative?: boolean;
};

/**
 * 되돌림 폭 기준으로 고점·저점을 골라냅니다.
 *
 * @param threshold 0.05 이면 5% 되돌릴 때 방향이 바뀐 것으로 봅니다
 */
export function detectSwings(input: SwingBar[], threshold = 0.05): Swing[] {
  /*
   * 값이 성한 봉만 씁니다. **NaN 이 하나만 섞여도 검출이 통째로 멈춥니다** —
   * NaN 과의 비교는 전부 거짓이라 방향이 영영 정해지지 않기 때문입니다.
   * 0이나 음수가 섞이면 그 자리로 선이 그어져 차트 눈금이 무너집니다.
   */
  const bars = input.filter(
    (b) =>
      Number.isFinite(b.high) &&
      Number.isFinite(b.low) &&
      b.low > 0 &&
      b.high >= b.low,
  );
  if (bars.length < 3 || threshold <= 0) return [];

  const out: Swing[] = [];

  let dir: "up" | "down" | null = null;
  let hiIdx = 0;
  let hiPrice = bars[0].high;
  let loIdx = 0;
  let loPrice = bars[0].low;

  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];

    if (dir === null) {
      // 아직 어느 쪽으로 가는지 모르는 구간. 먼저 임계를 넘는 쪽으로 정합니다.
      if (b.high > hiPrice) {
        hiPrice = b.high;
        hiIdx = i;
      }
      if (b.low < loPrice) {
        loPrice = b.low;
        loIdx = i;
      }
      if (loPrice > 0 && b.high >= loPrice * (1 + threshold)) {
        out.push({ index: loIdx, time: bars[loIdx].time, price: loPrice, type: "low" });
        dir = "up";
        hiPrice = b.high;
        hiIdx = i;
      } else if (hiPrice > 0 && b.low <= hiPrice * (1 - threshold)) {
        out.push({ index: hiIdx, time: bars[hiIdx].time, price: hiPrice, type: "high" });
        dir = "down";
        loPrice = b.low;
        loIdx = i;
      }
      continue;
    }

    if (dir === "up") {
      if (b.high > hiPrice) {
        hiPrice = b.high;
        hiIdx = i;
      } else if (hiPrice > 0 && b.low <= hiPrice * (1 - threshold)) {
        // 고점에서 정해진 만큼 되돌렸다 → 그 고점을 확정하고 방향을 바꿉니다
        out.push({ index: hiIdx, time: bars[hiIdx].time, price: hiPrice, type: "high" });
        dir = "down";
        loPrice = b.low;
        loIdx = i;
      }
    } else {
      if (b.low < loPrice) {
        loPrice = b.low;
        loIdx = i;
      } else if (loPrice > 0 && b.high >= loPrice * (1 + threshold)) {
        out.push({ index: loIdx, time: bars[loIdx].time, price: loPrice, type: "low" });
        dir = "up";
        hiPrice = b.high;
        hiIdx = i;
      }
    }
  }

  // 아직 확정되지 않은 마지막 극단값도 넣어 줍니다 — 지금 파동의 끝자리입니다
  if (dir === "up") {
    out.push({
      index: hiIdx,
      time: bars[hiIdx].time,
      price: hiPrice,
      type: "high",
      tentative: true,
    });
  } else if (dir === "down") {
    out.push({
      index: loIdx,
      time: bars[loIdx].time,
      price: loPrice,
      type: "low",
      tentative: true,
    });
  }

  return out;
}

/**
 * 이 종목·이 봉 단위에 알맞은 되돌림 폭을 스스로 정합니다.
 *
 * 고정값을 쓰면 안 됩니다. 일봉 6% 는 엔비디아에는 알맞지만(2년에 93개)
 * 이튼 같은 잔잔한 종목에는 거의 안 잡힙니다. 5분봉과 월봉의 차이는 더
 * 큽니다. 봉 단위마다 표를 만들어 두는 방법도 써 봤지만, 같은 일봉이라도
 * 종목마다 변동폭이 몇 배씩 차이 나서 소용이 없었습니다.
 *
 * 그래서 **그 종목이 실제로 하루에 얼마나 움직이는지** 를 재서 그 몇 배로
 * 잡습니다. 중앙값을 쓰는 이유는 실적 발표일 같은 하루가 평균을 통째로
 * 끌어올리기 때문입니다.
 */
export function suggestThreshold(
  bars: { close: number }[],
  multiple = 3.2,
): number {
  /*
   * 척도로 **봉과 봉 사이 종가 변동**을 씁니다. 봉 하나의 고저폭도 재 봤는데
   * 그건 봉 안의 잔떨림까지 담아서 값이 부풀고, 특히 월봉에서는 중앙값이
   * 22% 까지 올라가 어떤 배수를 곱해도 상한에 붙어 버렸습니다.
   * 실측(2026-08-27):
   *   NVDA 일봉  고저폭 2.89% / 종가변동 1.64%
   *   NVDA 월봉  고저폭 22.6% / 종가변동 9.99%
   */
  const moves: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const p = bars[i - 1].close;
    const c = bars[i].close;
    if (!(p > 0) || !Number.isFinite(c)) continue;
    moves.push(Math.abs(c / p - 1));
  }
  if (moves.length < 20) return 0.05;
  moves.sort((a, b) => a - b);
  const median = moves[moves.length >> 1];
  // 너무 촘촘하거나 너무 성기면 화면이 쓸모없어지므로 범위를 둡니다
  return Math.min(0.5, Math.max(0.003, median * multiple));
}

/** 민감도 — 화면에서 세 단계로 고릅니다 */
export const SENSITIVITY = [
  { key: "fine", label: "촘촘히", multiple: 4 },
  { key: "mid", label: "보통", multiple: 7 },
  { key: "coarse", label: "크게", multiple: 12 },
] as const;

/**
 * 마지막 파동 하나 — 자동 피보나치를 그을 두 점.
 *
 * 방향이 바뀌지 않은 마지막 두 점을 씁니다. 상승 파동이면 저점 → 고점,
 * 하락 파동이면 고점 → 저점 순서로 돌려줍니다. 피보나치는 이 순서대로
 * 두 점을 찍으면 됩니다.
 */
export function lastLeg(swings: Swing[]): [Swing, Swing] | null {
  if (swings.length < 2) return null;
  const b = swings[swings.length - 1];
  const a = swings[swings.length - 2];
  if (a.type === b.type) return null;
  return [a, b];
}
