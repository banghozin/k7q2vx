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
            앞으로 붙일 동조율(대장주가 크게 오른 날 각 종목이 어떻게 반응했는지
            세는 숫자)은 <strong>과거 기록이지 예측이 아닙니다.</strong> 이
            문구를 작게 숨기지 않고 숫자 옆에 그대로 두겠습니다.
          </p>
          <p style={{ marginBottom: 0 }}>
            표시되는 종목은 산업 구조를 설명하기 위한 분류 예시입니다. 특정
            종목의 매매를 권유하지 않습니다.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">데이터와 갱신</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "10rem" }}>항목</th>
                <th>출처와 방식</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>테마–종목 배치</td>
                <td>
                  직접 큐레이션. 각 테마 화면 상단에 마지막으로 손본 날짜가
                  적혀 있습니다.
                </td>
              </tr>
              <tr>
                <td>일봉 시세</td>
                <td>
                  Yahoo Finance. 차트를 열 때 조회하며 지연될 수 있습니다.
                </td>
              </tr>
              <tr>
                <td>뉴스</td>
                <td>
                  <a href={SBH.dataUseUrl} target="_blank" rel="noreferrer">
                    {SBH.source}
                  </a>{" "}
                  공개 RSS. 라이선스{" "}
                  <a href={SBH.licenseUrl} target="_blank" rel="noreferrer">
                    {SBH.license}
                  </a>
                  . 본문은 수정하지 않았고 테마 키워드로 골라 배치하는 가공만
                  했습니다. 기사의 제3자 권리 자료는 이용 범위에서 제외됩니다.
                </td>
              </tr>
              <tr>
                <td>워치리스트 · 매매노트</td>
                <td>
                  이용자의 브라우저(localStorage)에만 저장됩니다. 서버로
                  전송되지 않습니다.
                </td>
              </tr>
              <tr>
                <td>갱신 주기</td>
                <td>
                  하루 1회. 실시간이 아니라는 점은 의도된 선택입니다.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" style={{ borderBottom: "none" }}>
        <h2 className="section__title">아직 없는 것</h2>
        <p style={{ maxWidth: "var(--measure)", color: "var(--ink-2)" }}>
          층별 온도(5일·20일 성과), 동조율, 대장주 판별, 매일 한 줄 브리핑은
          아직 붙지 않았습니다. 지금은 층 구조와 배치 근거를 먼저 세우는
          단계입니다. <Link href="/">테마 목록으로</Link>
        </p>
      </section>
    </div>
  );
}
