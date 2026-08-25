import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { THEMES, getTheme, layersTopDown } from "@/data/themes";
import { Strata } from "@/components/strata";
import { NewsList } from "@/components/news-list";
import { ShareLayerLink } from "@/components/share-layer-link";
import { fetchNews, matchTheme } from "@/lib/sbhnews";

export const revalidate = 21600; // 6시간

export function generateStaticParams() {
  return THEMES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const theme = getTheme(slug);
  if (!theme) return {};
  return {
    title: theme.name,
    description: `${theme.tagline} — ${theme.question}`,
  };
}

export default async function ThemePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const theme = getTheme(slug);
  if (!theme) notFound();

  const layers = layersTopDown(theme);
  const stockCount = theme.layers.reduce((a, l) => a + l.stocks.length, 0);

  const news = matchTheme(await fetchNews(), theme.newsKeywords, 6);

  return (
    <div style={{ ["--accent" as string]: theme.accent }}>
      <div className="wrap">
        <header className="dochead">
          <h1 className="dochead__title">{theme.name}</h1>
          <p className="dochead__tagline">{theme.tagline}</p>
          <p className="dochead__question">{theme.question}</p>
          <div className="docmeta">
            <span>{theme.layers.length}개 층</span>
            <span>{stockCount}종목</span>
            <span>큐레이션 {theme.curatedAt}</span>
            <span>갱신 하루 1회</span>
          </div>
        </header>
      </div>

      <div className="wrap">
        <div className="notice" style={{ marginTop: "1.5rem" }}>
          <strong>읽는 법.</strong> 위가 최종 서비스, 아래로 갈수록 원재료와
          설계입니다. 각 종목 아래 한 줄은 <strong>왜 그 층에 있는지</strong>를
          밝힌 것이지 매수·매도 의견이 아닙니다. 카드를 누르면 일봉 차트가
          열리고, 회색 태그는 그 종목이 <strong>다른 테마에도 걸쳐 있다</strong>
          는 표시입니다.
        </div>

        <ShareLayerLink layers={theme.layers} />
      </div>

      <div className="wrap">
        <Strata layers={layers} themeSlug={theme.slug} />
      </div>

      <div className="wrap">
        <section className="section" id="news">
          <h2 className="section__title">이 테마에 걸린 기사</h2>
          <p className="section__sub">
            공개 뉴스 피드에서 이 테마의 키워드가 걸린 기사만 골라 놓은 것입니다.
            종목별 뉴스가 아니며, 기사와 위 종목 배치 사이에 인과관계를 주장하지
            않습니다.
          </p>
          <NewsList items={news} />
        </section>
      </div>
    </div>
  );
}
