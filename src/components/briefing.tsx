import Link from "next/link";
import type { ThemeBriefing } from "@/lib/market-data";
import { josa, pct, tone } from "@/lib/format";

/**
 * 한 줄 브리핑.
 *
 * "AI가 빠졌다"가 아니라 "AI 안에서 어느 층이 앞서기 시작했다"를 한 문장으로
 * 적습니다. 20일 순위와 5일 순위를 비교해 몇 계단 움직였는지만 말합니다.
 *
 * 수익률 차이가 아니라 순위 차이를 쓰는 이유: 시장 전체가 빠진 주에는 모든
 * 층의 수익률이 같이 내려가 비교가 안 됩니다. 순위는 그 영향을 받지 않습니다.
 *
 * 문장에 원인을 넣지 않습니다. "돈이 옮겨갔다"는 해석이고, 우리가 아는 건
 * "순위가 바뀌었다"는 사실뿐입니다.
 */
export function ThemeBriefingLine({
  themeSlug,
  themeName,
  b,
}: {
  themeSlug?: string;
  themeName?: string;
  b: ThemeBriefing;
}) {
  if (!b.riser || !b.faller || !b.hottest) return null;

  const head = themeName ? (
    themeSlug ? (
      <Link href={`/theme/${themeSlug}`} className="brief__theme">
        {themeName}
      </Link>
    ) : (
      <span className="brief__theme">{themeName}</span>
    )
  ) : null;

  return (
    <p className="brief__line">
      {head}
      {b.rotated ? (
        <>
          최근 5일 기준으로{" "}
          <strong>
            {b.riser.n}층 {b.riser.name}
          </strong>
          {josa(b.riser.name, "이/가")}{" "}
          <b className="mono up">{b.riser.delta}계단</b> 올라섰고,{" "}
          <strong>
            {b.faller.n}층 {b.faller.name}
          </strong>
          {josa(b.faller.name, "이/가")}{" "}
          <b className="mono down">{Math.abs(b.faller.delta)}계단</b>{" "}
          내려앉았습니다.
        </>
      ) : (
        <>
          최근 5일 사이 층들의 순위가 크게 바뀌지 않았습니다.
        </>
      )}{" "}
      20일 기준 가장 앞선 층은{" "}
      <strong>
        {b.hottest.n}층 {b.hottest.name}
      </strong>
      <span className={`mono ${tone(b.hottest.ret20)}`}>
        {" "}
        {pct(b.hottest.ret20)}
      </span>
      입니다.
    </p>
  );
}
