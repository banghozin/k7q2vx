import type { Metadata } from "next";
import { NewsCaution, NewsDays, NewsMonthNav } from "@/components/news-days";
import {
  archiveUpdatedAt,
  hasArchive,
  newsByDay,
  newsMonths,
} from "@/lib/news-archive";

export const metadata: Metadata = {
  title: "뉴스 보관함",
  description:
    "미국 시장·종목과 관련된 기사를 날짜별로 모아 둔 곳. 공개 피드는 몇 시간치만 주므로 지나가면 되찾을 수 없어 쌓아 둡니다.",
};

/** 하루 한 번 갱신되므로 화면도 그 주기로 다시 만듭니다 */
export const revalidate = 21600;

/** "마지막 수집" 도장 — 여기도 원본 ISO 를 그대로 자르면 표준시가 새어 나옵니다 */
const stamp = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

/**
 * 첫 장에는 최근 일주일만 그립니다. 한 장에 다 그리면 2026-11 기준
 * 3,882건·HTML 6.5MB 로 휴대폰이 버거웠습니다. 그 전은 달별 장으로.
 */
const RECENT_DAYS = 7;

export default function NewsPage() {
  const days = newsByDay();
  const recent = days.slice(0, RECENT_DAYS);
  const older = days.length - recent.length;

  return (
    <div className="wrap">
      <header className="dochead">
        <h1 className="dochead__title">뉴스 보관함</h1>
        <p className="dochead__tagline">
          미국 시장이나 여기서 다루는 종목이 나온 기사만 날짜별로
        </p>
        <p className="dochead__question">
          공개 피드는 최근 몇십 건씩만 줍니다. 지나가면 되찾을 수 없어서
          여섯 시간마다 모아 둡니다. <strong>미국 금융 매체</strong>의 기사는
          제목을 번역하지 않고 원문 그대로 둡니다.
        </p>
        <div className="docmeta">
          <span>{days.length}일치</span>
          <span>
            {days.reduce((a, d) => a + d.items.length, 0)}건
          </span>
          {archiveUpdatedAt && (
            <span>마지막 수집 {stamp.format(new Date(archiveUpdatedAt))}</span>
          )}
          <span>국내 기업 소식 제외</span>
        </div>
      </header>

      {!hasArchive && (
        <section className="section">
          <p className="section__sub">
            아직 모아 둔 기사가 없습니다. 여섯 시간마다 쌓입니다.
          </p>
        </section>
      )}

      <NewsDays days={recent} />

      {older > 0 && (
        <section className="section">
          <p className="section__sub" style={{ marginBottom: 0 }}>
            여기까지 최근 {RECENT_DAYS}일치입니다. 그 전 {older}일치는 아래 달별 보관함에 있습니다.
          </p>
        </section>
      )}

      <NewsMonthNav months={newsMonths()} />

      <NewsCaution />
    </div>
  );
}
