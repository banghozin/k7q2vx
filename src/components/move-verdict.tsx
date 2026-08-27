"use client";

import Link from "next/link";
import { getTheme } from "@/data/themes";
import { asOf, getMove, judgedLayers, type MoveVerdict } from "@/lib/market-data";

/**
 * "층 전체가 밀린 날인가, 이 종목만 밀린 날인가."
 *
 * 밤에 종목이 빠졌을 때 가장 먼저 궁금한 것입니다. 업계 전체가 문제면 내
 * 판단이 틀린 게 아니고, 이 회사만 빠졌으면 회사에 무슨 일이 생긴 것입니다.
 * 사이트를 만든 이유(CLAUDE.md 1번)에 그대로 적혀 있는 물음이기도 합니다.
 *
 * 세는 방법은 하나입니다 — 그 종목이 크게 움직인 날, **같은 층의 나머지
 * 종목들도 같이 움직였는가.** 중앙값으로 봅니다.
 *
 * 여기서 멈춥니다. "그러니 사라/팔아라" 로 넘어가지 않습니다.
 */

const LABEL: Record<MoveVerdict, string> = {
  layer: "층 전체가 같이",
  solo: "이 종목만",
  mixed: "일부만 같이",
};

const TONE: Record<MoveVerdict, string> = {
  layer: "mv--layer",
  solo: "mv--solo",
  mixed: "mv--mixed",
};

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function MoveVerdictBlock({
  ticker,
  onNavigate,
}: {
  ticker: string;
  onNavigate?: () => void;
}) {
  const rows = judgedLayers(ticker);
  const move = getMove(ticker);
  if (rows.length === 0 || !move) return null;

  return (
    <div className="mv">
      <h4 className="mv__head">
        층 전체였나, 이 종목만이었나
        {/*
          기준일을 반드시 붙입니다. 위쪽 시세는 지금 값이라 하루 1회 계산해
          둔 이 판정과 다를 수 있습니다. 날짜를 안 밝히면 "왜 지금 빠지는데
          올랐다고 하지" 로 읽힙니다.
        */}
        {asOf && <span className="mv__asof mono">{asOf} 종가 기준</span>}
      </h4>
      <ul className="mv__list">
        {rows.map((r) => {
          const theme = getTheme(r.theme);
          const layer = theme?.layers.find((l) => l.n === r.n);
          const v = r.verdict1 ?? r.verdict5;
          const isDaily = r.verdict1 != null;
          const peer = isDaily ? r.median1 : r.median5;
          const own = isDaily ? move.ret1 : move.ret5;
          if (!v) return null;

          return (
            <li key={`${r.theme}-${r.n}`} className="mv__row">
              <Link
                href={`/theme/${r.theme}#layer-${r.n}`}
                onClick={onNavigate}
                className="mv__where"
              >
                {theme?.name ?? r.theme} {r.n}층
                {layer?.name && <span className="mv__lname">{layer.name}</span>}
              </Link>
              <span className="mv__num mono">
                {isDaily ? "하루" : "5일"} 이 종목{" "}
                <span className={own != null && own >= 0 ? "up" : "down"}>
                  {pct(own)}
                </span>
                <span className="mv__peers">
                  {" "}
                  · 나머지 {r.peers}종목 중앙값 {pct(peer)}
                </span>
              </span>
              <span className={`mv__tag ${TONE[v]}`}>{LABEL[v]}</span>
            </li>
          );
        })}
      </ul>
      <p className="mv__note">
        같은 층에서 <strong>이 종목을 뺀 나머지</strong>의 중앙값과 견준
        것입니다. 자기를 빼는 이유는 구성원이 적은 층에서 자기가 자기를 설명하게
        되기 때문이고, 평균이 아니라 중앙값을 쓰는 이유는 한 종목이 실적으로
        튀어도 층 전체가 왜곡되지 않게 하기 위해서입니다. 위쪽 시세는 지금
        값이라 이 판정의 기준일과 다를 수 있습니다. 지나간 하루의 기록이며
        앞날에 대한 말이 아닙니다.
      </p>
    </div>
  );
}
