import type { Metadata } from "next";
import Link from "next/link";
import { getTheme } from "@/data/themes";
import {
  archiveUpdatedAt,
  hasArchive,
  newsByDay,
} from "@/lib/news-archive";
import { SBH } from "@/lib/sbhnews";

export const metadata: Metadata = {
  title: "뉴스 보관함",
  description:
    "미국 시장·종목과 관련된 기사를 날짜별로 모아 둔 곳. 공개 피드는 몇 시간치만 주므로 지나가면 되찾을 수 없어 쌓아 둡니다.",
};

/** 하루 한 번 갱신되므로 화면도 그 주기로 다시 만듭니다 */
export const revalidate = 21600;

const fmt = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  timeZone: "UTC",
});

const time = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export default function NewsPage() {
  const days = newsByDay();

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
            <span>마지막 수집 {archiveUpdatedAt.slice(0, 16).replace("T", " ")}</span>
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

      {days.map(({ day, items }) => (
        <section className="section newsday" key={day}>
          <h2 className="newsday__date mono">
            {fmt.format(new Date(`${day}T00:00:00Z`))}
            <span className="newsday__n">{items.length}건</span>
          </h2>
          <ul className="newsday__list">
            {items.map((a) => (
              <li key={a.link} className="newsday__item">
                <span className="newsday__time mono">
                  {time.format(new Date(a.date))}
                </span>
                <div className="newsday__body">
                  <a href={a.link} target="_blank" rel="noreferrer">
                    {a.title}
                  </a>
                  <div className="newsday__tags">
                    <span className="tag tag--from">{a.sourceLabel}</span>
                    {a.tickers.length > 0 ? (
                      a.tickers.map((t) => (
                        <Link key={t} href={`/analyze?ticker=${t}`} className="tag">
                          {t}
                        </Link>
                      ))
                    ) : (
                      <span className="tag">시장</span>
                    )}
                    {a.themes.map((s) => (
                      <Link key={s} href={`/theme/${s}`} className="tag">
                        {getTheme(s)?.name ?? s}
                      </Link>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="section" style={{ borderBottom: "none" }}>
        <p className="caution">
          출처는 기사마다 옆에 적었습니다. <strong>제목과 원문 링크만</strong>{" "}
          보관하며 본문은 가져오지도 고치지도 않습니다. 읽기는 각 매체의 원문
          페이지에서 하시게 됩니다. {SBH.source} 기사는{" "}
          <a href={SBH.licenseUrl} target="_blank" rel="noreferrer">
            {SBH.license}
          </a>{" "}
          조건으로 씁니다. 미국 매체 기사는 각 매체가 공개한 RSS에서 제목과
          링크만 받아 날짜별로 묶는 가공만 했습니다. 기사에 담긴 제3자 권리
          자료는 이용 범위에서 제외됩니다. 기사와 종목 배치 사이에 인과관계를
          주장하지 않습니다.
        </p>
      </section>
    </div>
  );
}
