"use client";

import { useState } from "react";
import {
  INDICATOR_SPECS,
  type IndicatorSpec,
  isValidParams,
  paramsOf,
  parseList,
} from "./indicator-catalog";
import type { IndTemplate } from "@/lib/store/chart-prefs-store";

/**
 * 보조지표 켜기·설정·묶음.
 *
 * 개수 제한은 없습니다 — 트레이딩뷰 무료판이 두 개로 묶어 둔 것이 이 화면을
 * 만든 이유입니다. 지표마다 ⚙ 를 누르면 기간을 바꿀 수 있고, 지금 켠 것과
 * 설정을 통째로 **묶음**으로 저장해 두었다가 한 번에 불러올 수 있습니다.
 */
export function IndicatorPanel({
  active,
  params,
  intraday,
  templates,
  onToggle,
  onParams,
  onSaveTemplate,
  onApplyTemplate,
  onRemoveTemplate,
}: {
  active: Set<string>;
  params: Record<string, number[]>;
  intraday: boolean;
  templates: IndTemplate[];
  onToggle: (key: string) => void;
  onParams: (key: string, v: number[] | null) => void;
  onSaveTemplate: (name: string) => void;
  onApplyTemplate: (t: IndTemplate) => void;
  onRemoveTemplate: (name: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [tplName, setTplName] = useState("");

  const group = (onCandle: boolean) => INDICATOR_SPECS.filter((s) => s.onCandle === onCandle);

  const row = (s: IndicatorSpec) => {
    const disabled = s.intradayOnly && !intraday;
    const on = active.has(s.key);
    const hasParams = s.params.length > 0 || Boolean(s.list);
    const cur = paramsOf(s.key, params);
    return (
      <li key={s.key}>
        <div className="ind__row">
          <button
            type="button"
            className="ind__toggle"
            aria-pressed={on}
            disabled={disabled}
            title={disabled ? `${s.hint} (지금 봉 단위에서는 뜻이 없습니다)` : s.hint}
            onClick={() => onToggle(s.key)}
          >
            <span className="ind__dot" aria-hidden="true" />
            <span>{s.label}</span>
            {hasParams && <span className="ind__val mono">{cur.join(",")}</span>}
          </button>
          {hasParams && (
            <button
              type="button"
              className="ind__gear"
              aria-label={`${s.label} 설정`}
              aria-expanded={open === s.key}
              onClick={() => setOpen((o) => (o === s.key ? null : s.key))}
            >
              ⚙
            </button>
          )}
        </div>
        {open === s.key && (
          <ParamEditor
            spec={s}
            value={cur}
            custom={Boolean(params[s.key])}
            onSave={(v) => {
              onParams(s.key, v);
              setOpen(null);
            }}
            onReset={() => {
              onParams(s.key, null);
              setOpen(null);
            }}
          />
        )}
      </li>
    );
  };

  return (
    <section>
      <h2>보조지표 {active.size > 0 && `${active.size}개`}</h2>
      <p className="ind__group">차트 위</p>
      <ul className="ind__list">{group(true).map(row)}</ul>
      <p className="ind__group">아래 판</p>
      <ul className="ind__list">{group(false).map(row)}</ul>
      <p className="prac__penhint">개수 제한 없음. 켜 둔 것과 설정은 다음에 들어와도 그대로입니다.</p>

      <h3 className="ind__sub">지표 묶음</h3>
      <form
        className="anz__alertform"
        onSubmit={(e) => {
          e.preventDefault();
          const n = tplName.trim();
          if (!n) return;
          onSaveTemplate(n);
          setTplName("");
        }}
      >
        <input
          className="anz__search"
          aria-label="지표 묶음 이름"
          placeholder="이름 (예: 스윙)"
          maxLength={30}
          value={tplName}
          onChange={(e) => setTplName(e.target.value)}
        />
        <button type="submit" className="btn btn--ghost" disabled={!tplName.trim() || active.size === 0}>
          저장
        </button>
      </form>
      {templates.length > 0 && (
        <ul className="anz__saves">
          {templates.map((t) => (
            <li key={t.name}>
              <button type="button" onClick={() => onApplyTemplate(t)} title="이 묶음으로 바꿉니다">
                <span>{t.name}</span>
                <span className="mono">{t.indicators.length}개</span>
              </button>
              <button
                type="button"
                className="anz__x"
                aria-label={`${t.name} 묶음 지우기`}
                onClick={() => onRemoveTemplate(t.name)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ParamEditor({
  spec,
  value,
  custom,
  onSave,
  onReset,
}: {
  spec: IndicatorSpec;
  value: number[];
  custom: boolean;
  onSave: (v: number[]) => void;
  onReset: () => void;
}) {
  const [text, setText] = useState(value.join(", "));
  const [fields, setFields] = useState(value.map(String));
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    if (spec.list) {
      const r = parseList(spec, text);
      if (typeof r === "string") return setErr(r);
      return onSave(r);
    }
    const nums = fields.map(Number);
    if (!isValidParams(spec, nums)) {
      const bad = spec.params.findIndex((p, i) => {
        const x = nums[i];
        return !Number.isFinite(x) || x < p.min || x > p.max || (!p.decimal && !Number.isInteger(x));
      });
      const p = spec.params[Math.max(0, bad)];
      return setErr(`${p.label}: ${p.min}~${p.max}${p.decimal ? "" : " 정수"}`);
    }
    onSave(nums);
  };

  return (
    <form
      className="ind__edit"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {spec.list ? (
        <label>
          <span>기간 (쉼표로, 최대 {spec.list.maxCount}개)</span>
          <input
            className="anz__search mono"
            value={text}
            autoFocus
            onChange={(e) => {
              setText(e.target.value);
              setErr(null);
            }}
          />
        </label>
      ) : (
        <div className="ind__fields">
          {spec.params.map((p, i) => (
            <label key={p.label}>
              <span>{p.label}</span>
              <input
                className="anz__search mono"
                inputMode={p.decimal ? "decimal" : "numeric"}
                value={fields[i] ?? ""}
                autoFocus={i === 0}
                onChange={(e) => {
                  const next = fields.slice();
                  next[i] = e.target.value;
                  setFields(next);
                  setErr(null);
                }}
              />
            </label>
          ))}
        </div>
      )}
      {err && <p className="ind__err" role="alert">{err}</p>}
      <div className="prac__row">
        <button type="submit" className="btn">
          적용
        </button>
        <button type="button" className="btn btn--ghost" onClick={onReset} disabled={!custom}>
          기본값
        </button>
      </div>
      <p className="prac__penhint">기본값 {spec.defaults.join(", ")}</p>
    </form>
  );
}
