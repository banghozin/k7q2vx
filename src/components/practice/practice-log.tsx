"use client";

import { useEffect, useRef } from "react";
import { pct, tone } from "@/lib/format";
import { toolTotals, usePractice } from "@/lib/store/practice-store";

/**
 * 지난 훈련 기록.
 *
 * 맨 위에 **내가 무엇을 자주 긋는가**를 세어 둡니다. 이게 이 화면의 이유입니다.
 * 한 판씩 볼 때는 안 보이지만, 스무 판이 쌓이면 "나는 추세선만 긋고 되돌림은
 * 거의 안 본다" 같은 게 드러납니다.
 *
 * 점수를 매기지 않습니다. 잘 그었다·못 그었다를 우리가 판단하면 그건 조언이
 * 되고, 이 사이트가 넘지 않기로 한 선입니다. 무엇을 그었고 그 구간에 무슨
 * 일이 있었는지만 적습니다.
 */
export function PracticeLog({ onClose }: { onClose: () => void }) {
  const sessions = usePractice((s) => s.sessions);
  const setMemo = usePractice((s) => s.setMemo);
  const remove = usePractice((s) => s.remove);
  const clear = usePractice((s) => s.clear);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 열리면 닫기 단추에 초점을 두고, Esc 로 닫습니다
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totals = toolTotals(sessions);
  const mostUsed = totals[0];

  return (
    <div className="praclog" role="dialog" aria-label="지난 훈련 기록">
      <header className="praclog__head">
        <h2>지난 훈련 {sessions.length}판</h2>
        <button
          type="button"
          ref={closeRef}
          className="btn btn--ghost"
          onClick={onClose}
        >
          닫기
        </button>
      </header>

      {totals.length > 0 && (
        <section className="praclog__tally">
          <h3>내가 자주 긋는 것</h3>
          <ul>
            {totals.map(([name, n]) => (
              <li key={name}>
                <span>{name}</span>
                <span className="mono">{n}번</span>
              </li>
            ))}
          </ul>
          {mostUsed && (
            <p className="praclog__hint">
              가장 많이 쓴 도구는 <strong>{mostUsed[0]}</strong>입니다. 한쪽으로
              몰려 있다면 다른 도구도 한 번 대 보세요. 무엇이 맞다는 말이
              아니라, 한 가지 방식만 쓰면 그 방식이 안 통하는 구간을 못 보게
              된다는 뜻입니다.
            </p>
          )}
        </section>
      )}

      <ul className="praclog__list">
        {sessions.map((s) => (
          <li key={s.id} className="praclog__item">
            <div className="praclog__top">
              <span className="mono praclog__tick">{s.ticker}</span>
              <span className="praclog__name">{s.name}</span>
              <span className="mono praclog__date">{s.cutDate} 까지 보고</span>
              <button
                type="button"
                aria-label={`${s.ticker} 기록 지우기`}
                className="praclog__del"
                onClick={() => remove(s.id)}
              >
                ✕
              </button>
            </div>

            <div className="praclog__facts mono">
              <span>{s.opened}봉 뒤</span>
              <b className={tone(s.change)}>{pct(s.change)}</b>
              <span className="up">고 {pct(s.maxUp)}</span>
              <span className="down">저 {pct(s.maxDown)}</span>
              {s.levelsTotal > 0 && (
                <span>
                  수평선 {s.levelsTouched}/{s.levelsTotal} 닿음
                </span>
              )}
            </div>

            {Object.keys(s.tools).length > 0 && (
              <div className="praclog__tools">
                {Object.entries(s.tools).map(([name, n]) => (
                  <span key={name} className="tag">
                    {name}
                    {n > 1 && <span className="mono"> {n}</span>}
                  </span>
                ))}
              </div>
            )}

            <input
              className="praclog__memo"
              value={s.memo}
              placeholder="이 판에서 내가 놓친 것 한 줄"
              onChange={(e) => setMemo(s.id, e.target.value)}
            />
          </li>
        ))}
      </ul>

      <footer className="praclog__foot">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            if (confirm("훈련 기록을 전부 지웁니다. 되돌릴 수 없습니다.")) {
              clear();
              onClose();
            }
          }}
        >
          모두 지우기
        </button>
        <span className="praclog__note">
          이 기기의 브라우저에만 저장됩니다. 서버로 가지 않습니다.
        </span>
      </footer>
    </div>
  );
}
