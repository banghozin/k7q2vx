import { SBH } from "@/lib/sbhnews";
import type { Archived } from "@/lib/news-archive";

// 시간대는 고정하되 한국 시각으로 — 미국 매체 기사는 표준시로 두면 하루 밀립니다
const fmt = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

function day(d: string): string {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "" : fmt.format(t);
}

/**
 * 보관해 둔 기사 목록 — 좁은 자리에 끼워 넣는 용도.
 *
 * 테마 페이지 아래쪽의 큰 목록(`NewsList`)과 달리 요약 없이 제목만 보여줍니다.
 * 아카이브에는 요약을 저장하지 않기 때문이고, 차트 모달이나 층 머리처럼
 * 자리가 좁은 곳에 들어가기 때문이기도 합니다.
 *
 * CC BY 4.0 조건에 따라 출처와 라이선스를 함께 표시합니다.
 */
export function ArchivedNews({
  items,
  emptyText = "보관된 기사가 없습니다.",
  showSource = true,
}: {
  items: Archived[];
  emptyText?: string;
  showSource?: boolean;
}) {
  if (items.length === 0) {
    return <p className="arcnews__empty">{emptyText}</p>;
  }

  // CC BY 4.0 표기는 SBHNews 기사가 실제로 있을 때만 답니다
  const hasSbh = items.some((a) => a.source === "sbh");

  return (
    <>
      <ul className="arcnews">
        {items.map((a) => (
          <li key={a.link}>
            <a href={a.link} target="_blank" rel="noreferrer">
              <span className="arcnews__day mono">{day(a.date)}</span>
              <span className="arcnews__title">{a.title}</span>
              <span className="arcnews__from">{a.sourceLabel}</span>
            </a>
          </li>
        ))}
      </ul>
      {showSource && (
        <p className="arcnews__src">
          {hasSbh
            ? `출처 ${SBH.source} 외 미국 금융 매체`
            : "출처는 각 기사 옆에 적었습니다"}
          {hasSbh && (
            <>
              {" ·"}{" "}
              <a href={SBH.licenseUrl} target="_blank" rel="noreferrer">
                {SBH.license}
              </a>
            </>
          )}{" "}
          · 제목과 원문 링크만 보관했고 본문은 고치지 않았습니다
        </p>
      )}
    </>
  );
}
