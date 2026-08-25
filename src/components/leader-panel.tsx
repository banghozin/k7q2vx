import type { ThemeLeaders } from "@/lib/market-data";
import { placementsOf } from "@/data/themes";

/**
 * 대장주 판별 근거를 분해해 보여줍니다.
 *
 * 점수 하나만 던져놓고 "이게 대장입니다" 하면 그건 블랙박스이고, 우리가
 * 까려던 "이유 같지도 않은 이유"와 다를 게 없습니다. 그래서 네 가지 재료를
 * 그대로 펼쳐 놓습니다. 사용자가 납득하지 못하면 그 판별은 실패한 것입니다.
 */
export function LeaderPanel({
  themeSlug,
  leaders,
}: {
  themeSlug: string;
  leaders: ThemeLeaders;
}) {
  const pure = leaders.ranked.filter((r) => !r.peripheral).slice(0, 5);
  if (pure.length === 0) return null;

  const nameOf = (t: string) => placementsOf(t)[0]?.stock.name ?? t;
  const layerOf = (t: string) => {
    const p = placementsOf(t).find((x) => x.themeSlug === themeSlug);
    return p ? `${p.layerN}F ${p.layerName}` : "";
  };

  return (
    <>
      {leaders.close && (
        <div className="caution" style={{ marginBottom: "1rem" }}>
          <span className="caution__label">접전</span>
          <span>
            1위와 2위의 점수 차가 거의 없습니다. 지금은 <strong>한 종목을
            대장이라고 부르기 어려운 상태</strong>입니다. 아래 순위를 그대로
            읽으시는 편이 낫습니다.
          </span>
        </div>
      )}

      {leaders.handover && (
        <div className="caution" style={{ marginBottom: "1rem" }}>
          <span className="caution__label">손바뀜</span>
          <span>
            약 {leaders.handover.agoDays}거래일 전 기준으로는{" "}
            <strong className="mono">{leaders.handover.from}</strong>가 앞섰는데,
            지금은 <strong className="mono">{leaders.handover.to}</strong>가
            앞서 있습니다. 순위가 바뀌었다는 사실만 적은 것이며, 어느 쪽을
            사라는 뜻이 아닙니다.
          </span>
        </div>
      )}

      <div className="tablewrap">
        <table className="leadertable">
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">종목</th>
              <th scope="col">층</th>
              <th scope="col" title="이 종목이 테마 고유로 크게 오른 30일에, 나머지도 같이 오른 비율에서 평상시 비율을 뺀 값">
                주도력
              </th>
              <th scope="col" title="먼저 움직인 정도에서 따라간 정도를 뺀 값. 양수면 앞서 움직였다는 뜻">
                선행성
              </th>
              <th scope="col" title="60일 수익률에서 테마 중앙값을 뺀 값">
                상대강도
              </th>
              <th scope="col" title="20일 평균 거래대금 ÷ 60일 평균 거래대금. 1보다 크면 최근 자금이 몰린 것">
                자금유입
              </th>
            </tr>
          </thead>
          <tbody>
            {pure.map((r, i) => (
              <tr key={r.ticker}>
                <td data-label="순위" className="mono">
                  {i + 1}
                </td>
                <td data-label="종목">
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {r.ticker}
                  </span>
                  <span className="synctable__name">{nameOf(r.ticker)}</span>
                </td>
                <td data-label="층" className="synctable__name">
                  {layerOf(r.ticker)}
                </td>
                <td data-label="주도력" className="mono">
                  {r.pull != null ? `+${r.pull.toFixed(0)}%p` : "—"}
                </td>
                <td data-label="선행성" className="mono">
                  {r.lead != null ? r.lead.toFixed(3) : "—"}
                </td>
                <td data-label="상대강도" className="mono">
                  {r.rs != null
                    ? `${r.rs > 0 ? "+" : ""}${r.rs.toFixed(1)}%p`
                    : "—"}
                </td>
                <td data-label="자금유입" className="mono">
                  {r.flow != null ? `${r.flow.toFixed(2)}배` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="syncnote">
        <strong>어떻게 뽑았나.</strong> 네 가지를 테마 안 순위로 환산해
        주도력 45% · 선행성 25% · 상대강도 15% · 자금유입 15% 로 합산했습니다.
        시장 전체 흐름(S&amp;P500)의 영향은 걷어낸 뒤 계산합니다 — 그러지 않으면
        시장이 오르는 날에만 오르는 종목이 &ldquo;끌고 간다&rdquo;고 잘못 집계됩니다.
        회사 매출에서 이 테마가 차지하는 비중이 작은 종목(예: 양자컴퓨팅에서의
        대형 IT)은 대장 후보에서 뺐습니다.{" "}
        <strong>이 순위는 과거 기록의 요약이며 매매 판단이 아닙니다.</strong>
      </p>
    </>
  );
}
