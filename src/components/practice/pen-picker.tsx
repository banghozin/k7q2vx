"use client";

import { useEffect, useRef, useState } from "react";
import { isHex, useChartPrefs } from "@/lib/store/chart-prefs-store";

/**
 * 펜 — 색과 굵기.
 *
 * 처음에는 여섯 색만 뒀습니다. 어두운 바탕에서 서로 구분되고 캔들(빨강·파랑)
 * 과도 안 헷갈리는 것으로 골랐던 것인데, **눈에 확 띄는 순색을 쓰고 싶다**는
 * 요청이 있었습니다. 맞는 말입니다 — 내가 그은 선은 화면에서 제일 먼저
 * 보여야 하고, 그 취향은 사람마다 다릅니다.
 *
 * 그래서 셋으로 나눴습니다.
 *
 *   1. **순색 자주 쓰는 것** — 한 번에 누를 수 있게 앞에
 *   2. **직접 고르기** — 기기의 색 고르개를 열어 아무 색이나
 *   3. **최근에 직접 고른 색** — 다시 찾기 쉽게 남겨 둡니다
 *
 * 캔들이 빨강·파랑이라 그 둘로 그으면 헷갈릴 수 있습니다. 그래도 목록에서
 * 빼지는 않았습니다 — 쓸지 말지는 그리는 사람이 정할 일입니다.
 */

const PALETTE: { color: string; label: string }[] = [
  { color: "#ff2d2d", label: "순빨강" },
  { color: "#ff7a00", label: "주황" },
  { color: "#ffd400", label: "노랑" },
  { color: "#2fe36b", label: "초록" },
  { color: "#00e5ff", label: "청록" },
  { color: "#2b7bff", label: "파랑" },
  { color: "#b45cff", label: "보라" },
  { color: "#ff3fa4", label: "분홍" },
  { color: "#ffffff", label: "흰색" },
  { color: "#c8a15a", label: "황동" },
  { color: "#7fa86b", label: "풀색" },
  { color: "#8a8378", label: "회색" },
];

const WIDTHS: { size: number; label: string }[] = [
  { size: 1, label: "얇게" },
  { size: 2, label: "보통" },
  { size: 3.5, label: "굵게" },
  { size: 5, label: "아주 굵게" },
];

export function PenPicker({
  color,
  size,
  onChange,
}: {
  color: string;
  size: number;
  /** 색이나 굵기가 바뀔 때. 고른 선이 있으면 그 선에 바로 먹습니다 */
  onChange: (color: string, size: number) => void;
}) {
  const recent = useChartPrefs((s) => s.recentColors);
  const remember = useChartPrefs((s) => s.rememberColor);
  const nativeRef = useRef<HTMLInputElement>(null);
  /*
   * 색 고르개를 끄는 동안에도 미리보기가 따라오게 화면 상태를 따로 둡니다.
   * `input[type=color]` 은 끄는 내내 `change` 를 계속 쏘는 기기가 있어서,
   * 그때마다 "최근 색" 에 넣으면 목록이 중간색으로 가득 찹니다. 그래서
   * **손을 뗄 때만** 기억합니다.
   */
  const [live, setLive] = useState(color);
  useEffect(() => setLive(color), [color]);

  const pick = (c: string) => {
    if (!isHex(c)) return;
    setLive(c);
    onChange(c, size);
  };

  /*
   * 직접 고른 색을 "최근" 에 남기는 시점.
   *
   * 처음에는 칸에서 초점이 빠질 때(`onBlur`) 남겼습니다. 그런데 리액트의
   * `onBlur` 는 `focusout` 이라, **기기의 색 고르개가 닫혀도 안 오는 경우가
   * 있습니다.** 그러면 색은 바뀌었는데 최근 목록에는 영영 안 남습니다.
   *
   * 그래서 바뀔 때마다 재되, **잠깐 멈춘 뒤에만** 남깁니다. 고르개 안에서
   * 끄는 동안에는 색이 수십 번 바뀌는데 그걸 다 남기면 목록이 중간색으로
   * 가득 차기 때문입니다. 손을 멈추면 그 색 하나만 들어갑니다.
   */
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rememberSoon = (c: string) => {
    if (settleRef.current) clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => remember(c), 350);
  };
  useEffect(
    () => () => {
      if (settleRef.current) clearTimeout(settleRef.current);
    },
    [],
  );

  return (
    <>
      <div className="prac__swatches">
        {PALETTE.map((p) => (
          <button
            key={p.color}
            type="button"
            className="prac__swatch"
            style={{ background: p.color }}
            aria-label={p.label}
            title={p.label}
            aria-pressed={live.toLowerCase() === p.color}
            onClick={() => pick(p.color)}
          />
        ))}
      </div>

      <div className="prac__custom">
        {/*
          기기가 주는 색 고르개를 그대로 씁니다. 직접 만들면 색상환·명도판·
          입력칸을 다 만들어야 하는데, 기기 것이 더 익숙하고 손가락에도 맞습니다.
          네모는 우리가 그리고 진짜 입력칸은 그 위에 투명하게 덮어 둡니다.
        */}
        <span
          className="prac__swatch prac__swatch--custom"
          style={{ background: live }}
          aria-hidden="true"
        >
          <input
            ref={nativeRef}
            type="color"
            value={live}
            aria-label="색 직접 고르기"
            onChange={(e) => {
              pick(e.target.value);
              rememberSoon(e.target.value);
            }}
          />
        </span>
        <button
          type="button"
          className="btn btn--ghost prac__custombtn"
          onClick={() => nativeRef.current?.click()}
        >
          색 직접 고르기
        </button>
      </div>

      {recent.length > 0 && (
        <div className="prac__recent">
          <span className="prac__recent__label">직접 고른 색</span>
          <div className="prac__recent__row">
            {recent.map((c) => (
              <button
                key={c}
                type="button"
                className="prac__swatch prac__swatch--sm"
                style={{ background: c }}
                aria-label={`직접 고른 색 ${c}`}
                title={c}
                aria-pressed={live.toLowerCase() === c.toLowerCase()}
                onClick={() => pick(c)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="prac__widths">
        {WIDTHS.map((w) => (
          <button
            key={w.size}
            type="button"
            className="prac__width"
            aria-pressed={size === w.size}
            title={w.label}
            onClick={() => onChange(live, w.size)}
          >
            <i style={{ height: `${w.size}px`, background: live }} />
            <span>{w.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
