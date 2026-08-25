"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ThemeSync } from "@/lib/market-data";
import { pct, tone } from "@/lib/format";
import { placementsOf } from "@/data/themes";
import { useChartModal } from "@/lib/store/chart-modal-store";

/**
 * 동조율 표 — 이 사이트의 정체성.
 *
 * 대장주가 크게 오른 날만 뽑아, 그날 각 종목이 어떻게 반응했는지 셉니다.
 * 블로그의 "관련주 TOP 25"가 못 하는 일은 이겁니다:
 * **왜 연관주냐에 말이 아니라 숫자로 답하는 것.**
 *
 * 절대 하지 않는 것: 이 숫자로 앞날을 말하지 않습니다. 그래서 "과거 기록이며
 * 예측이 아님"을 표 아래 작게가 아니라 표 머리에 붙여 둡니다.
 */
export function SyncTable({
  themeSlug,
  sync,
}: {
  themeSlug: string;
  sync: ThemeSync;
}) {
  const open = useChartModal((s) => s.open);
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const withData = sync.members.filter((m) => m.events > 0);
    return showAll ? withData : withData.slice(0, 10);
  }, [sync.members, showAll]);

  const hidden = sync.members.filter((m) => m.events > 0).length - rows.length;
  const nameOf = (t: string) => placementsOf(t)[0]?.stock.name ?? t;
  const layerOf = (t: string) => {
    const p = placementsOf(t).find((x) => x.themeSlug === themeSlug);
    return p ? `${p.layerN}F` : "";
  };

  return (
    <>
      <div className="syncbar">
        <div className="syncbar__lead">
          <span className="syncbar__k">기준 종목</span>
          <button
            type="button"
            className="mono syncbar__ticker"
            onClick={() => open(sync.leader, nameOf(sync.leader))}
          >
            {sync.leader}
          </button>
          <span className="syncbar__name">{nameOf(sync.leader)}</span>
        </div>
        <div className="syncbar__facts mono">
          <span>
            하루 <b>+{sync.threshold}%</b> 이상 오른 날
          </span>
          <span>
            최근 1년 <b>{sync.events}회</b>
          </span>
          {sync.leaderAvg != null && (
            <span>
              그날 평균 <b className="up">{pct(sync.leaderAvg)}</b>
            </span>
          )}
        </div>
      </div>

      <p className="syncwarn">
        아래는 <strong>지나간 기록을 센 것</strong>입니다. 앞으로도 같이 움직인다는
        뜻이 아니고, 특정 종목의 매매를 권하는 것도 아닙니다.
      </p>

      <div className="tablewrap">
        <table className="synctable">
          <caption className="sr-only">
            {sync.leader}가 크게 오른 날 각 종목의 반응
          </caption>
          <thead>
            <tr>
              <th scope="col">종목</th>
              <th scope="col">층</th>
              <th scope="col">같이 오른 날</th>
              <th scope="col">비율</th>
              <th scope="col">그날 평균</th>
              <th scope="col">반응 배수</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.ticker}>
                <td data-label="종목">
                  <button
                    type="button"
                    className="mono linkish"
                    onClick={() => open(m.ticker, nameOf(m.ticker))}
                  >
                    {m.ticker}
                  </button>
                  <span className="synctable__name">{nameOf(m.ticker)}</span>
                </td>
                <td data-label="층" className="mono">
                  {layerOf(m.ticker)}
                </td>
                <td data-label="같이 오른 날" className="mono">
                  {m.hits}/{m.events}
                  {m.partial && (
                    <span
                      className="synctable__partial"
                      title={`상장이 늦어 ${sync.events}회 중 ${m.events}회만 겪었습니다`}
                    >
                      부분
                    </span>
                  )}
                </td>
                <td data-label="비율" className="mono">
                  {m.rate != null ? `${m.rate.toFixed(0)}%` : "—"}
                </td>
                <td data-label="그날 평균" className={`mono ${tone(m.avgReturn)}`}>
                  {pct(m.avgReturn)}
                </td>
                <td data-label="반응 배수" className="mono">
                  {m.response != null ? `${m.response.toFixed(2)}배` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden > 0 && (
        <button
          type="button"
          className="btn btn--ghost"
          style={{ marginTop: ".75rem" }}
          onClick={() => setShowAll(true)}
        >
          나머지 {hidden}종목 더 보기
        </button>
      )}

      <p className="syncnote">
        <strong>읽는 법.</strong> &ldquo;같이 오른 날&rdquo;은 기준 종목이 크게 오른 날 중
        이 종목도 오른 날 수입니다. &ldquo;반응 배수&rdquo;는 기준 종목이 오른 폭 대비 이
        종목이 오른 폭입니다. 1배보다 크면 더 크게 움직였다는 뜻입니다.{" "}
        <span className="synctable__partial">부분</span> 표시는 상장이 늦어 전체
        기간을 겪지 못한 종목입니다 — 분모가 다르므로 비율을 그대로 비교하면 안 됩니다.{" "}
        <Link href="/about">계산 방식 자세히</Link>
      </p>
    </>
  );
}
