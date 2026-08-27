"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 그림 하나짜리 도구 단추 + 떠오르는 이름표.
 *
 * 왜 이름표를 화면 기준(fixed)으로 띄우는가
 * ------------------------------------------
 * 도구 서랍(`.prac__tools`)은 `overflow-y: auto` 인 스크롤 통입니다. 그 안에
 * 이름표를 넣으면 **통 밖으로 나가는 부분이 잘립니다.** 서랍 폭이 13.5rem
 * 밖에 안 되니 "출발점부터 여섯 점. 1~5 번호가 자동으로 붙습니다" 같은 설명은
 * 통째로 잘립니다. 그래서 문서 맨 위로 옮겨 그리고 좌표만 계산해 붙입니다.
 *
 * 마우스가 없는 기기에서는
 * ------------------------
 * 손가락으로는 "올려놓기" 가 없습니다. 눌리면 곧바로 도구가 켜지므로 이름표가
 * 뜰 틈도 없고요. 그래서 좁은 화면에서는 **글자를 그림 아래에 그냥 보여줍니다**
 * (CSS 에서 `.prac__tool__name` 을 되살립니다). 넓은 화면은 그림만 두고
 * 올려놓으면 이름표가 뜹니다.
 */

const TIP_W = 224;

export function ToolButton({
  icon,
  label,
  hint,
  pressed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  pressed: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [tip, setTip] = useState<{ left: number; top: number } | null>(null);

  const show = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // 오른쪽에 자리가 없으면 왼쪽으로 넘깁니다
    const right = r.right + 10;
    const left = right + TIP_W > window.innerWidth ? r.left - TIP_W - 10 : right;
    setTip({ left: Math.max(8, left), top: r.top + r.height / 2 });
  }, []);

  const hide = useCallback(() => setTip(null), []);

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="prac__tool prac__tool--icon"
        aria-pressed={pressed}
        // 이름표가 안 뜨는 상황(터치·느린 기기)에도 이름은 읽혀야 합니다
        aria-label={hint ? `${label} — ${hint}` : label}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => {
          hide();
          onClick();
        }}
      >
        {icon}
        <span className="prac__tool__name">{label}</span>
      </button>
      {tip &&
        createPortal(
          <span
            className="tooltip"
            role="presentation"
            style={{ left: tip.left, top: tip.top, width: TIP_W }}
          >
            <b>{label}</b>
            {hint && <i>{hint}</i>}
          </span>,
          document.body,
        )}
    </>
  );
}
