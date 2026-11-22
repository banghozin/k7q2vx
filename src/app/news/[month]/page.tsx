import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsCaution, NewsDays, NewsMonthNav } from "@/components/news-days";
import { newsByDay, newsMonths } from "@/lib/news-archive";

/** 하루 한 번 갱신되므로 화면도 그 주기로 다시 만듭니다 */
export const revalidate = 21600;

export function generateStaticParams() {
  return newsMonths().map(({ month }) => ({ month }));
}

function label(month: string) {
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ month: string }>;
}): Promise<Metadata> {
  const { month } = await params;
  if (!/^\d{4}-\d{2}$/.test(month)) return {};
  return {
    title: `뉴스 보관함 — ${label(month)}`,
    alternates: { canonical: `/news/${month}` },
  };
}

/** 지난 기사 한 달치 — 보관함 첫 장은 최근 일주일만 그립니다 */
export default async function NewsMonthPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  const months = newsMonths();
  if (!months.some((m) => m.month === month)) notFound();

  const days = newsByDay().filter((d) => d.day.startsWith(`${month}-`));
  const count = days.reduce((a, d) => a + d.items.length, 0);

  return (
    <div className="wrap">
      <header className="dochead">
        <h1 className="dochead__title">뉴스 보관함 — {label(month)}</h1>
        <p className="dochead__tagline">
          <Link href="/news">최근 일주일 보기</Link>
        </p>
        <div className="docmeta">
          <span>{days.length}일치</span>
          <span>{count}건</span>
          <span>한국 날짜 기준</span>
        </div>
      </header>

      <NewsDays days={days} />

      <NewsMonthNav months={months} current={month} />

      <NewsCaution />
    </div>
  );
}
