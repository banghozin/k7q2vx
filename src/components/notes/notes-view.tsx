"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { placementsOf } from "@/data/themes";
import {
  computeTrade,
  disciplineScore,
  reasonStats,
  useNotes,
  type Trade,
} from "@/lib/store/notes-store";
import { useChartModal } from "@/lib/store/chart-modal-store";
import { TradeForm } from "./trade-form";

const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;

type Tab = "open" | "closed" | "principles" | "stats";

const TABS: { key: Tab; label: string }[] = [
  { key: "open", label: "진행 중" },
  { key: "closed", label: "종료" },
  { key: "principles", label: "나의 원칙" },
  { key: "stats", label: "이유별 성적" },
];

export function NotesView() {
  const hydrated = useNotes((s) => s.hydrated);
  const trades = useNotes((s) => s.trades);
  const settings = useNotes((s) => s.settings);
  const setSettings = useNotes((s) => s.setSettings);
  const replaceAll = useNotes((s) => s.replaceAll);

  const [tab, setTab] = useState<Tab>("open");
  const [adding, setAdding] = useState(false);
  const [prefill, setPrefill] = useState<string | undefined>(undefined);

  /*
   * 분석 화면에서 "이 분석으로 매매 기록"을 누르면 `?new=1&ticker=NVDA` 로
   * 넘어옵니다. 폼을 펴 두고 종목도 미리 채워, 그린 것에서 기록까지 한 번에
   * 이어지게 합니다. 주소는 곧바로 지웁니다 — 새로고침할 때마다 폼이 다시
   * 열리면 성가십니다.
   */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.get("new")) return;
    setAdding(true);
    const t = q.get("ticker");
    if (t) setPrefill(t.toUpperCase());
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const open = trades.filter((t) => t.status === "open");
  const closed = trades.filter((t) => t.status === "closed");
  const discipline = disciplineScore(trades);

  // ④ 층 쏠림 — 지금 들고 있는 것들이 사실 같은 층인지
  const concentration = useMemo(() => {
    const byLayer = new Map<string, { n: number; cost: number }>();
    let totalCost = 0;
    for (const t of open) {
      const cost = t.entryPrice * t.qty;
      totalCost += cost;
      for (const p of placementsOf(t.ticker)) {
        const key = `${p.themeName} ${p.layerN}층 · ${p.layerName}`;
        const cur = byLayer.get(key) ?? { n: 0, cost: 0 };
        cur.n += 1;
        cur.cost += cost;
        byLayer.set(key, cur);
      }
    }
    return [...byLayer.entries()]
      .map(([label, v]) => ({
        label,
        n: v.n,
        pct: totalCost > 0 ? (v.cost / totalCost) * 100 : 0,
      }))
      .filter((x) => x.n >= 2)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
  }, [open]);

  if (!hydrated) return <div className="empty">불러오는 중…</div>;

  return (
    <>
      {/* 상단 계기판 */}
      <div className="readouts">
        <div className="readout">
          <div className="readout__label">진행 중</div>
          <div className="readout__value">{open.length}</div>
          <div className="readout__note">종료 {closed.length}건</div>
        </div>
        <div className="readout">
          <div className="readout__label">원칙 준수</div>
          <div className="readout__value">
            {discipline.total > 0
              ? `${discipline.kept}/${discipline.total}`
              : "—"}
          </div>
          <div className="readout__note">적어둔 손절가를 지킨 횟수</div>
        </div>
        <div className="readout">
          <div className="readout__label">계좌 총액</div>
          <div className="readout__value">
            <input
              type="number"
              inputMode="decimal"
              autoComplete="off"
              aria-label="계좌 총액 (달러)"
              value={settings.accountSize ?? ""}
              placeholder="예: 20000…"
              onChange={(e) =>
                setSettings({
                  accountSize: e.target.value ? Number(e.target.value) : null,
                })
              }
              style={{
                fontSize: "1.1rem",
                padding: ".1rem .3rem",
                border: "1px solid var(--rule-soft)",
              }}
            />
          </div>
          <div className="readout__note">
            손실이 계좌의 몇 %인지 계산하는 데만 씁니다
          </div>
        </div>
        <div className="readout">
          <div className="readout__label">백업</div>
          <div style={{ display: "flex", gap: ".35rem", marginTop: ".3rem" }}>
            <ExportButton />
            <ImportButton onLoad={replaceAll} />
          </div>
          <div className="readout__note">
            기기에만 저장됩니다. 브라우저를 지우면 사라집니다
          </div>
        </div>
      </div>

      {concentration.length > 0 && (
        <div className="caution" style={{ marginTop: "1.25rem" }}>
          <span className="caution__label">쏠림</span>
          <span>
            진행 중인 매매가 같은 층에 몰려 있습니다 —{" "}
            {concentration.map((c, i) => (
              <span key={c.label}>
                {i > 0 && ", "}
                <strong>{c.label}</strong> {c.n}건 · 투입액의 {c.pct.toFixed(0)}%
              </span>
            ))}
            . 종목을 나눠 담았어도 같은 층이면 같은 소식에 함께 움직입니다.
          </span>
        </div>
      )}

      {/* 새 기록 */}
      <div style={{ margin: "1.75rem 0 1.25rem" }}>
        {adding ? (
          <div
            style={{
              border: "1px solid var(--rule-strong)",
              padding: "1.25rem",
              background: "var(--ground-2)",
            }}
          >
            <h3 style={{ marginBottom: "1.25rem" }}>새 매매 기록</h3>
            <TradeForm
              initialTicker={prefill}
              onDone={() => {
                setAdding(false);
                setPrefill(undefined);
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setAdding(true)}
          >
            새 매매 기록하기
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="segmented" style={{ marginBottom: "1.25rem" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "open" &&
        (open.length ? (
          open.map((t) => <TradeCard key={t.id} trade={t} />)
        ) : (
          <div className="empty">
            진행 중인 매매가 없습니다. 위 버튼으로 기록을 시작하세요.
          </div>
        ))}

      {tab === "closed" &&
        (closed.length ? (
          closed.map((t) => <TradeCard key={t.id} trade={t} />)
        ) : (
          <div className="empty">종료된 매매가 없습니다.</div>
        ))}

      {tab === "principles" && <Principles />}
      {tab === "stats" && <ReasonStats trades={trades} />}
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * 진입한 날 그 종목에 무슨 기사가 있었는지.
 *
 * "내가 이 날 왜 샀지"에 답하는 부분입니다. 기억은 나중에 바뀌지만 기사는
 * 안 바뀝니다. 보관해 둔 기사에서 찾아오므로, 아카이브가 시작된 뒤의
 * 매매에만 나옵니다.
 */
function EntryDayNews({ ticker, day }: { ticker: string; day: string }) {
  const [items, setItems] = useState<
    { title: string; link: string; date: string }[] | null
  >(null);

  useEffect(() => {
    let alive = true;
    fetch(
      `/api/news?ticker=${encodeURIComponent(ticker)}&day=${encodeURIComponent(day)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setItems(j?.items ?? []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [ticker, day]);

  if (!items || items.length === 0) return null;

  return (
    <div style={{ marginTop: ".65rem" }}>
      <span className="layernews__label">진입한 날 이 종목이 나온 기사</span>
      <ul className="arcnews">
        {items.map((n) => (
          <li key={n.link}>
            <a href={n.link} target="_blank" rel="noreferrer">
              <span className="arcnews__title">{n.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TradeCard({ trade }: { trade: Trade }) {
  const settings = useNotes((s) => s.settings);
  const closeTrade = useNotes((s) => s.close);
  const remove = useNotes((s) => s.remove);
  const openChart = useChartModal((s) => s.open);
  const [closing, setClosing] = useState(false);

  const m = computeTrade(trade, settings.accountSize);
  const places = placementsOf(trade.ticker);

  return (
    <article
      style={{
        border: "1px solid var(--rule)",
        background: "var(--panel)",
        padding: "1rem 1.15rem",
        marginBottom: ".75rem",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: ".6rem",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="mono"
          onClick={() => openChart(trade.ticker, trade.name)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: "1.05rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {trade.ticker}
        </button>
        <span style={{ color: "var(--ink-3)", fontSize: ".85rem" }}>
          {trade.name}
        </span>
        <span className="tag">{trade.side === "long" ? "매수" : "매도"}</span>
        <span
          className="mono"
          style={{ marginLeft: "auto", fontSize: ".7rem", color: "var(--ink-4)" }}
        >
          {trade.entryDate}
          {trade.exitDate ? ` → ${trade.exitDate}` : ""}
        </span>
      </header>

      <div
        className="mono"
        style={{ fontSize: ".82rem", marginTop: ".5rem", color: "var(--ink-2)" }}
      >
        진입 {money(trade.entryPrice)} × {trade.qty}주 · 손절{" "}
        {money(trade.stopPrice)}
        {trade.targets.map((t, i) => (
          <span key={i}>
            {" "}
            · {i + 1}차 {money(t.price)} ({t.portion}%)
          </span>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1.25rem",
          marginTop: ".6rem",
          fontSize: ".8rem",
        }}
      >
        <span>
          <span style={{ color: "var(--ink-4)" }}>1R </span>
          <span className="mono">{m.r != null ? money(m.r) : "—"}</span>
        </span>
        <span>
          <span style={{ color: "var(--ink-4)" }}>최대손실 </span>
          <span className="mono down">
            {m.maxLoss != null ? money(m.maxLoss) : "—"}
            {m.maxLossPct != null && ` (${m.maxLossPct.toFixed(1)}%)`}
          </span>
        </span>
        <span>
          <span style={{ color: "var(--ink-4)" }}>손익비 </span>
          <span className="mono">
            {m.blendedR != null ? `${m.blendedR.toFixed(2)}R` : "—"}
          </span>
        </span>
        {m.realized && (
          <span>
            <span style={{ color: "var(--ink-4)" }}>결과 </span>
            <span className={`mono ${m.realized.pnl >= 0 ? "up" : "down"}`}>
              {money(m.realized.pnl)} · {m.realized.r.toFixed(2)}R
            </span>
          </span>
        )}
      </div>

      {(places.length > 0 || trade.reasons.length > 0) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: ".3rem",
            marginTop: ".65rem",
          }}
        >
          {places.map((p) => (
            <Link
              key={`${p.themeSlug}-${p.layerN}`}
              href={`/theme/${p.themeSlug}#layer-${p.layerN}`}
              className="tag"
              title={p.layerName}
            >
              {p.themeName} {p.layerN}F
            </Link>
          ))}
          {trade.reasons.map((r) => (
            <span key={r} className="tag tag--anchor">
              {r}
            </span>
          ))}
        </div>
      )}

      {trade.memo && (
        <p style={{ fontSize: ".84rem", color: "var(--ink-2)", marginBottom: 0 }}>
          {trade.memo}
        </p>
      )}

      {/*
       * 진입할 때 그려 뒀던 차트로 넘어가는 자리.
       * 그 화면은 최신 봉까지 다 그리므로, 그때 그은 선 위로 이후에 실제
       * 값이 어떻게 지나갔는지가 그대로 보입니다.
       */}
      {trade.chart && trade.chart.drawings.length > 0 && (
        <p style={{ marginTop: ".65rem", marginBottom: 0, fontSize: ".8rem" }}>
          <Link
            href={`/analyze?ticker=${trade.ticker}&tf=${trade.chart.tf}&trade=${trade.id}`}
            className="ilink"
          >
            그때 그린 차트 보기
          </Link>
          <span style={{ color: "var(--ink-4)" }}>
            {" "}
            — {trade.chart.tf} · 선 {trade.chart.drawings.length}개 ·{" "}
            {trade.chart.at.slice(0, 10)} 기준
            {trade.status === "closed" && " · 이후 실제 봉과 겹쳐 보입니다"}
          </span>
        </p>
      )}

      <EntryDayNews ticker={trade.ticker} day={trade.entryDate} />

      {trade.status === "closed" && (
        <div
          style={{
            marginTop: ".65rem",
            paddingTop: ".65rem",
            borderTop: "1px solid var(--rule-soft)",
            fontSize: ".82rem",
          }}
        >
          <span
            className="mono"
            style={{ color: trade.followedStop ? "var(--brass)" : "var(--down)" }}
          >
            손절가 {trade.followedStop ? "지킴" : "어김"}
          </span>
          {trade.review && (
            <p style={{ margin: ".35rem 0 0", color: "var(--ink-2)" }}>
              {trade.review}
            </p>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: ".4rem", marginTop: ".85rem" }}>
        {trade.status === "open" && (
          <button
            type="button"
            className="btn"
            style={{ fontSize: ".78rem", padding: ".3rem .6rem" }}
            onClick={() => setClosing((v) => !v)}
          >
            {closing ? "접기" : "청산 기록"}
          </button>
        )}
        <button
          type="button"
          className="btn btn--ghost"
          style={{ fontSize: ".78rem", padding: ".3rem .6rem" }}
          onClick={() => {
            if (confirm(`${trade.ticker} 기록을 지웁니다. 되돌릴 수 없습니다.`))
              remove(trade.id);
          }}
        >
          삭제
        </button>
      </div>

      {closing && (
        <CloseForm
          onSubmit={(exit) => {
            closeTrade(trade.id, exit);
            setClosing(false);
          }}
        />
      )}
    </article>
  );
}

function CloseForm({
  onSubmit,
}: {
  onSubmit: (v: {
    exitPrice: number;
    exitDate: string;
    followedStop: boolean;
    review: string;
  }) => void;
}) {
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [kept, setKept] = useState<boolean | null>(null);
  const [review, setReview] = useState("");

  const ready = Number(price) > 0 && kept !== null;

  return (
    <div
      style={{
        marginTop: ".85rem",
        paddingTop: ".85rem",
        borderTop: "1px solid var(--rule-soft)",
        display: "grid",
        gap: ".85rem",
      }}
    >
      <div className="grid2">
        <div className="field">
          <label>청산가 ($)</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="field">
          <label>청산일</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* ⑥ 원칙 위반 카운터 — 딱 하나만 묻습니다 */}
      <div className="field">
        <label>적어둔 손절가를 지켰습니까?</label>
        <div className="segmented">
          <button
            type="button"
            aria-pressed={kept === true}
            onClick={() => setKept(true)}
          >
            지켰다
          </button>
          <button
            type="button"
            aria-pressed={kept === false}
            onClick={() => setKept(false)}
          >
            어겼다
          </button>
        </div>
        <span className="hint">
          이 답만 모아 원칙 준수 횟수를 셉니다. 잘잘못을 따지지 않습니다.
        </span>
      </div>

      {/* ⑧ 한 줄 회고 */}
      <div className="field">
        <label>다시 한다면 무엇을 다르게 하겠습니까? · 선택</label>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          style={{ minHeight: "3.5rem" }}
        />
      </div>

      <div>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!ready}
          onClick={() =>
            onSubmit({
              exitPrice: Number(price),
              exitDate: date,
              followedStop: kept as boolean,
              review,
            })
          }
        >
          청산 기록하기
        </button>
      </div>
    </div>
  );
}

/* ⑦ 나만의 매매 원칙 */
function Principles() {
  const settings = useNotes((s) => s.settings);
  const setSettings = useNotes((s) => s.setSettings);
  const [text, setText] = useState(settings.principles.join("\n"));

  return (
    <div style={{ maxWidth: "62ch" }}>
      <p style={{ color: "var(--ink-3)", fontSize: ".88rem" }}>
        한 줄에 하나씩 적습니다. 새 매매를 기록할 때 이 목록이 폼 위에 그대로
        떠 있습니다. 원칙은 지킬 때가 아니라 어길 때 안 보이는 게 문제라서요.
      </p>
      <div className="field">
        <label>내 매매 원칙</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ minHeight: "12rem" }}
          placeholder={
            "손절가 없이 들어가지 않는다\n한 종목에 계좌의 5% 넘게 넣지 않는다\n같은 층에 세 종목 이상 담지 않는다\n남이 샀다는 이유만으로는 사지 않는다"
          }
        />
      </div>
      <button
        type="button"
        className="btn btn--primary"
        onClick={() =>
          setSettings({
            principles: text
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
      >
        저장
      </button>
    </div>
  );
}

/* ⑤ 이유별 본인 통계 */
function ReasonStats({ trades }: { trades: Trade[] }) {
  const rows = reasonStats(trades);
  if (rows.length === 0) {
    return (
      <div className="empty">
        종료된 매매가 쌓이면 여기에 이유별 성적이 나옵니다. 남이 해주는 조언보다
        본인 숫자가 셉니다.
      </div>
    );
  }
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>매매 이유</th>
            <th>건수</th>
            <th>이익으로 끝난 건</th>
            <th>합계 R</th>
            <th>평균 R</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tag}>
              <td data-label="매매 이유">{r.tag}</td>
              <td data-label="건수" className="mono">
                {r.total}
              </td>
              <td data-label="이익으로 끝난 건" className="mono">
                {r.win}
              </td>
              <td
                data-label="합계 R"
                className={`mono ${r.sumR >= 0 ? "up" : "down"}`}
              >
                {r.sumR.toFixed(2)}R
              </td>
              <td data-label="평균 R" className="mono">
                {(r.sumR / r.total).toFixed(2)}R
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ⑩ 백업 — 기기 저장이라 반드시 필요합니다 */
function ExportButton() {
  const trades = useNotes((s) => s.trades);
  const settings = useNotes((s) => s.settings);

  function run() {
    const blob = new Blob(
      [JSON.stringify({ version: 1, trades, settings }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `매매노트-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      className="btn"
      style={{ fontSize: ".75rem", padding: ".25rem .5rem" }}
      onClick={run}
    >
      내보내기
    </button>
  );
}

function ImportButton({
  onLoad,
}: {
  onLoad: (d: { trades: Trade[]; settings: ReturnType<typeof useNotes.getState>["settings"] }) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const j = JSON.parse(await f.text());
            if (Array.isArray(j.trades)) {
              onLoad({
                trades: j.trades,
                settings: j.settings ?? { accountSize: null, principles: [] },
              });
            }
          } catch {
            alert("파일을 읽지 못했습니다.");
          }
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="btn"
        style={{ fontSize: ".75rem", padding: ".25rem .5rem" }}
        onClick={() => ref.current?.click()}
      >
        가져오기
      </button>
    </>
  );
}
