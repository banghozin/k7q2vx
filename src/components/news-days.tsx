import Link from "next/link";
import { getTheme } from "@/data/themes";
import type { Archived } from "@/lib/news-archive";
import { SBH } from "@/lib/sbhnews";

/*
 * 시간대를 고정합니다 — 기기 시간대를 따라가면 서버가 그린 것과 어긋납니다.
 * 고정값은 **한국 시각**입니다. 보는 사람이 한국에 있고, 미국 매체는 미국
 * 오후에 기사를 내므로 표준시로 두면 날짜 자체가 하루 밀립니다.
 */
const fmt = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  timeZone: "Asia/Seoul",
});

const time = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

/** 보관함의 날짜별 기사 목록 — `/news` 와 `/news/[month]` 가 같이 씁니다 */
export function NewsDays({ days }: { days: { day: string; items: Archived[] }[] }) {
  return (
    <>
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
    </>
  );
}

/** 달 목차 — "2026년 10월 · 31일 · 742건" */
export function NewsMonthNav({
  months,
  current,
}: {
  months: { month: string; days: number; count: number }[];
  current?: string;
}) {
  if (months.length === 0) return null;
  return (
    <nav className="section" aria-label="달별 보관함">
      <h2 className="section__title">지난 기사 — 달별로</h2>
      <ul className="newsmonths">
        {months.map(({ month, days, count }) => {
          const [y, m] = month.split("-");
          const label = `${y}년 ${Number(m)}월`;
          return (
            <li key={month}>
              {month === current ? (
                <span className="newsmonths__item is-current" aria-current="page">
                  {label}
                  <span className="mono">{days}일 · {count}건</span>
                </span>
              ) : (
                <Link href={`/news/${month}`} className="newsmonths__item">
                  {label}
                  <span className="mono">{days}일 · {count}건</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** 출처·이용 조건 — 보관함 장마다 붙입니다 (CC BY 4.0 표기 의무) */
export function NewsCaution() {
  return (
    <section className="section" style={{ borderBottom: "none" }}>
      <div className="caution">
        <span className="caution__label">이용 조건</span>
        <span>
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
        </span>
      </div>
    </section>
  );
}
