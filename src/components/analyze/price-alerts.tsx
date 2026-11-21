"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_ALERTS, useAlerts } from "@/lib/store/alerts-store";

/**
 * 가격 알림.
 *
 * 지정한 가격에 닿으면 브라우저 알림(허락한 경우)과 화면 안 쪽지로 알려 줍니다.
 *
 * ⚠️ **이 화면을 열어 둔 동안만** 1분마다 확인합니다. 서버가 없는 사이트라
 * 창을 닫으면 지켜볼 것이 없습니다 — 화면에도 그렇게 적어 둡니다.
 *
 * 확인할 때 "지금 값" 하나만 보면 1분 사이에 찍고 돌아온 것을 놓칩니다.
 * 그래서 **알림을 만든 뒤의 1분봉 고가·저가**를 봅니다. 장전·장후도 셉니다.
 */

const POLL_MS = 60_000;

type Toast = { id: string; text: string };

export function PriceAlerts({
  ticker,
  lastPrice,
  pickedLevel,
}: {
  ticker: string;
  /** 지금 차트의 마지막 가격 — 방향(위로/아래로)을 정하는 데 씁니다 */
  lastPrice: number | null;
  /** 골라 둔 수평선의 가격. 있으면 "이 선에 알림" 단추가 생깁니다 */
  pickedLevel: number | null;
}) {
  const alerts = useAlerts((s) => s.alerts);
  const hydrated = useAlerts((s) => s.hydrated);
  const add = useAlerts((s) => s.add);
  const remove = useAlerts((s) => s.remove);
  const fire = useAlerts((s) => s.fire);
  const clearFired = useAlerts((s) => s.clearFired);
  const [price, setPrice] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [perm, setPerm] = useState<NotificationPermission | "none">("none");

  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
  }, []);

  const active = alerts.filter((a) => !a.firedAt);
  const fired = alerts.filter((a) => a.firedAt);

  const create = (p: number) => {
    if (!Number.isFinite(p) || p <= 0) return;
    const dir = lastPrice != null && p < lastPrice ? "below" : "above";
    add({ ticker, price: Math.round(p * 100) / 100, dir });
    setPrice("");
    // 처음 만들 때 한 번만 허락을 묻습니다. 거절해도 화면 안 쪽지는 뜹니다
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then(setPerm).catch(() => {});
    }
  };

  /* ── 1분마다 확인 ── */
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  useEffect(() => {
    if (!hydrated) return;
    let stop = false;

    const check = async () => {
      const list = alertsRef.current.filter((a) => !a.firedAt);
      const tickers = [...new Set(list.map((a) => a.ticker))];
      for (const t of tickers) {
        if (stop) return;
        try {
          const r = await fetch(
            `/api/chart?ticker=${encodeURIComponent(t)}&interval=1m&range=1d&prepost=1&fresh=1`,
          );
          if (!r.ok) continue;
          const j = (await r.json()) as {
            candles?: { time: number; high: number; low: number; close: number }[];
          };
          const bars = j.candles ?? [];
          if (bars.length === 0) continue;
          for (const a of list.filter((x) => x.ticker === t)) {
            const since = Date.parse(a.createdAt) / 1000 - 60;
            const after = bars.filter((b) => b.time >= since);
            const hit =
              a.dir === "above"
                ? after.find((b) => b.high >= a.price)
                : after.find((b) => b.low <= a.price);
            if (!hit) continue;
            fire(a.id, hit.close);
            const text = `${a.ticker} ${a.price} ${a.dir === "above" ? "위로 올라섬" : "아래로 내려섬"} (지금 ${bars.at(-1)!.close.toFixed(2)})`;
            setToasts((s) => [{ id: a.id, text }, ...s].slice(0, 4));
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              try {
                new Notification("가격 알림", { body: text, tag: a.id });
              } catch {
                // 일부 휴대폰 브라우저는 페이지에서 직접 띄우는 알림을 막습니다
              }
            }
          }
        } catch {
          // 한 번 실패는 다음 분에 다시 봅니다
        }
      }
    };

    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [hydrated, fire]);

  return (
    <section>
      <h2>가격 알림 {active.length > 0 && `${active.length}개`}</h2>
      <form
        className="anz__alertform"
        onSubmit={(e) => {
          e.preventDefault();
          create(Number(price));
        }}
      >
        <input
          className="anz__search"
          inputMode="decimal"
          aria-label={`${ticker} 알림 가격`}
          placeholder={lastPrice ? `가격 (지금 ${lastPrice.toFixed(2)})` : "가격"}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button type="submit" className="btn btn--ghost" disabled={!price || active.length >= MAX_ALERTS}>
          추가
        </button>
      </form>
      {pickedLevel != null && (
        <button type="button" className="btn btn--ghost anz__wide" onClick={() => create(pickedLevel)}>
          고른 선({pickedLevel.toFixed(2)})에 알림
        </button>
      )}
      {active.length > 0 && (
        <ul className="anz__saves">
          {active.map((a) => (
            <li key={a.id}>
              <span className="anz__alertrow">
                <span className="mono">{a.ticker}</span>
                <span>
                  {a.dir === "above" ? "↑" : "↓"} {a.price}
                </span>
              </span>
              <button type="button" className="anz__x" aria-label={`${a.ticker} ${a.price} 알림 지우기`} onClick={() => remove(a.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {fired.length > 0 && (
        <>
          <ul className="anz__saves anz__fired">
            {fired.slice(0, 6).map((a) => (
              <li key={a.id}>
                <span className="anz__alertrow">
                  <span className="mono">{a.ticker}</span>
                  <span>
                    {a.price} 울림 · {new Date(a.firedAt!).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--ghost anz__wide" onClick={clearFired}>
            울린 것 지우기
          </button>
        </>
      )}
      <p className="prac__penhint">
        <strong>이 화면을 열어 둔 동안만</strong> 1분마다 확인합니다. 창을 닫으면
        울리지 않습니다.
        {perm === "denied" && " 브라우저 알림이 막혀 있어 화면 안에만 표시됩니다."}
      </p>

      {/* 울린 알림 — 화면 낭독기도 읽도록 live 영역에 둡니다 */}
      <div className="anz__toasts" aria-live="assertive">
        {toasts.map((t) => (
          <div key={t.id} className="anz__toast" role="alert">
            <span>
              <b>가격 알림</b> {t.text}
            </span>
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setToasts((s) => s.filter((x) => x.id !== t.id))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
