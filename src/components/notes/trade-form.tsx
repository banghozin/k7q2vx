"use client";

import { useMemo, useState } from "react";
import { placementsOf, searchStocks } from "@/data/themes";
import {
  REASON_TAGS,
  computeTrade,
  useNotes,
  type ReasonTag,
} from "@/lib/store/notes-store";

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

type Draft = {
  ticker: string;
  name: string;
  side: "long" | "short";
  entryPrice: string;
  entryDate: string;
  qty: string;
  stopPrice: string;
  t1Price: string;
  t1Portion: string;
  t2Price: string;
  t2Portion: string;
  reasons: ReasonTag[];
  memo: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyDraft = (): Draft => ({
  ticker: "",
  name: "",
  side: "long",
  entryPrice: "",
  entryDate: today(),
  qty: "",
  stopPrice: "",
  t1Price: "",
  t1Portion: "50",
  t2Price: "",
  t2Portion: "50",
  reasons: [],
  memo: "",
});

const num = (s: string) => {
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
};

export function TradeForm({ onDone }: { onDone: () => void }) {
  const add = useNotes((s) => s.add);
  const settings = useNotes((s) => s.settings);

  const [d, setD] = useState<Draft>(emptyDraft);
  const [query, setQuery] = useState("");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  const hits = useMemo(
    () => (query.trim() && !d.ticker ? searchStocks(query, 8) : []),
    [query, d.ticker],
  );

  // 자동 태깅 — 종목을 고르는 순간 그 종목이 올라 있는 층이 전부 붙습니다.
  const places = d.ticker ? placementsOf(d.ticker) : [];

  const math = useMemo(
    () =>
      computeTrade(
        {
          entryPrice: num(d.entryPrice),
          stopPrice: num(d.stopPrice),
          qty: num(d.qty),
          side: d.side,
          status: "open",
          targets: [
            { price: num(d.t1Price), portion: num(d.t1Portion) },
            { price: num(d.t2Price), portion: num(d.t2Portion) },
          ].filter((t) => t.price > 0),
        },
        settings.accountSize,
      ),
    [d, settings.accountSize],
  );

  // ① 진입 전 잠금 — 이 다섯 가지가 없으면 저장 버튼이 열리지 않습니다.
  const missing: string[] = [];
  if (!d.ticker) missing.push("종목");
  if (num(d.entryPrice) <= 0) missing.push("진입가");
  if (num(d.qty) <= 0) missing.push("수량");
  if (num(d.stopPrice) <= 0) missing.push("손절가");
  if (num(d.t1Price) <= 0) missing.push("1차 익절가");
  if (math.r == null && d.entryPrice && d.stopPrice) {
    missing.push(
      d.side === "long" ? "손절가는 진입가보다 낮아야" : "손절가는 진입가보다 높아야",
    );
  }
  const ready = missing.length === 0;

  function save() {
    if (!ready) return;
    add({
      ticker: d.ticker,
      name: d.name,
      side: d.side,
      entryPrice: num(d.entryPrice),
      entryDate: d.entryDate || today(),
      qty: num(d.qty),
      stopPrice: num(d.stopPrice),
      targets: [
        { price: num(d.t1Price), portion: num(d.t1Portion) },
        { price: num(d.t2Price), portion: num(d.t2Portion) },
      ].filter((t) => t.price > 0),
      reasons: d.reasons,
      memo: d.memo,
    });
    onDone();
  }

  const riskWarn =
    math.maxLossPct != null && math.maxLossPct > 2
      ? `이 한 건이 계좌의 ${math.maxLossPct.toFixed(1)}% 입니다.`
      : null;

  return (
    <div
      style={{
        display: "grid",
        gap: "1.75rem",
        gridTemplateColumns: "minmax(0,1fr)",
      }}
    >
      {/* ⑦ 나만의 원칙 — 기록하는 내내 옆에 떠 있습니다 */}
      {settings.principles.length > 0 && (
        <div className="caution">
          <span className="caution__label">내 원칙</span>
          <span>
            {settings.principles.map((p, i) => (
              <span key={i} style={{ display: "block" }}>
                {i + 1}. {p}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* 종목 */}
      <div className="field">
        <label htmlFor="tf-ticker">종목</label>
        {d.ticker ? (
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
            <span className="mono" style={{ fontSize: "1.05rem", fontWeight: 600 }}>
              {d.ticker}
            </span>
            <span style={{ color: "var(--ink-3)", fontSize: ".85rem" }}>
              {d.name}
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ padding: ".2rem .5rem", fontSize: ".75rem" }}
              onClick={() => {
                set("ticker", "");
                set("name", "");
                setQuery("");
              }}
            >
              바꾸기
            </button>
          </div>
        ) : (
          <>
            <input
              id="tf-ticker"
              type="text"
              value={query}
              placeholder="티커나 회사 이름 — 예: NVDA, 엔비디아, 아이렌…"
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {hits.length > 0 && (
              <div
                style={{
                  border: "1px solid var(--rule-strong)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                {hits.map((h) => (
                  <button
                    key={h.ticker}
                    type="button"
                    onClick={() => {
                      set("ticker", h.ticker);
                      set("name", h.stock.name);
                    }}
                    style={{
                      display: "flex",
                      gap: ".5rem",
                      alignItems: "baseline",
                      width: "100%",
                      textAlign: "left",
                      padding: ".45rem .6rem",
                      background: "var(--panel)",
                      border: "none",
                      borderBottom: "1px solid var(--rule-soft)",
                      cursor: "pointer",
                    }}
                  >
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {h.ticker}
                    </span>
                    <span style={{ color: "var(--ink-3)", fontSize: ".82rem" }}>
                      {h.stock.name}
                    </span>
                    <span
                      className="mono"
                      style={{
                        marginLeft: "auto",
                        fontSize: ".65rem",
                        color: "var(--ink-4)",
                      }}
                    >
                      {h.themeName} {h.layerN}F
                    </span>
                  </button>
                ))}
              </div>
            )}
            <span className="hint">
              여기 없는 종목도 곧 직접 입력할 수 있게 넣겠습니다. 지금은 지도에
              올라 있는 종목만 고를 수 있습니다.
            </span>
          </>
        )}
      </div>

      {/* ④ 자동 태깅 */}
      {places.length > 0 && (
        <div>
          <div
            className="mono"
            style={{
              fontSize: ".64rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--ink-4)",
              marginBottom: ".4rem",
            }}
          >
            자동으로 붙은 층 태그
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".3rem" }}>
            {places.map((p) => (
              <span
                key={`${p.themeSlug}-${p.layerN}`}
                className="tag"
                title={p.stock.why}
              >
                {p.themeName} {p.layerN}F · {p.layerName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 방향 */}
      <div className="field">
        <label>방향</label>
        <div className="segmented">
          <button
            type="button"
            aria-pressed={d.side === "long"}
            onClick={() => set("side", "long")}
          >
            매수(롱)
          </button>
          <button
            type="button"
            aria-pressed={d.side === "short"}
            onClick={() => set("side", "short")}
          >
            매도(숏)
          </button>
        </div>
      </div>

      {/* 진입 */}
      <div className="grid3">
        <div className="field">
          <label htmlFor="tf-entry">진입가 ($)</label>
          <input
            id="tf-entry"
            type="number"
            step="0.01"
            value={d.entryPrice}
            onChange={(e) => set("entryPrice", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="tf-qty">수량 (주)</label>
          <input
            id="tf-qty"
            type="number"
            step="1"
            value={d.qty}
            onChange={(e) => set("qty", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="tf-date">진입일</label>
          <input
            id="tf-date"
            type="date"
            value={d.entryDate}
            onChange={(e) => set("entryDate", e.target.value)}
          />
        </div>
      </div>

      {/* 손절 · 익절 */}
      <div className="grid3">
        <div className="field">
          <label htmlFor="tf-stop">손절가 ($)</label>
          <input
            id="tf-stop"
            type="number"
            step="0.01"
            value={d.stopPrice}
            onChange={(e) => set("stopPrice", e.target.value)}
          />
          <span className="hint">여기까지의 거리가 1R이 됩니다.</span>
        </div>
        <div className="field">
          <label htmlFor="tf-t1">1차 익절가 ($)</label>
          <input
            id="tf-t1"
            type="number"
            step="0.01"
            value={d.t1Price}
            onChange={(e) => set("t1Price", e.target.value)}
          />
          <input
            type="number"
            step="5"
            min="0"
            max="100"
            value={d.t1Portion}
            onChange={(e) => set("t1Portion", e.target.value)}
            aria-label="1차 익절 비중 %"
          />
          <span className="hint">비중 %. 절반 익절이면 50.</span>
        </div>
        <div className="field">
          <label htmlFor="tf-t2">2차 익절가 ($) · 선택</label>
          <input
            id="tf-t2"
            type="number"
            step="0.01"
            value={d.t2Price}
            onChange={(e) => set("t2Price", e.target.value)}
          />
          <input
            type="number"
            step="5"
            min="0"
            max="100"
            value={d.t2Portion}
            onChange={(e) => set("t2Portion", e.target.value)}
            aria-label="2차 익절 비중 %"
          />
          <span className="hint">
            비중 합계 {math.portionSum}%
            {math.portionSum > 100 && " — 100%를 넘었습니다"}
          </span>
        </div>
      </div>

      {/* ②③ 계산 결과 */}
      <div className="readouts">
        <div className="readout">
          <div className="readout__label">1R (주당 위험)</div>
          <div className="readout__value">
            {math.r != null ? money(math.r) : "—"}
          </div>
          <div className="readout__note">진입가와 손절가의 거리</div>
        </div>
        <div className="readout">
          <div className="readout__label">최대 손실</div>
          <div className="readout__value" style={{ color: "var(--down)" }}>
            {math.maxLoss != null ? money(math.maxLoss) : "—"}
          </div>
          <div className="readout__note">
            {math.maxLossPct != null
              ? `계좌의 ${math.maxLossPct.toFixed(2)}%`
              : "계좌 총액을 적으면 비중이 나옵니다"}
          </div>
        </div>
        <div className="readout">
          <div className="readout__label">투입 금액</div>
          <div className="readout__value">
            {math.cost != null ? money(math.cost) : "—"}
          </div>
          <div className="readout__note">진입가 × 수량</div>
        </div>
        <div className="readout">
          <div className="readout__label">손익비</div>
          <div className="readout__value">
            {math.blendedR != null ? `${math.blendedR.toFixed(2)}R` : "—"}
          </div>
          <div className="readout__note">
            {math.targetR
              .map((t, i) => `${i + 1}차 ${t.r.toFixed(2)}R`)
              .join(" · ") || "익절가를 적으면 계산됩니다"}
          </div>
        </div>
      </div>

      {riskWarn && (
        <div className="caution">
          <span className="caution__label">확인</span>
          <span>
            {riskWarn} 계좌 대비 감당할 수 있는 크기인지 본인 원칙에 비추어
            확인하세요. 이 화면은 적정 비중을 제시하지 않습니다.
          </span>
        </div>
      )}

      {math.blendedR != null && math.blendedR < 1 && (
        <div className="caution">
          <span className="caution__label">확인</span>
          <span>
            적어 넣은 목표가 기준 손익비가 <strong>1R 미만</strong>입니다. 잃을 수
            있는 금액이 벌 수 있는 금액보다 크다는 뜻입니다 — 본인이 적은 숫자의
            산수입니다.
          </span>
        </div>
      )}

      {/* ⑤ 매매 이유 */}
      <div className="field">
        <label>매매 이유</label>
        <div className="checks">
          {REASON_TAGS.map((tag) => (
            <label key={tag} className="check">
              <input
                type="checkbox"
                checked={d.reasons.includes(tag)}
                onChange={(e) =>
                  set(
                    "reasons",
                    e.target.checked
                      ? [...d.reasons, tag]
                      : d.reasons.filter((x) => x !== tag),
                  )
                }
              />
              {tag}
            </label>
          ))}
        </div>
        <span className="hint">
          솔직하게 고를수록 나중에 본인 통계가 쓸모 있어집니다.
        </span>
      </div>

      <div className="field">
        <label htmlFor="tf-memo">메모</label>
        <textarea
          id="tf-memo"
          value={d.memo}
          placeholder="무엇을 보고 들어갔는지, 어떤 조건이 깨지면 나올 것인지."
          onChange={(e) => set("memo", e.target.value)}
        />
      </div>

      <div
        style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}
      >
        <button
          type="button"
          className="btn btn--primary"
          disabled={!ready}
          onClick={save}
        >
          기록하기
        </button>
        <button type="button" className="btn" onClick={onDone}>
          취소
        </button>
        {!ready && (
          <span style={{ fontSize: ".8rem", color: "var(--ink-4)" }}>
            남은 항목 — {missing.join(", ")}
          </span>
        )}
      </div>
    </div>
  );
}
