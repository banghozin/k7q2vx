"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { YScale } from "@/lib/store/chart-prefs-store";

/**
 * 차트 우클릭 메뉴.
 *
 * 트레이딩뷰에서 차트를 오른쪽 단추로 누르면 뜨는 것과 같은 자리입니다.
 * 옆 서랍에도 같은 단추가 있지만, 차트를 보다가 손을 옮기지 않고 바로
 * 바꾸는 쪽이 빠릅니다. 특히 **누른 자리의 가격**을 쓰는 일(그 가격에
 * 수평선·알림)은 서랍에서는 가격을 직접 쳐야 해서 번거로웠습니다.
 *
 * 휴대폰에는 오른쪽 단추가 없으므로 같은 설정을 서랍에도 그대로 둡니다.
 */

export type ChartMenuState = {
  /** 차트 칸 왼쪽 위 기준 좌표 */
  x: number;
  y: number;
  /** 누른 자리의 가격 — 캔들 판 밖(아래 지표 판 등)이면 null */
  price: number | null;
  /** 그림을 눌렀으면 그 그림 */
  drawing: { id: string; label: string; locked: boolean } | null;
};

const SCALES: [YScale, string][] = [
  ["normal", "보통"],
  ["logarithm", "로그"],
  ["percentage", "%"],
];

export function fmtPrice(v: number) {
  return Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(4);
}

export function ChartMenu({
  menu,
  lastPrice,
  yScale,
  priceLock,
  invert,
  onClose,
  onHLine,
  onAlert,
  onReset,
  onAutoFit,
  onScale,
  onPriceLock,
  onInvert,
  onClone,
  onLock,
  onRemove,
}: {
  menu: ChartMenuState;
  lastPrice: number | null;
  yScale: YScale;
  priceLock: boolean;
  invert: boolean;
  onClose: () => void;
  onHLine: (price: number) => void;
  onAlert: (price: number) => void;
  onReset: () => void;
  onAutoFit: () => void;
  onScale: (v: YScale) => void;
  onPriceLock: (v: boolean) => void;
  onInvert: (v: boolean) => void;
  onClone: () => void;
  onLock: () => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });
  const [copied, setCopied] = useState(false);

  /*
   * 차트 칸 밖으로 삐져나가지 않게 자리를 맞춥니다. 오른쪽 끝·아래 끝에서
   * 누르면 메뉴를 왼쪽·위로 펼칩니다. 크기는 그려 봐야 알 수 있어 그린 직후에 잽니다.
   */
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.offsetParent as HTMLElement | null;
    if (!el || !box) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const W = box.clientWidth;
    const H = box.clientHeight;
    let left = menu.x + 2;
    let top = menu.y + 2;
    if (left + w > W - 4) left = Math.max(4, menu.x - w - 2);
    if (top + h > H - 4) top = Math.max(4, H - h - 4);
    setPos({ left, top });
    // 키보드로도 고를 수 있게 첫 항목에 초점을 둡니다
    el.querySelector<HTMLElement>("[role^='menuitem']")?.focus();
  }, [menu.x, menu.y]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLElement>("[role^='menuitem']:not([disabled])") ?? [],
    );
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[n]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      onClose();
    }
  };

  /** 누르면 그 일을 하고 닫힙니다 */
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const p = menu.price;
  const dirWord = p != null && lastPrice != null && p < lastPrice ? "내려서면" : "올라서면";

  return (
    <div
      ref={ref}
      className="cmenu"
      role="menu"
      aria-label="차트 메뉴"
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.drawing && (
        <div className="cmenu__group" role="group" aria-label={menu.drawing.label}>
          <div className="cmenu__head">{menu.drawing.label}</div>
          <button type="button" role="menuitem" className="cmenu__item" onClick={act(onClone)}>
            복제<kbd>Ctrl+D</kbd>
          </button>
          {!menu.drawing.locked && (
            <button type="button" role="menuitem" className="cmenu__item" onClick={act(onLock)}>
              잠그기<kbd>Alt+L</kbd>
            </button>
          )}
          <button type="button" role="menuitem" className="cmenu__item" onClick={act(onRemove)}>
            지우기<kbd>Del</kbd>
          </button>
        </div>
      )}

      {p != null && (
        <div className="cmenu__group" role="group" aria-label={`가격 ${fmtPrice(p)}`}>
          <div className="cmenu__head mono">{fmtPrice(p)}</div>
          <button type="button" role="menuitem" className="cmenu__item" onClick={act(() => onHLine(p))}>
            이 가격에 수평선
          </button>
          <button type="button" role="menuitem" className="cmenu__item" onClick={act(() => onAlert(p))}>
            이 가격에 알림
            <span className="cmenu__sub">{dirWord} 울림</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="cmenu__item"
            onClick={() => {
              navigator.clipboard
                ?.writeText(fmtPrice(p))
                .then(() => {
                  setCopied(true);
                  setTimeout(onClose, 450);
                })
                .catch(onClose);
            }}
          >
            {copied ? "복사했습니다" : "가격 복사"}
          </button>
        </div>
      )}

      <div className="cmenu__group" role="group" aria-label="화면">
        <button type="button" role="menuitem" className="cmenu__item" onClick={act(onReset)}>
          차트 처음 화면으로
        </button>
        <button type="button" role="menuitem" className="cmenu__item" onClick={act(onAutoFit)}>
          가격 눈금 자동 맞춤
          <span className="cmenu__sub">눈금을 끌어 늘였을 때</span>
        </button>
      </div>

      <div className="cmenu__group" role="group" aria-label="가격 눈금">
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={priceLock}
          className="cmenu__item cmenu__check"
          onClick={act(() => onPriceLock(!priceLock))}
        >
          가격·봉 비율 고정
          <span className="cmenu__sub">확대·축소해도 모양 그대로</span>
        </button>
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={invert}
          className="cmenu__item cmenu__check"
          onClick={act(() => onInvert(!invert))}
        >
          눈금 뒤집기
        </button>
        <div className="cmenu__scales" role="group" aria-label="눈금 종류">
          {SCALES.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="menuitemradio"
              aria-checked={yScale === k}
              className="cmenu__scale"
              onClick={act(() => onScale(k))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
