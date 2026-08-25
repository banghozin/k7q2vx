"use client";

import { useEffect, useState } from "react";
import type { Layer } from "@/data/types";

/**
 * 층 바로가기 + 지금 보고 있는 화면 링크 복사.
 *
 * 주소창에 #layer-5 처럼 위치가 박히므로, 링크 하나를 보내면 받는 사람도
 * 정확히 그 층이 열린 화면부터 보게 됩니다. 지도 서비스가 줌·좌표를 주소에
 * 넣는 것과 같은 방식입니다.
 */
export function ShareLayerLink({ layers }: { layers: Layer[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // 스크롤에 따라 지금 보이는 층을 표시하고 주소창을 조용히 갱신합니다.
  useEffect(() => {
    const sections = layers
      .map((l) => document.getElementById(`layer-${l.n}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const n = Number(visible.target.id.replace("layer-", ""));
        setActive(n);
        const next = `#layer-${n}`;
        if (window.location.hash !== next) {
          window.history.replaceState(null, "", next);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.5] },
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [layers]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const topDown = [...layers].sort((a, b) => b.n - a.n);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: ".3rem",
        alignItems: "center",
        margin: "1.25rem 0 0",
      }}
    >
      {topDown.map((l) => (
        <a
          key={l.key}
          href={`#layer-${l.n}`}
          className="tag"
          style={
            active === l.n
              ? { color: "var(--accent)", borderColor: "var(--accent)" }
              : undefined
          }
          title={l.role}
        >
          {String(l.n).padStart(2, "0")}F {l.name}
        </a>
      ))}
      <button
        type="button"
        className="btn btn--ghost"
        style={{ marginLeft: "auto", fontSize: ".78rem", padding: ".3rem .6rem" }}
        onClick={copy}
      >
        {copied ? "복사했습니다" : "이 화면 링크 복사"}
      </button>
    </div>
  );
}
