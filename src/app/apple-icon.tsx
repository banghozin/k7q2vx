import { ImageResponse } from "next/og";

/**
 * 아이폰 홈 화면에 추가했을 때 쓰는 아이콘.
 *
 * 애플은 SVG 를 안 받고 PNG 만 받습니다. 그림 파일을 따로 만들어 두면 색을
 * 바꿀 때 아이콘만 옛날 색으로 남으므로, 빌드할 때 코드에서 그려 냅니다.
 * 모양은 `icon.svg` 와 같은 지층 단면도입니다.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const bars = [
    { top: 120, width: 124, color: "#2b3038" },
    { top: 92, width: 107, color: "#3a424d" },
    { top: 64, width: 90, color: "#5a6472" },
    { top: 36, width: 73, color: "#c8a15a" },
  ];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "#0a0c0f",
      }}
    >
      {bars.map((b) => (
        <div
          key={b.top}
          style={{
            position: "absolute",
            top: b.top,
            left: (180 - b.width) / 2,
            width: b.width,
            height: 22,
            borderRadius: 6,
            background: b.color,
          }}
        />
      ))}
    </div>,
    size,
  );
}
