import type { ThemeRotation } from "@/lib/market-data";
import { josa, pct, tone } from "@/lib/format";

/**
 * 층 순위 변화 그림 (지난 반년).
 *
 * 이 사이트가 하겠다고 한 것은 "돈이 어느 층에서 어느 층으로 옮겨갔는가"인데,
 * 지금까지 화면은 오늘 한 시점만 보여줬습니다. 여기서는 5거래일 간격으로
 * 되짚은 순위를 선으로 이어, 어느 층이 어느 층을 앞질렀는지를 보여줍니다.
 *
 * 색을 여덟 갈래로 쓰지 않는 이유
 * ------------------------------
 * 층이 8개라고 색을 8개 쓰면 화면이 무지개가 되고, 색각 이상이 있는 분은
 * 구분하지 못합니다. 그래서 **색은 한 가지 일만** 합니다 — 반년 동안 가장
 * 많이 올라선 층(빨강)과 가장 많이 내려앉은 층(파랑) 둘만 칠하고 나머지는
 * 회색입니다. 어느 선이 어느 층인지는 색이 아니라 **선 끝에 붙은 이름**으로
 * 알 수 있습니다. 색만으로 정보를 전달하지 않습니다.
 *
 * 세 색(#ff5445 / #4a90ff / #7d8590)은 배경색 대비·색각 이상 구분·정상시야
 * 구분 검사를 통과한 조합입니다.
 */

const W = 760;
const H = 300;

/*
 * 오른쪽 여백은 이름표가 들어갈 자리입니다. 가장 긴 층 이름이
 * "클라우드·모델·소프트웨어"(한글 13자)이고 앞에 "08F "가 붙습니다.
 * 한글은 글자 하나가 글꼴 크기만큼 폭을 먹으므로 12px × 13자 ≈ 156px,
 * 여기에 층 번호와 여백을 더해 210px 을 잡습니다. 처음에 168px 로 뒀다가
 * 긴 이름이 잘리는 것을 렌더링해 보고 잡았습니다.
 */
const PAD = { top: 18, right: 210, bottom: 30, left: 34 };

export function RotationChart({
  rotation,
}: {
  rotation: ThemeRotation;
}) {
  const { dates, layers, riser, faller } = rotation;
  if (!dates?.length || !layers?.length) return null;

  const maxRank = layers.length;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (i: number) =>
    dates.length === 1
      ? PAD.left
      : PAD.left + (i * innerW) / (dates.length - 1);
  const y = (rank: number) =>
    maxRank === 1
      ? PAD.top
      : PAD.top + ((rank - 1) * innerH) / (maxRank - 1);

  /** null 구간에서 선을 끊습니다 — 없는 데이터를 이어 붙이지 않습니다 */
  const pathOf = (ranks: (number | null)[]) => {
    let d = "";
    let pen = false;
    ranks.forEach((r, i) => {
      if (r == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(r).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  const lastRank = (ranks: (number | null)[]) => {
    for (let i = ranks.length - 1; i >= 0; i--) if (ranks[i] != null) return ranks[i] as number;
    return null;
  };
  const firstRank = (ranks: (number | null)[]) => {
    for (let i = 0; i < ranks.length; i++) if (ranks[i] != null) return ranks[i] as number;
    return null;
  };

  const kindOf = (key: string) =>
    key === riser ? "riser" : key === faller ? "faller" : "plain";

  // 강조하는 선을 마지막에 그려 회색 선 위로 올립니다
  const drawOrder = [...layers].sort((a, b) => {
    const w = (k: string) => (k === "plain" ? 0 : 1);
    return w(kindOf(a.key)) - w(kindOf(b.key));
  });

  const riserRow = layers.find((l) => l.key === riser);
  const fallerRow = layers.find((l) => l.key === faller);

  const shortDate = (d: string) => `${Number(d.slice(5, 7))}월`;

  return (
    <figure className="rot">
      {riserRow && fallerRow && (
        <figcaption className="rot__cap">
          지난 반년 동안{" "}
          <b className="up">
            {riserRow.n}층 {riserRow.name}
          </b>
          {josa(riserRow.name, "이/가")} 올라섰고,{" "}
          <b className="down">
            {fallerRow.n}층 {fallerRow.name}
          </b>
          {josa(fallerRow.name, "이/가")} 내려앉았습니다. 선이 교차하는 지점이
          순위가 뒤바뀐 때입니다.
        </figcaption>
      )}

      <div className="rot__scroll">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="rot__svg"
          role="img"
          aria-label="층별 순위가 지난 반년 동안 어떻게 바뀌었는지 보여주는 선 그래프. 같은 내용을 아래 표로도 볼 수 있습니다."
        >
          {/* 순위 눈금 — 뒤로 물러나 있어야 선이 읽힙니다 */}
          {Array.from({ length: maxRank }, (_, k) => k + 1).map((r) => (
            <g key={r}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(r)}
                y2={y(r)}
                stroke="var(--rule-soft)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.left - 10}
                y={y(r) + 4}
                textAnchor="end"
                className="rot__rank"
              >
                {r}
              </text>
            </g>
          ))}

          {/* 시간축 — 월이 바뀌는 지점만 */}
          {dates.map((d, i) => {
            const prev = i > 0 ? dates[i - 1] : null;
            if (prev && prev.slice(5, 7) === d.slice(5, 7)) return null;
            return (
              <text
                key={d}
                x={x(i)}
                y={H - 10}
                textAnchor="middle"
                className="rot__date"
              >
                {shortDate(d)}
              </text>
            );
          })}

          {drawOrder.map((l) => {
            const kind = kindOf(l.key);
            return (
              <path
                key={l.key}
                d={pathOf(l.ranks)}
                fill="none"
                className={`rot__line is-${kind}`}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* 선 끝 이름표 — 어느 선이 어느 층인지 색이 아니라 글자로 알립니다 */}
          {layers.map((l) => {
            const r = lastRank(l.ranks);
            if (r == null) return null;
            const kind = kindOf(l.key);
            return (
              <text
                key={l.key}
                x={W - PAD.right + 10}
                y={y(r) + 4}
                className={`rot__label is-${kind}`}
              >
                {String(l.n).padStart(2, "0")}F {l.name}
              </text>
            );
          })}
        </svg>
      </div>

      <details className="rot__table">
        <summary>표로 보기</summary>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th scope="col">층</th>
                <th scope="col">반년 전 순위</th>
                <th scope="col">지금 순위</th>
                <th scope="col">변화</th>
                <th scope="col">지금 20일 성과</th>
              </tr>
            </thead>
            <tbody>
              {[...layers]
                .sort(
                  (a, b) => (lastRank(a.ranks) ?? 99) - (lastRank(b.ranks) ?? 99),
                )
                .map((l) => {
                  const f = firstRank(l.ranks);
                  const t = lastRank(l.ranks);
                  const delta = f != null && t != null ? f - t : null;
                  const ret = [...l.rets].reverse().find((v) => v != null) ?? null;
                  return (
                    <tr key={l.key}>
                      <td data-label="층">
                        {l.n}층 {l.name}
                      </td>
                      <td data-label="반년 전 순위" className="mono">
                        {f ?? "—"}
                      </td>
                      <td data-label="지금 순위" className="mono">
                        {t ?? "—"}
                      </td>
                      <td
                        data-label="변화"
                        className={`mono ${delta == null || delta === 0 ? "" : delta > 0 ? "up" : "down"}`}
                      >
                        {delta == null
                          ? "—"
                          : delta === 0
                            ? "그대로"
                            : delta > 0
                              ? `${delta}계단 위로`
                              : `${Math.abs(delta)}계단 아래로`}
                      </td>
                      <td data-label="지금 20일 성과" className={`mono ${tone(ret)}`}>
                        {pct(ret)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </details>

      <p className="rot__note">
        각 시점에서 층에 속한 종목들의 <strong>20일 성과 중앙값</strong>으로 층을
        줄 세운 순위입니다. 수익률이 아니라 순위를 쓰는 이유는, 시장 전체가 빠진
        구간에는 모든 층이 같이 내려가 비교가 되지 않기 때문입니다.{" "}
        <strong>지나간 기록이며 앞날에 대한 말이 아닙니다.</strong>
      </p>
    </figure>
  );
}
