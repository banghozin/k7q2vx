/**
 * 생성 데이터 무결성 검사.
 *
 * 계산 스크립트가 스스로 검사하는 것(NaN·Infinity)만으로는 잡히지 않는 것들이
 * 있습니다 — 파일끼리 기준일이 어긋나거나, 실재하지 않는 층에 판정이 붙거나,
 * 아카이브에 없는 티커 태그가 남아 있는 경우입니다. 조용히 틀린 숫자를
 * 화면에 띄우는 것이 제일 나쁘므로 한 번에 훑습니다.
 *
 * 실행: npm run test:data
 */

import { readFile, readdir } from "node:fs/promises";
import { THEMES } from "../src/data/themes";

const DIR = "src/data/generated";
const problems: string[] = [];
const note = (s: string) => problems.push(s);

async function load<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(`${DIR}/${name}`, "utf8")) as T;
}

type MoveLayer = {
  theme: string;
  n: number;
  median1: number | null;
  median5: number | null;
  peers: number;
  verdict1: string | null;
  verdict5: string | null;
};

async function main() {
  const stocks = await load<{
    asOf: string;
    stocks: Record<string, { ret1: number | null; ret5: number | null }>;
  }>("stocks.json");
  const moves = await load<{
    asOf: string;
    stocks: Record<string, { ret1: number | null; ret5: number | null; layers: MoveLayer[] }>;
  }>("moves.json");
  const layers = await load<{ themes: Record<string, { layers: { n: number }[] }> }>(
    "layers.json",
  );

  const themeMap = new Map(THEMES.map((t) => [t.slug, t]));

  /*
   * 계산이 반쯤 돌다 멈춘 상태를 잡습니다.
   *
   * 아직 아무것도 안 만든 상태(새로 클론한 경우)는 정상입니다 — `ensure-generated`
   * 가 만든 빈 껍데기라 `asOf` 도 비어 있습니다. 그런데 **기준일은 있는데
   * 종목이 없다**면 계산이 어긋난 것입니다.
   */
  const stockCount = Object.keys(stocks.stocks).length;
  if (stocks.asOf && stockCount === 0)
    note("기준일은 있는데 종목이 하나도 없습니다 — 계산이 어긋났습니다");
  if (!stocks.asOf && stockCount === 0)
    console.log("[audit] 아직 계산 결과가 없습니다(빈 껍데기). 검사를 건너뜁니다.");

  /* ── 1. 파일끼리 기준일이 같은가 ────────────────────────────── */
  for (const f of [
    "layers.json",
    "sync.json",
    "leaders.json",
    "briefing.json",
    "rotation.json",
    "moves.json",
  ]) {
    const j = await load<{ asOf?: string }>(f);
    if (j.asOf !== stocks.asOf)
      note(`기준일 불일치: ${f}=${j.asOf} ≠ stocks.json=${stocks.asOf}`);
  }

  /* ── 2. 층 판정이 실제 배치와 맞는가 ───────────────────────── */
  for (const [ticker, m] of Object.entries(moves.stocks)) {
    const own = stocks.stocks[ticker];
    if (!own) {
      note(`moves 에 있는데 stocks 에 없음: ${ticker}`);
      continue;
    }
    if (m.ret1 !== own.ret1) note(`ret1 불일치: ${ticker}`);
    if (m.ret5 !== own.ret5) note(`ret5 불일치: ${ticker}`);

    for (const L of m.layers) {
      const th = themeMap.get(L.theme);
      if (!th) {
        note(`없는 테마: ${L.theme}`);
        continue;
      }
      const layer = th.layers.find((x) => x.n === L.n);
      if (!layer) {
        note(`없는 층: ${L.theme} ${L.n}`);
        continue;
      }
      if (!layer.stocks.some((s) => s.ticker.toUpperCase() === ticker))
        note(`${ticker} 가 ${L.theme} ${L.n}층 소속이 아님`);
      if (L.peers > layer.stocks.length - 1)
        note(`나머지 종목 수 과다: ${ticker} ${L.theme}${L.n}`);
      // 표본이 둘 미만이면 중앙값이 아니라 그냥 그 한 종목입니다
      if ((L.verdict1 || L.verdict5) && L.peers < 2)
        note(`표본 2 미만인데 판정함: ${ticker} ${L.theme}${L.n}`);
      for (const v of [L.verdict1, L.verdict5])
        if (v && !["layer", "solo", "mixed"].includes(v))
          note(`이상한 판정값: ${v}`);
    }
  }

  /* ── 3. 층 목록이 테마 정의와 일치하는가 ───────────────────── */
  for (const [slug, t] of Object.entries(layers.themes)) {
    const th = themeMap.get(slug);
    if (!th) {
      note(`layers 에 없는 테마: ${slug}`);
      continue;
    }
    if (t.layers.length !== th.layers.length)
      note(`층 개수 불일치: ${slug} ${t.layers.length} ≠ ${th.layers.length}`);
  }

  /* ── 4. 이상한 값이 섞였는가 ───────────────────────────────── */
  for (const f of await readdir(DIR)) {
    if (!f.endsWith(".json")) continue;
    const raw = await readFile(`${DIR}/${f}`, "utf8");
    if (/\bNaN\b|\bInfinity\b|\bundefined\b/.test(raw)) note(`이상한 값 포함: ${f}`);
  }

  /* ── 5. 뉴스 아카이브 ──────────────────────────────────────── */
  const news = await load<{
    items: { t: string; u: string; d: string; tk: string[]; th: string[]; s?: string }[];
  }>("news/recent.json");
  const seen = new Set<string>();
  const allTickers = new Set(
    THEMES.flatMap((t) => t.layers.flatMap((l) => l.stocks.map((s) => s.ticker.toUpperCase()))),
  );
  for (const it of news.items) {
    if (seen.has(it.u)) note(`아카이브 중복 URL: ${it.u.slice(0, 50)}`);
    seen.add(it.u);
    // 남이 주는 주소를 그대로 링크로 씁니다. http(s) 가 아니면 안 됩니다
    if (!/^https?:\/\//.test(it.u)) note(`나쁜 링크: ${it.u.slice(0, 40)}`);
    if (Number.isNaN(new Date(it.d).getTime())) note(`나쁜 날짜: ${it.d}`);
    if (it.t.length > 300) note(`제목이 너무 김(${it.t.length}자)`);
    for (const tk of it.tk) if (!allTickers.has(tk)) note(`없는 티커 태그: ${tk}`);
    for (const s of it.th) if (!themeMap.has(s)) note(`없는 테마 태그: ${s}`);
    if (it.tk.length > 0 && it.th.length === 0)
      note(`티커는 있는데 테마가 없음: ${it.tk.join(",")}`);
  }

  console.log(
    `[audit] 종목 ${Object.keys(stocks.stocks).length} · 층 판정 ${Object.keys(moves.stocks).length} · 기사 ${news.items.length} 검사`,
  );

  if (problems.length === 0) {
    console.log("[audit] 문제 없음");
    return;
  }
  const uniq = [...new Set(problems)];
  console.error(`[audit] 문제 ${problems.length}건 (종류 ${uniq.length}):`);
  for (const p of uniq.slice(0, 30)) console.error("   " + p);
  process.exit(1);
}

main().catch((e) => {
  console.error("[audit] 실패:", e);
  process.exit(1);
});
