import type { Metadata } from "next";
import Link from "next/link";
import { SBH } from "@/lib/sbhnews";

export const metadata: Metadata = {
  title: "읽는 법",
  description: "이 사이트를 읽는 법과, 넘지 않는 선.",
};

export default function AboutPage() {
  return (
    <div className="wrap">
      <header className="dochead">
        <h1 className="dochead__title">층으로 읽는다는 것</h1>
        <p className="dochead__tagline">
          이 사이트가 무엇을 하고, 무엇을 하지 않는지.
        </p>
      </header>

      <section className="section">
        <h2 className="section__title">왜 층인가</h2>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          &ldquo;AI 관련주&rdquo;라는 말은 너무 넓어서 아무 것도 알려주지 않습니다. 같은
          AI라도 칩을 그리는 회사와 전기를 대는 회사는 다른 소식에, 다른
          시점에, 다른 방향으로 움직입니다. 그래서 종목을 옆으로 늘어놓는 대신
          위아래로 세웠습니다.
        </p>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          층으로 세우면 &ldquo;AI가 빠졌다&rdquo;가 아니라 &ldquo;AI 안에서 메모리에서 광통신으로
          옮겨갔다&rdquo;가 보입니다. 어느 층이 먼저 움직이고 어느 층이 따라오는지도
          층 단위로 봐야 잡힙니다.
        </p>
      </section>

      <section className="section">
        <h2 className="section__title">화면 읽는 법</h2>
        <ul style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          <li>
            <strong>위가 최종 서비스, 아래가 원재료·설계</strong>입니다. 건물처럼
            1층이 맨 아래입니다.
          </li>
          <li>
            종목 아래 한 줄은 <strong>왜 그 층에 있는지</strong>입니다. 사라는
            말이 아닙니다.
          </li>
          <li>
            왼쪽에 세로선이 그어진 카드는 그 층의 <strong>축</strong>이 되는
            종목입니다. 시가총액 1위라는 뜻이 아니라, 그 층을 설명할 때 기준으로
            삼기 좋은 종목이라는 뜻입니다.
          </li>
          <li>
            회색 태그는 그 종목이 <strong>다른 테마에도 올라 있다</strong>는
            표시입니다. 자동으로 붙습니다.
          </li>
          <li>
            <span className="caution__label" style={{ letterSpacing: ".14em" }}>
              유의
            </span>{" "}
            표시는 그 층을 볼 때 오해하기 쉬운 점입니다. 미국 상장 종목이 없어
            층이 얇은 경우 등을 숨기지 않고 적습니다.
          </li>
        </ul>
      </section>

      <section className="section">
        <h2 className="section__title">넘지 않는 선</h2>
        <div className="notice">
          <p style={{ marginTop: 0 }}>
            <strong>&ldquo;누가 같이 움직였다&rdquo;는 사실이고, &ldquo;이걸 사라&rdquo;는 자문입니다.</strong>{" "}
            이 사이트는 앞의 것만 합니다. 매수·매도 의견, 목표가, 추천 표현을
            넣지 않습니다.
          </p>
          <p>
            동조율(대장주가 크게 오른 날 각 종목이 어떻게 반응했는지 세는
            숫자)은 <strong>과거 기록이지 예측이 아닙니다.</strong> 이 문구를
            작게 숨기지 않고 숫자 옆에 그대로 둡니다.
          </p>
          <p style={{ marginBottom: 0 }}>
            표시되는 종목은 산업 구조를 설명하기 위한 분류 예시입니다. 특정
            종목의 매매를 권유하지 않습니다.
          </p>
        </div>
      </section>

      <section className="section" id="how">
        <h2 className="section__title">숫자를 어떻게 계산하나</h2>

        <h3 style={{ fontSize: "1.05rem", margin: "1.5rem 0 0.5rem" }}>
          층별 온도
        </h3>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          층에 속한 종목들 등락률의 <strong>중앙값</strong>입니다. 평균이 아니라
          중앙값을 쓰는 이유는, 한 종목이 30% 튀었다고 층 전체가 뜨거워 보이면
          안 되기 때문입니다. 배당과 액면분할이 반영된 수정 종가로 계산합니다.
        </p>

        <h3 style={{ fontSize: "1.05rem", margin: "1.5rem 0 0.5rem" }}>
          동조율
        </h3>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          기준 종목이 하루에 <strong>+3% 이상 오른 날</strong>만 최근 1년에서
          뽑고, 그날 각 종목이 올랐는지 셉니다. 사건이 10회가 안 되면 기준을
          +2%, +1.5%로 낮추며, <strong>실제로 쓴 기준과 사건 수를 화면에 그대로
          적습니다.</strong> 상장이 늦어 사건일 전체를 겪지 못한 종목은
          겪은 날만 분모로 쓰고 &lsquo;부분&rsquo;으로 표시합니다 — 분모가 다른 비율을
          나란히 놓고 비교하면 안 되기 때문입니다.
        </p>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          <strong>이 숫자는 지나간 기록입니다.</strong> 앞으로도 같이 움직인다는
          보장이 아니고, 한쪽이 다른 쪽을 움직였다는 인과관계의 증거도 아닙니다.
        </p>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          기준 종목은 아래 &lsquo;대장주&rsquo; 계산으로 뽑은 값이 기본이지만,{" "}
          <strong>화면에서 다른 종목으로 바꿔 볼 수 있습니다.</strong> 상위
          후보 세 개에 더해 그 테마에서 거래대금이 가장 큰 종목(대개 사람들이
          아는 이름)을 후보에 넣어 뒀습니다. &ldquo;엔비디아 기준으로 보면 어떤가&rdquo;
          같은 질문에 바로 답하기 위해서입니다.
        </p>

        <h3 style={{ fontSize: "1.05rem", margin: "1.5rem 0 0.5rem" }}>
          층 전체였나, 이 종목만이었나
        </h3>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          종목이 크게 움직인 날, <strong>같은 층에서 그 종목을 뺀 나머지</strong>의
          중앙값과 견줍니다. 자기를 빼는 이유는 구성원이 적은 층에서 자기가 자기를
          설명하게 되기 때문이고, 중앙값을 쓰는 이유는 한 종목이 실적으로 튀어도
          층 전체가 왜곡되지 않게 하기 위해서입니다.
        </p>
        <ul style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          <li>
            <strong>층 전체가 같이</strong> — 나머지도 이 종목의 60% 이상 같은
            방향으로 움직였을 때
          </li>
          <li>
            <strong>이 종목만</strong> — 나머지가 반대로 갔거나 30%도 못 미쳤을 때
          </li>
          <li>
            <strong>일부만 같이</strong> — 그 사이
          </li>
        </ul>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          하루 2%(닷새 4%)도 안 움직인 날은 <strong>판정하지 않습니다</strong> —
          잠잠한 날에 방향을 따지는 건 잡음입니다. 비교 상대가 하나뿐인 층도
          판정하지 않습니다. 그건 중앙값이 아니라 그냥 그 한 종목이니까요.
          차트를 열면 종목 아래에 나옵니다. <strong>기준일은 마지막 거래일이라
          지금 시세와 다를 수 있어 날짜를 함께 적습니다.</strong>
        </p>

        <h3 style={{ fontSize: "1.05rem", margin: "1.5rem 0 0.5rem" }}>
          무엇이 테마를 끄는가 (대장주)
        </h3>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          네 가지를 테마 안 순위로 환산해 합산합니다 — 주도력 45%, 선행성 25%,
          상대강도 15%, 자금유입 15%.
        </p>
        <ul style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          <li>
            <strong>주도력</strong> — 이 종목이 크게 오른 상위 30일에 나머지
            종목들도 같이 올랐는지. 평상시 비율을 뺀 초과분입니다.
          </li>
          <li>
            <strong>선행성</strong> — 먼저 움직인 정도에서 따라간 정도를 뺀 값.
            양수면 앞서 움직였다는 뜻입니다.
          </li>
          <li>
            <strong>상대강도</strong> — 60일 수익률에서 테마 중앙값을 뺀 값.
          </li>
          <li>
            <strong>자금유입</strong> — 20일 평균 거래대금 ÷ 60일 평균 거래대금.
            절대 규모가 아니라 <em>최근에 늘었는가</em>를 봅니다.
          </li>
        </ul>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          계산에 앞서 <strong>시장 전체 흐름(S&amp;P500)의 영향을 걷어냅니다.</strong>{" "}
          그러지 않으면 시장이 오르는 날에만 오르는 저변동 종목이 &ldquo;나머지를 끌고
          간다&rdquo;고 잘못 집계됩니다. 또 회사 매출에서 이 테마가 차지하는 비중이
          작은 종목(예: 양자컴퓨팅에서의 대형 IT)은 대장 후보에서 뺍니다 — 테마와
          무관한 실적이 순위를 정해 버리기 때문입니다. 그런 종목도 층에는 그대로
          남고 동조율 구성원으로도 셉니다.
        </p>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          1위와 2위 점수가 거의 붙어 있으면 <strong>&lsquo;접전&rsquo;으로 표시하고 한 종목을
          대장이라 단정하지 않습니다.</strong> 손바뀜은 약 3개월 전과 비교해
          예전 1위가 3위 밖으로 밀려났을 때만 표시합니다 — 짧은 기간으로 보면
          순위가 수시로 뒤집혀 잡음이 됩니다.
        </p>
      </section>

      <section className="section">
        <h2 className="section__title">데이터와 갱신</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th scope="col" style={{ width: "10rem" }}>항목</th>
                <th scope="col">출처와 방식</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="항목">테마–종목 배치</td>
                <td data-label="출처와 방식">
                  직접 큐레이션. 각 테마 화면 상단에 마지막으로 손본 날짜가
                  적혀 있습니다.
                </td>
              </tr>
              <tr>
                <td data-label="항목">일봉 시세</td>
                <td data-label="출처와 방식">
                  Yahoo Finance 수정 종가. 원래는 stooq 의 공개 CSV 를 쓰려고
                  했으나 2026년 8월 현재 stooq 가 자동 수집을 차단해 전환했습니다.
                  하루 1회 계산하며, 차트를 열 때는 그 자리에서 따로 조회합니다.
                </td>
              </tr>
              <tr>
                <td data-label="항목">뉴스</td>
                <td data-label="출처와 방식">
                  미국 금융 매체(CNBC · MarketWatch · Yahoo Finance · Nasdaq ·
                  Seeking Alpha)와 한국어{" "}
                  <a href={SBH.dataUseUrl} target="_blank" rel="noreferrer">
                    {SBH.source}
                  </a>
                  의 공개 RSS. 뒤엣것은 라이선스{" "}
                  <a href={SBH.licenseUrl} target="_blank" rel="noreferrer">
                    {SBH.license}
                  </a>
                  입니다. <strong>제목과 원문 링크만</strong> 가져오며 본문은
                  받지도 고치지도 않습니다 — 읽기는 각 매체의 원문에서 하시게
                  됩니다. 기사에 종목을 붙일 때는{" "}
                  <strong>회사 이름이 실제로 나온 것만</strong> 겁니다. 예전에
                  테마 키워드로 훑었더니 &ldquo;보안&rdquo;으로 멕시코 치안 기사가,
                  &ldquo;조선&rdquo;으로 시외버스 요금 기사가 딸려 들어와 그만뒀습니다.
                  기사의 제3자 권리 자료는 이용 범위에서 제외됩니다.
                </td>
              </tr>
              <tr>
                <td data-label="항목">기기에 저장되는 것</td>
                <td data-label="출처와 방식">
                  워치리스트 · 매매노트 · 훈련 기록 · <strong>분석 화면에 그린
                  것</strong>. 전부 이용자의 브라우저(localStorage)에만
                  저장됩니다. 서버로 전송되지 않고 다른 기기와 동기화되지
                  않으며 운영자도 볼 수 없습니다. 브라우저 데이터를 지우면
                  사라지므로 매매노트는 내보내기로 백업해 두세요.
                </td>
              </tr>
              <tr>
                <td data-label="항목">갱신 주기</td>
                <td data-label="출처와 방식">
                  시세와 계산은 평일 미국장 마감 후 <strong>하루 1회</strong>.
                  실시간이 아니라는 점은 의도된 선택입니다. 갱신 전에 모든
                  종목이 아직 상장돼 있는지 자동으로 확인하며, 하나라도
                  사라졌으면 갱신을 멈추고 알립니다. 뉴스는 따로{" "}
                  <strong>여섯 시간마다</strong> 모읍니다 — 공개 피드가 몇
                  시간치만 주기 때문에 하루 한 번으로는 그날 기사를 놓칩니다.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" style={{ borderBottom: "none" }}>
        <h2 className="section__title">아직 없는 것</h2>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          기업의 실적 발표 일정을 층 위에 얹어 보여주는 화면이 아직 없습니다.
          기관 보유 변동(13F)을 층 단위로 합산해 보여주는 것도 없습니다. 영문
          기사의 제목은 <strong>번역하지 않고 원문 그대로</strong> 둡니다 —
          옮기는 과정에서 뜻이 바뀌는 편보다 낫다고 봤습니다.{" "}
          <Link href="/">테마 목록으로</Link>
        </p>
      </section>
    </div>
  );
}
