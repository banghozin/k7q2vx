"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useChartModal } from "@/lib/store/chart-modal-store";
import { useNotes } from "@/lib/store/notes-store";
import { nameOf, placementsOf } from "@/data/themes";
import { CandleChart, type Candle, type TradeMarker } from "./candle-chart";
import { StarButton } from "./star-button";

const RANGES = [
  { key: "3mo", label: "3개월" },
  { key: "6mo", label: "6개월" },
  { key: "1y", label: "1년" },
  { key: "2y", label: "2년" },
] as const;

type Payload = {
  candles: Candle[];
  last: number | null;
  changePct: number | null;
  exchange: string | null;
};

export function ChartModal() {
  const ticker = useChartModal((s) => s.ticker);
  const name = useChartModal((s) => s.name);
  const close = useChartModal((s) => s.close);
  const openModal = useChartModal((s) => s.open);
  const trades = useNotes((s) => s.trades);

  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("1y");
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // 주소에 ?stock=NVDA 가 붙어 있으면 그 종목 차트가 열린 채로 시작합니다.
  // 링크 하나로 "이 종목 보고 있는 화면"을 그대로 넘길 수 있습니다.
  const openRef = useRef(openModal);
  openRef.current = openModal;
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("stock");
    if (t) openRef.current(t, nameOf(t) ?? t.toUpperCase());
  }, []);

  // 열고 닫힐 때 주소를 맞춰 줍니다.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (ticker) url.searchParams.set("stock", ticker);
    else url.searchParams.delete("stock");
    window.history.replaceState(null, "", url.toString());
  }, [ticker]);

  useEffect(() => {
    if (!ticker) return;
    let alive = true;
    setState("loading");
    setData(null);
    fetch(`/api/chart?ticker=${encodeURIComponent(ticker)}&interval=1d&range=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("실패"))))
      .then((j: Payload) => {
        if (!alive) return;
        setData(j);
        setState("idle");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [ticker, range]);

  // Esc로 닫기 + 배경 스크롤 잠금 + 초점 이동과 복귀
  useEffect(() => {
    if (!ticker) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreRef.current?.focus?.();
    };
  }, [ticker, close]);

  // 내가 산 자리 · 판 자리
  const markers = useMemo<TradeMarker[]>(() => {
    if (!ticker) return [];
    const out: TradeMarker[] = [];
    for (const t of trades) {
      if (t.ticker !== ticker) continue;
      const e = Date.parse(`${t.entryDate}T00:00:00Z`);
      if (!Number.isNaN(e)) {
        out.push({ time: Math.floor(e / 1000), kind: "entry", text: "진입" });
      }
      if (t.exitDate) {
        const x = Date.parse(`${t.exitDate}T00:00:00Z`);
        if (!Number.isNaN(x)) {
          out.push({ time: Math.floor(x / 1000), kind: "exit", text: "청산" });
        }
      }
    }
    return out;
  }, [ticker, trades]);

  const places = ticker ? placementsOf(ticker) : [];

  if (!ticker) return null;

  const up = (data?.changePct ?? 0) >= 0;

  return (
    <div
      className="scrim"
      role="dialog"
      aria-modal="true"
      aria-label={`${ticker} 상세`}
      onClick={close}
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div style={{ position: "relative", paddingRight: "2rem" }}>
            <div
              style={{ display: "flex", alignItems: "baseline", gap: ".55rem" }}
            >
              <span
                className="mono"
                style={{ fontSize: "1.25rem", fontWeight: 600 }}
              >
                {ticker}
              </span>
              <span style={{ color: "var(--ink-3)", fontSize: ".85rem" }}>
                {name}
              </span>
            </div>
            {data?.last != null && (
              <div
                className="mono"
                style={{ fontSize: ".85rem", marginTop: ".15rem" }}
              >
                ${data.last.toFixed(2)}
                {data.changePct != null && (
                  <span className={up ? "up" : "down"}>
                    {" "}
                    {up ? "+" : ""}
                    {data.changePct.toFixed(2)}%
                  </span>
                )}
                <span style={{ color: "var(--ink-4)" }}> · 전일 종가 기준</span>
              </div>
            )}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: ".5rem" }}>
            <div style={{ position: "relative", width: "1.75rem" }}>
              <StarButton ticker={ticker} name={name ?? ticker} />
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              className="iconbtn"
              onClick={close}
              aria-label="차트 닫기"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>

        <div className="sheet__body">
          <div className="segmented" style={{ marginBottom: ".9rem" }}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={range === r.key}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>

          {state === "loading" && (
            <div className="empty">시세를 불러오는 중입니다…</div>
          )}
          {state === "error" && (
            <div className="empty">
              시세를 불러오지 못했습니다. 잠시 뒤 다시 열어 보세요.
            </div>
          )}
          {state === "idle" && data && data.candles.length > 0 && (
            <CandleChart candles={data.candles} markers={markers} />
          )}

          {markers.length > 0 && (
            <p style={{ fontSize: ".76rem", color: "var(--ink-4)", margin: ".5rem 0 0" }}>
              차트의 화살표는 매매노트에 적어 둔 진입·청산 날짜입니다.
            </p>
          )}

          <div style={{ marginTop: "1.5rem" }}>
            <h4
              className="mono"
              style={{
                fontSize: ".64rem",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
                marginBottom: ".6rem",
              }}
            >
              이 종목이 올라 있는 층
            </h4>
            {places.map((p) => (
              <Link
                key={`${p.themeSlug}-${p.layerN}`}
                href={`/theme/${p.themeSlug}#layer-${p.layerN}`}
                onClick={close}
                style={{
                  display: "block",
                  padding: ".6rem 0",
                  borderTop: "1px solid var(--rule-soft)",
                  textDecoration: "none",
                }}
              >
                <div className="mono" style={{ fontSize: ".66rem", color: "var(--ink-4)" }}>
                  {p.themeName} · {p.layerN}층 {p.layerName}
                </div>
                <div style={{ fontSize: ".85rem", color: "var(--ink-2)" }}>
                  {p.stock.why}
                </div>
              </Link>
            ))}
          </div>

          <p
            style={{
              marginTop: "1.5rem",
              fontSize: ".76rem",
              color: "var(--ink-4)",
            }}
          >
            시세는 Yahoo Finance 기준이며 지연될 수 있습니다. 이 화면은 매수·매도
            의견이 아닙니다.
          </p>
        </div>
      </div>
    </div>
  );
}
