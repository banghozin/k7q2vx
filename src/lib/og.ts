/**
 * 공유 미리보기(Open Graph) 그림을 만들 때 쓰는 것들.
 *
 * 왜 필요한가
 * ------------
 * 링크를 카톡·디스코드·슬랙에 붙이면 그쪽이 페이지를 열어 보고 **제목·설명·
 * 그림**을 카드로 만들어 보여줍니다. 그게 없으면 맨 주소만 덩그러니 뜹니다.
 * 커뮤니티에 처음 내놓을 때 클릭이 갈리는 지점입니다.
 *
 * 한국어를 그림에 넣으려면 글꼴이 필요합니다
 * -------------------------------------------
 * 그림을 만드는 쪽(satori)은 글꼴 파일을 직접 받아야 하고, 없으면 한글이
 * 네모로 나옵니다. 그런데 한국어 글꼴은 통째로 받으면 3MB 가 넘습니다.
 *
 * 재어 보니 구글 폰트는 글꼴마다 다르게 굽니다 — 같은 글자 목록을 줘도
 * **Noto Sans KR 은 3,152KB 를 그대로 주고, IBM Plex Sans KR 은 9.8KB 만**
 * 줍니다. 마침 사이트 본문이 쓰는 글꼴이 그것이라 화면과 그림이 같은 얼굴이
 * 됩니다. Gothic A1(8.7KB) · Nanum Gothic(12.4KB) 도 되지만 굳이 바꿀
 * 이유가 없습니다.
 *
 * **옛날 브라우저인 척해야 합니다.** 요즘 브라우저로 요청하면 woff2 를
 * 주는데 그림 만드는 쪽이 woff2 를 못 읽습니다. 옛 UA 를 주면 woff 로 옵니다.
 *
 * 그림은 **빌드할 때 한 번** 만들어져 파일로 굳습니다. 방문자가 올 때마다
 * 글꼴을 받는 것이 아닙니다.
 */

/** 옛 브라우저인 척 — 이래야 woff 로 옵니다 (woff2 는 못 읽습니다) */
const OLD_UA =
  "Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko";

/**
 * 이 글자들만 담은 글꼴 조각을 받아 옵니다.
 *
 * 못 받으면 `null` 입니다. 그림은 글자 없이라도 만들어지고, 빌드가 남의
 * 서버 때문에 멈추지는 않습니다.
 */
export async function loadKoreanFont(text: string): Promise<ArrayBuffer | null> {
  const chars = [...new Set(text.replace(/\s/g, ""))].join("");
  if (!chars) return null;

  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@600" +
        `&text=${encodeURIComponent(chars)}`,
      { headers: { "User-Agent": OLD_UA } },
    ).then((r) => (r.ok ? r.text() : ""));

    const url = css.match(/url\((https:[^)]+)\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** 카드 크기 — 대부분의 서비스가 이 비율을 씁니다 */
export const OG_SIZE = { width: 1200, height: 630 };

/** 화면과 같은 색을 씁니다 */
export const OG = {
  ground: "#0a0c0f",
  panel: "#12151a",
  rule: "#232932",
  brass: "#c8a15a",
  ink: "#e9e5dd",
  ink2: "#b3ada2",
  ink3: "#8a8378",
} as const;

/**
 * 지층 표식 — 파비콘·머리말과 같은 모양.
 *
 * 그림 만드는 쪽이 SVG 요소를 그대로 받지 못하는 경우가 있어 네모 몇 개로
 * 쌓아 만듭니다. 아래가 넓고 어둡게, 위로 갈수록 좁고 밝게.
 */
export function strataMark(scale = 1) {
  const bars = [
    { w: 96, o: 0.34 },
    { w: 68, o: 0.62 },
    { w: 40, o: 1 },
  ];
  return bars.map((b) => ({
    width: b.w * scale,
    height: 20 * scale,
    borderRadius: 5 * scale,
    background: OG.brass,
    opacity: b.o,
  }));
}
