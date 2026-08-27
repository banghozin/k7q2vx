import Link from "next/link";
import { SBH } from "@/lib/sbhnews";

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot__grid">
          <div>
            <h4>이 사이트가 하는 일</h4>
            <p style={{ margin: 0 }}>
              미국 상장 종목을 산업 밸류체인의 층으로 세워 보여줍니다. 종목이 왜
              그 층에 있는지를 한 줄로 밝히는 것이 전부입니다.
            </p>
          </div>
          <div>
            <h4>하지 않는 일</h4>
            <p style={{ margin: 0 }}>
              매수·매도 의견, 목표가, 추천을 제공하지 않습니다. 표시된 종목은
              산업 구조를 설명하기 위한 분류 예시입니다.
            </p>
          </div>
          <div>
            <h4>데이터</h4>
            <ul>
              <li>시세 · Yahoo Finance (지연될 수 있음)</li>
              {/*
                공급원이 둘입니다. 한국어 매체 하나만 적어 두면 CNBC 기사에도
                그 출처가 붙은 것처럼 읽힙니다. CC BY 4.0 은 SBHNews 조건입니다.
              */}
              <li>
                뉴스 · 미국 금융 매체 공개 RSS,{" "}
                <a href={SBH.dataUseUrl} target="_blank" rel="noreferrer">
                  {SBH.source}
                </a>{" "}
                <a href={SBH.licenseUrl} target="_blank" rel="noreferrer">
                  {SBH.license}
                </a>
              </li>
              <li>테마–종목 배치 · 직접 큐레이션</li>
              <li>
                <a href="/news">뉴스 보관함</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>둘러보기</h4>
            <ul>
              <li>
                <Link href="/about">읽는 법 · 지켜야 할 선</Link>
              </li>
              <li>
                <Link href="/notes">매매노트</Link>
              </li>
              <li>
                <Link href="/watchlist">워치리스트</Link>
              </li>
            </ul>
          </div>
        </div>
        <p style={{ margin: 0 }}>
          갱신 주기는 하루 1회입니다. 실시간이 아닙니다. 이 사이트의 정보로 인한
          투자 판단의 책임은 이용자 본인에게 있습니다.
        </p>
      </div>
    </footer>
  );
}
