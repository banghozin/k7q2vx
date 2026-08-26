import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { THEMES, getTheme, layersTopDown } from "@/data/themes";
import { Strata } from "@/components/strata";
import { NewsList } from "@/components/news-list";
import { ShareLayerLink } from "@/components/share-layer-link";
import { LayerHeatMap } from "@/components/layer-heat";
import { SyncTable } from "@/components/sync-table";
import { LeaderPanel } from "@/components/leader-panel";
import { newsForTheme, toNewsItem } from "@/lib/news-archive";
import { ThemeBriefingLine } from "@/components/briefing";
import { RotationChart } from "@/components/rotation-chart";
import {
  asOf,
  getBriefing,
  getLayerHeat,
  getLeaders,
  getRotation,
  getSync,
  hasMarketData,
} from "@/lib/market-data";

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

  const heat = getLayerHeat(theme.slug);
  const sync = getSync(theme.slug);
  const leaders = getLeaders(theme.slug);
  const brief = getBriefing(theme.slug);
  const rot = getRotation(theme.slug);

  /*
   * 예전에는 테마 키워드로 공개 피드를 훑었는데, 그러면
   * 사이버보안에 멕시코 군 배치 기사가, 조선·해운에 시외버스 요금 인상이
   * 걸렸습니다(조선, 운임 같은 낱말이 엉뚱한 데서 잡힌 탓).
   *
   * 지금은 **종목 이름이 실제로 나온 기사만** 보관해 둔 아카이브에서 가져옵니다.
   * 조사까지 따지는 이름 판정을 거치므로 인텔리시아 가 인텔로 잡히지 않습니다.
   */
  const news = newsForTheme(theme.slug, 6).map(toNewsItem);

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
            {asOf && <span>시세 기준 {asOf}</span>}
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
          는 표시입니다. 등락은 <span className="up">빨강이 상승</span>,{" "}
          <span className="down">파랑이 하락</span>입니다.
        </div>

        {brief && brief.riser && (
          <div className="brief" style={{ marginTop: "1.5rem" }}>
            <span className="brief__label">한 줄 브리핑</span>
            <ThemeBriefingLine b={brief} />
            {asOf && <span className="brief__date mono">{asOf} 종가 기준</span>}
          </div>
        )}

        {heat.length > 0 && (
          <section className="section" id="heat">
            <h2 className="section__title">지금 어느 층이 뜨거운가</h2>
            <p className="section__sub">
              층에 속한 종목들 20일 등락률의 <strong>중앙값</strong>입니다. 한
              종목이 크게 튀어도 층 전체가 왜곡되지 않도록 평균 대신 중앙값을
              씁니다. 막대를 누르면 그 층으로 내려갑니다.
            </p>
            <LayerHeatMap themeSlug={theme.slug} layers={heat} />
          </section>
        )}

        {rot && (
          <section className="section" id="rotation">
            <h2 className="section__title">어느 층에서 어느 층으로 옮겨갔나</h2>
            <p className="section__sub">
              지난 반년 동안 층들의 순위가 어떻게 뒤바뀌었는지입니다. 이 사이트가
              하려던 일이 바로 이것 — <strong>&ldquo;테마가 빠졌다&rdquo;가 아니라 &ldquo;테마
              안에서 어디로 옮겨갔다&rdquo;</strong>를 보여주는 것입니다.
            </p>
            <RotationChart rotation={rot} />
          </section>
        )}

        <ShareLayerLink layers={theme.layers} />
      </div>

      <div className="wrap">
        <Strata layers={layers} themeSlug={theme.slug} />
      </div>

      {sync && sync.candidates.length > 0 && (
        <div className="wrap">
          <section className="section" id="sync">
            <h2 className="section__title">동조율 — 누가 같이 움직였나</h2>
            <p className="section__sub">
              기준 종목이 크게 오른 날만 골라, 그날 각 종목이 어떻게 반응했는지
              센 것입니다. &ldquo;관련주&rdquo;라는 말 대신 숫자로 답하려는 장치입니다.
            </p>
            <SyncTable themeSlug={theme.slug} sync={sync} />
          </section>
        </div>
      )}

      {leaders && leaders.ranked.length > 0 && (
        <div className="wrap">
          <section className="section" id="leader">
            <h2 className="section__title">무엇이 이 테마를 끌고 있나</h2>
            <p className="section__sub">
              시가총액 1위가 아니라 <strong>먼저 반응하고, 더 크게 가고,
              나머지를 끌고 가는</strong> 종목을 찾는 계산입니다. 근거를
              감추지 않고 재료를 그대로 펼쳐 둡니다.
            </p>
            <LeaderPanel themeSlug={theme.slug} leaders={leaders} />
          </section>
        </div>
      )}

      {!hasMarketData && (
        <div className="wrap">
          <div className="empty" style={{ margin: "2rem 0" }}>
            시세 데이터가 아직 계산되지 않았습니다. 층 구조와 배치만 표시됩니다.
          </div>
        </div>
      )}

      <div className="wrap">
        <section className="section" id="news">
          <h2 className="section__title">이 테마에 걸린 기사</h2>
          <p className="section__sub">
            이 테마에 속한 <strong>종목 이름이 실제로 나온</strong> 기사만
            보관해 둔 것입니다. 키워드가 비슷하다는 이유로 엮지 않습니다.
            기사와 위 종목 배치 사이에 인과관계를 주장하지 않습니다.
          </p>
          <NewsList items={news} />
        </section>
      </div>
    </div>
  );
}
