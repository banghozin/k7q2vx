import { ImageResponse } from "next/og";
import { THEMES, getTheme } from "@/data/themes";
import { OG, OG_SIZE, loadKoreanFont, strataMark } from "@/lib/og";

/**
 * 테마 하나의 공유 카드.
 *
 * 카톡·디스코드에 링크를 붙였을 때 뜨는 그림입니다. **층 구조가 이 사이트의
 * 정체성**이므로 카드에도 층 이름을 그대로 세웁니다 — 목록 하나 없는 다른
 * 관련주 글과 썸네일에서부터 갈라집니다.
 *
 * 날마다 바뀌는 숫자(오늘 뜨거운 층 같은 것)는 넣지 않습니다. 카드 그림은
 * 받는 쪽이 오래 캐시하기 때문에, 어제 숫자를 오늘 것처럼 보여주게 됩니다.
 * 층 개수·종목 수처럼 잘 안 변하는 사실만 씁니다.
 */

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "테마 지도 — 산업을 층으로";

export function generateStaticParams() {
  return THEMES.map((t) => ({ slug: t.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const theme = getTheme(slug);
  if (!theme) return new Response("not found", { status: 404 });

  const stocks = theme.layers.reduce((n, l) => n + l.stocks.length, 0);
  // 층이 많으면 카드가 빽빽해집니다. 여섯까지만 세우고 나머지는 수로 알립니다
  const shown = theme.layers.slice(0, 6);
  const rest = theme.layers.length - shown.length;

  const foot = "테마 지도 · 매수·매도 의견 없음";
  const counts = `${theme.layers.length}개 층 · 종목 ${stocks}개`;
  const font = await loadKoreanFont(
    `${theme.name}${theme.tagline}${theme.question}${counts}${foot}` +
      theme.layers.map((l) => l.name).join("") +
      "층 외 개 1234567890",
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: OG.ground,
          padding: "56px 64px",
          color: OG.ink,
          fontFamily: "Plex",
        }}
      >
        {/* 머리 — 표식과 사이트 이름 */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 7,
            }}
          >
            {strataMark(0.5).map((s, i) => (
              <div key={i} style={s} />
            ))}
          </div>
          <div style={{ fontSize: 26, color: OG.ink3, letterSpacing: 2 }}>
            테마 지도
          </div>
        </div>

        {/* 테마 이름과 한 줄 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 34,
            gap: 14,
          }}
        >
          <div style={{ fontSize: 82, lineHeight: 1.05, letterSpacing: -2 }}>
            {theme.name}
          </div>
          <div style={{ fontSize: 30, color: OG.ink2, lineHeight: 1.35 }}>
            {theme.tagline}
          </div>
        </div>

        {/* 층을 실제로 세워 보여줍니다 — 이게 카드의 핵심입니다 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: "auto",
            marginBottom: 26,
          }}
        >
          {shown.map((l) => (
            <div
              key={l.n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: OG.panel,
                border: `1px solid ${OG.rule}`,
                borderRadius: 4,
                padding: "10px 16px",
                fontSize: 25,
                color: OG.ink2,
              }}
            >
              <span style={{ color: OG.brass }}>{l.n}</span>
              <span>{l.name}</span>
            </div>
          ))}
          {rest > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 16px",
                fontSize: 25,
                color: OG.ink3,
              }}
            >
              외 {rest}개 층
            </div>
          )}
        </div>

        {/* 바닥 — 규모와 지켜야 할 선 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${OG.rule}`,
            paddingTop: 22,
            fontSize: 24,
          }}
        >
          <div style={{ color: OG.brass }}>{counts}</div>
          <div style={{ color: OG.ink3 }}>{foot}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: "Plex", data: font, weight: 600, style: "normal" }]
        : [],
    },
  );
}
