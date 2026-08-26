import Link from "next/link";
import { THEMES, getTheme, multiThemeStocks } from "@/data/themes";
import { CrossTicker } from "@/components/cross-ticker";
import { NewsList } from "@/components/news-list";
import { fetchNews } from "@/lib/sbhnews";
import { BriefHistory } from "@/components/brief-history";
import { ThemeBriefingLine } from "@/components/briefing";
import {
  asOf,
  coldestLayers,
  handovers,
  hottestLayers,
  pct,
  rotations,
  tone,
} from "@/lib/market-data";

// 뉴스는 실행 중에 읽어오므로 6시간마다 새로 만듭니다
export const revalidate = 21600;

export default async function Home() {
  const totalStocks = THEMES.reduce(
    (a, t) => a + t.layers.reduce((x, l) => x + l.stocks.length, 0),
    0,
  );
  const totalLayers = THEMES.reduce((a, t) => a + t.layers.length, 0);
  const overlap = multiThemeStocks().slice(0, 12);
  const hot = hottestLayers(3);
  const cold = coldestLayers(3);
  const moves = handovers();
  const rotated = rotations().slice(0, 4);

  // 홈은 "지금"을 보여주는 자리라 보관본이 아니라 실시간 피드를 씁니다
  const headlines = (await fetchNews())
    .filter((n) => n.category === "economy")
    .slice(0, 5);

  return (
    <>
      <div className="wrap">
        <section className="hero">
          <div className="eyebrow">미국 상장 종목 · 한국어 · 하루 1회 갱신</div>
          <h1 className="hero__title">
            종목을 나열하지 않고, 산업을 층으로 세웁니다.
          </h1>
          <p className="hero__lede">
            &ldquo;관련주 25선&rdquo; 같은 납작한 목록 대신, 하나의 산업을 원재료부터 최종
            서비스까지 층으로 쌓아 보여줍니다. 그러면 돈이{" "}
            <strong>어느 층에서 어느 층으로</strong> 옮겨갔는지가 보입니다.
          </p>
          <p className="hero__lede">
            모든 종목에는 <strong>왜 그 층에 있는지</strong> 한 줄이 붙어 있습니다.
            근거를 밝히지 않는 관련주 목록과 갈라지는 지점입니다.
          </p>
          <div className="docmeta">
            <span>{THEMES.length}개 테마</span>
            <span>{totalLayers}개 층</span>
            <span>{totalStocks}개 배치</span>
            {asOf && <span>시세 기준 {asOf}</span>}
            <span>매수·매도 의견 없음</span>
          </div>
        </section>
      </div>

      {headlines.length > 0 && (
        <div className="wrap">
          <section className="section">
            <h2 className="section__title">오늘의 경제 헤드라인</h2>
            <p className="section__sub">
              공개 뉴스 피드의 경제 기사입니다. 위 테마·종목 배치와 인과관계를
              주장하지 않습니다.
            </p>
            <NewsList items={headlines} />
          </section>
        </div>
      )}

      {rotated.length > 0 && (
        <div className="wrap">
          <section className="section">
            <h2 className="section__title">한 줄 브리핑</h2>
            <p className="section__sub">
              20일 순위와 5일 순위를 비교해 <strong>층 사이의 자리바꿈</strong>이
              뚜렷한 테마만 골랐습니다. 수익률이 아니라 순위로 보는 이유는, 시장
              전체가 빠진 주에는 모든 층이 같이 내려가 비교가 안 되기 때문입니다.
              {asOf && <> 기준일은 {asOf} 종가입니다.</>}
            </p>
            <div className="brief">
              {rotated.map(({ slug, b }) => (
                <ThemeBriefingLine
                  key={slug}
                  themeSlug={slug}
                  themeName={getTheme(slug)?.name}
                  b={b}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* 기록이 사흘도 안 쌓였으면 스스로 아무것도 내보내지 않습니다 */}
      <BriefHistory />

      {hot.length > 0 && (
        <div className="wrap">
          <section className="section">
            <h2 className="section__title">지금 가장 뜨거운 층</h2>
            <p className="section__sub">
              11개 테마의 {totalLayers}개 층을 가로질러 최근 20일 성과가 가장 높은
              곳과 낮은 곳입니다. 층에 속한 종목 등락률의 중앙값 기준이며,{" "}
              <strong>지나간 기록입니다.</strong>
            </p>
            <div className="hotgrid">
              {hot.map(({ slug, layer }) => (
                <Link
                  key={`${slug}-${layer.key}`}
                  href={`/theme/${slug}#layer-${layer.n}`}
                  className="hotcard"
                >
                  <span className="hotcard__theme">
                    {getTheme(slug)?.name} · {layer.n}층
                  </span>
                  <span className="hotcard__layer">{layer.name}</span>
                  <span className={`hotcard__v mono ${tone(layer.ret20)}`}>
                    {pct(layer.ret20)}
                  </span>
                  <span className="hotcard__sub mono">
                    20일 중앙값 · {layer.up}/{layer.total}종목 상승
                  </span>
                </Link>
              ))}
            </div>

            <h3
              className="section__title"
              style={{ fontSize: "1.05rem", margin: "2rem 0 0.5rem" }}
            >
              가장 식은 층
            </h3>
            <div className="hotgrid">
              {cold.map(({ slug, layer }) => (
                <Link
                  key={`${slug}-${layer.key}`}
                  href={`/theme/${slug}#layer-${layer.n}`}
                  className="hotcard"
                >
                  <span className="hotcard__theme">
                    {getTheme(slug)?.name} · {layer.n}층
                  </span>
                  <span className="hotcard__layer">{layer.name}</span>
                  <span className={`hotcard__v mono ${tone(layer.ret20)}`}>
                    {pct(layer.ret20)}
                  </span>
                  <span className="hotcard__sub mono">
                    20일 중앙값 · {layer.up}/{layer.total}종목 상승
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      {moves.length > 0 && (
        <div className="wrap">
          <section className="section">
            <h2 className="section__title">앞서던 종목이 바뀐 테마</h2>
            <p className="section__sub">
              약 3개월 전 기준으로 테마를 끌던 종목과 지금 끄는 종목이 달라진
              곳입니다. <strong>순위가 바뀌었다는 사실만</strong> 적은 것이며,
              어느 쪽을 사라는 뜻이 아닙니다.
            </p>
            <div className="hotgrid">
              {moves.map((m) => (
                <Link
                  key={m.slug}
                  href={`/theme/${m.slug}#leader`}
                  className="hotcard"
                >
                  <span className="hotcard__theme">{getTheme(m.slug)?.name}</span>
                  <span className="hotcard__layer mono">
                    {m.from} → {m.to}
                  </span>
                  <span className="hotcard__sub">
                    {m.agoDays}거래일 전과 비교
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="wrap">
        <section className="section">
          <h2 className="section__title">테마</h2>
          <p className="section__sub">
            층 구조는 테마마다 같은 방식으로 재사용됩니다. 어느 테마를 열어도
            읽는 법은 같습니다.
          </p>
          <div className="themegrid">
            {THEMES.map((t, i) => (
              <Link
                key={t.slug}
                href={`/theme/${t.slug}`}
                className="themecard"
                style={{ ["--accent" as string]: t.accent }}
              >
                <span className="themecard__n mono">
                  {String(i + 1).padStart(2, "0")} · {t.layers.length}개 층
                </span>
                <span className="themecard__name">{t.name}</span>
                <span className="themecard__tagline">{t.tagline}</span>
                <span className="ticks" aria-hidden="true">
                  {t.layers.map((l) => (
                    <i key={l.key} />
                  ))}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="wrap">
        <section className="section">
          <h2 className="section__title">여러 테마에 동시에 걸린 종목</h2>
          <p className="section__sub">
            테마 파일을 통째로 훑어 자동으로 뽑아낸 목록입니다. 하나의 테마
            뉴스로 오른 종목이 사실 다른 테마에도 올라 있는 경우가 여기 드러납니다.
            티커를 누르면 차트가 열립니다.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "6rem" }}>티커</th>
                  <th style={{ width: "12rem" }}>회사</th>
                  <th>걸쳐 있는 층</th>
                </tr>
              </thead>
              <tbody>
                {overlap.map((row) => (
                  <CrossTicker
                    key={row.ticker}
                    ticker={row.ticker}
                    places={row.places}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="wrap">
        <section className="section" style={{ borderBottom: "none" }}>
          <h2 className="section__title">이 사이트가 하지 않는 것</h2>
          <div className="notice">
            <p style={{ marginTop: 0 }}>
              <strong>사실만 씁니다.</strong> &ldquo;누가 어느 층에 있는가&rdquo;와
              &ldquo;무엇이 같이 움직였는가&rdquo;는 기록입니다. &ldquo;그래서 이걸 사라&rdquo;는
              자문입니다. 이 사이트는 앞의 것만 합니다.
            </p>
            <p>
              매수·매도 의견, 목표가, 추천 표현을 넣지 않습니다. 앞으로 붙일
              동조율 숫자도 <strong>과거 기록이지 예측이 아닙니다.</strong>
            </p>
            <p style={{ marginBottom: 0 }}>
              갱신은 하루 1회입니다. 실시간이 아니라는 점은 의도된 선택입니다.{" "}
              <Link href="/about">읽는 법을 자세히 보기</Link>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
