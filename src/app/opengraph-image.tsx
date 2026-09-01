import { ImageResponse } from "next/og";
import { THEMES } from "@/data/themes";
import { OG, OG_SIZE, loadKoreanFont, strataMark } from "@/lib/og";

/**
 * 첫 화면의 공유 카드.
 *
 * 테마 카드와 달리 **무엇을 하는 곳인지**를 먼저 말합니다. 링크만 받은
 * 사람은 사이트를 모르는 상태라 "관련주 목록이 아니라 층으로 세운다" 가
 * 한 줄로 전해져야 합니다.
 */

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "테마 지도 — 미국주식을 산업의 층으로";

export default async function Image() {
  const layers = THEMES.reduce((n, t) => n + t.layers.length, 0);
  const stocks = new Set(
    THEMES.flatMap((t) =>
      t.layers.flatMap((l) => l.stocks.map((s) => s.ticker.toUpperCase())),
    ),
  ).size;

  const head = "종목을 나열하지 않고, 산업을 층으로 세웁니다.";
  // 카드에서 두 줄을 넘기면 아래 칩에 가려집니다. 한 줄로 끊습니다
  const sub = "돈이 어느 층에서 어느 층으로 옮겨갔는지 보이게.";
  const counts = `테마 ${THEMES.length}개 · 층 ${layers}개 · 종목 ${stocks}개`;
  const foot = "매수·매도 의견 없음 · 하루 1회 갱신";

  const font = await loadKoreanFont(
    `테마 지도${head}${sub}${counts}${foot}` +
      THEMES.map((t) => t.name).join("") +
      "1234567890",
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

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 40,
            fontSize: 66,
            lineHeight: 1.18,
            letterSpacing: -2,
          }}
        >
          {/*
            그림 만드는 쪽(satori)은 자식이 둘 이상인 상자에 `display: flex`
            를 반드시 요구합니다. 글자 사이에 색 낱말 하나를 끼우는 것도
            자식 셋이라 걸립니다 — 줄 자체를 가로 배치로 둡니다.
          */}
          <div style={{ display: "flex" }}>종목을 나열하지 않고,</div>
          <div style={{ display: "flex" }}>
            <span>산업을&nbsp;</span>
            <span style={{ color: OG.brass }}>층</span>
            <span>으로 세웁니다.</span>
          </div>
        </div>

        {/*
          `flexShrink: 0` 이 없으면 아래 칩이 자리를 밀고 들어와 글자가
          잘립니다 — 실제로 두 번째 줄이 칩에 가려 있었습니다.
        */}
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            marginTop: 24,
            fontSize: 30,
            color: OG.ink2,
          }}
        >
          {sub}
        </div>

        {/* 다루는 테마를 그대로 늘어놓습니다 — 폭이 곧 신뢰입니다 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 9,
            // auto 로 바닥에 붙이되, 자리가 빠듯할 때 설명에 딱 붙지 않게
            marginTop: "auto",
            paddingTop: 30,
            marginBottom: 26,
          }}
        >
          {THEMES.map((t) => (
            <div
              key={t.slug}
              style={{
                display: "flex",
                background: OG.panel,
                border: `1px solid ${OG.rule}`,
                borderRadius: 4,
                padding: "8px 14px",
                fontSize: 23,
                color: OG.ink2,
              }}
            >
              {t.name}
            </div>
          ))}
        </div>

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
