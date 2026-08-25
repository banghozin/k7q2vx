import Link from "next/link";
import { THEMES, multiThemeStocks } from "@/data/themes";
import { CrossTicker } from "@/components/cross-ticker";

export default function Home() {
  const totalStocks = THEMES.reduce(
    (a, t) => a + t.layers.reduce((x, l) => x + l.stocks.length, 0),
    0,
  );
  const totalLayers = THEMES.reduce((a, t) => a + t.layers.length, 0);
  const overlap = multiThemeStocks().slice(0, 12);

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
            <span>매수·매도 의견 없음</span>
          </div>
        </section>
      </div>

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
