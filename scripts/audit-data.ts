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
import { PERIPHERAL } from "../src/data/peripheral";

const DIR = "src/data/generated";

/** 중앙값 — 계산 쪽과 같은 방식(짝수면 가운데 둘의 평균) */
function medianOf(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
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
    stocks: Record<string, { ret1: number | null; ret5: number | null; ret20: number | null }>;
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

      /*
       * 판정의 근거가 되는 **나머지 종목 중앙값**까지 다시 세어 봅니다.
       * 위 검사들은 "모양" 만 봅니다 — 중앙값이 엉뚱해도 안 걸립니다.
       */
      const peers = layer.stocks
        .map((s) => s.ticker.toUpperCase())
        .filter((t) => t !== ticker);
      if (L.peers !== peers.length)
        note(`나머지 종목 수 ${L.peers} ≠ ${peers.length}: ${ticker} ${L.theme}${L.n}`);
      for (const [key, got] of [
        ["ret1", L.median1],
        ["ret5", L.median5],
      ] as const) {
        if (got == null) continue;
        const vals = peers
          .map((t) => stocks.stocks[t]?.[key])
          .filter((v): v is number => typeof v === "number");
        const want = medianOf(vals);
        if (want != null && Math.abs(want - got) > 0.02)
          note(`${ticker} ${L.theme}${L.n} ${key} 중앙값 ${got} ≠ 다시 센 ${want.toFixed(2)}`);
      }
    }
  }

  /* ── 2-b. 대장주 순위에 같은 종목이 두 번 오르지 않았는가 ──
   *
   * 한 회사가 같은 테마의 두 층에 걸쳐 있을 수 있습니다(우주·방산의 LMT 가
   * 발사체와 무기 체계 양쪽). 테마 단위 명단을 만들 때 중복을 안 빼면 순위에
   * 같은 종목이 나란히 뜨고, 1·2위가 같아서 **"접전" 이 항상 켜집니다.**
   */
  const leaders = await load<{
    themes: Record<string, { ranked: { ticker: string }[]; close?: boolean }>;
  }>("leaders.json");
  for (const [slug, t] of Object.entries(leaders.themes)) {
    const r = (t.ranked ?? []).map((x) => x.ticker);
    const dup = [...new Set(r.filter((x, i) => r.indexOf(x) !== i))];
    if (dup.length) note(`${slug} 대장주 순위에 중복: ${dup.join(",")}`);
  }

  /* ── 2-b-2. 파일끼리 숫자가 맞물리는가 ──────────────────────
   *
   * 여기까지의 검사는 "모양" 을 봅니다. 값이 서로 어긋나는 것은 못 잡습니다.
   * 2026-09-02 에 실제로 전기차 2층이 **"1/2종목 상승"** 이라고 적고 있었는데,
   * 둘 중 하나는 값을 못 구한 종목이라 내린 것처럼 읽혔습니다. 층 온도는
   * 이 사이트가 층끼리 견주는 근거이므로 다시 세어 맞춰 봅니다.
   */
  const layersNum = await load<{
    themes: Record<
      string,
      {
        layers: {
          n: number;
          ret5: number | null;
          ret20: number | null;
          up: number;
          total: number;
        }[];
      }
    >;
  }>("layers.json");

  for (const t of THEMES) {
    const th = layersNum.themes?.[t.slug];
    if (!th) continue;
    for (const L of th.layers) {
      const def = t.layers.find((x) => x.n === L.n);
      if (!def) continue;
      const pick = (k: "ret5" | "ret20") =>
        def.stocks
          .map((s) => stocks.stocks[s.ticker]?.[k])
          .filter((v): v is number => typeof v === "number");
      const v20 = pick("ret20");
      const v5 = pick("ret5");
      const m20 = medianOf(v20);
      const m5 = medianOf(v5);
      // 반올림 자리 때문에 0.02 는 봐줍니다
      if (m20 != null && L.ret20 != null && Math.abs(m20 - L.ret20) > 0.02)
        note(`${t.slug} ${L.n}층 ret20 ${L.ret20} ≠ 다시 센 중앙값 ${m20.toFixed(2)}`);
      if (m5 != null && L.ret5 != null && Math.abs(m5 - L.ret5) > 0.02)
        note(`${t.slug} ${L.n}층 ret5 ${L.ret5} ≠ 다시 센 중앙값 ${m5.toFixed(2)}`);
      if (L.total !== v20.length)
        note(`${t.slug} ${L.n}층 분모 ${L.total} ≠ 값이 있는 종목 수 ${v20.length}`);
      if (L.up !== v20.filter((v) => v > 0).length)
        note(`${t.slug} ${L.n}층 상승 ${L.up} ≠ 다시 센 ${v20.filter((v) => v > 0).length}`);
    }
  }

  /* ── 2-b-3. 동조율 숫자가 자기끼리 맞는가 ────────────────────
   *
   * ⚠️ 이 검사는 처음에 **열쇠 이름을 틀려 아무것도 하지 않고 있었습니다.**
   * `candidates` / `n` / `ratio` 로 읽었는데 실제 파일은 `members` / `events` /
   * `rate` 입니다. `?? []` 때문에 조용히 빈 반복이 되어 늘 통과했습니다.
   * 검사를 새로 넣으면 **일부러 틀린 값을 넣어 걸리는지** 확인할 것.
   */
  const syncNum = await load<{
    themes: Record<
      string,
      {
        byLeader: Record<
          string,
          {
            events: number;
            members: { ticker: string; hits: number; events: number; rate: number | null }[];
          }
        >;
      }
    >;
  }>("sync.json");
  let syncRows = 0;
  for (const [slug, v] of Object.entries(syncNum.themes ?? {})) {
    for (const [leader, view] of Object.entries(v.byLeader ?? {})) {
      if (!Array.isArray(view.members))
        note(`${slug}/${leader}: members 가 없습니다 — 파일 모양이 바뀌었습니다`);
      for (const c of view.members ?? []) {
        syncRows++;
        if (c.hits > c.events)
          note(`${slug}/${leader} ${c.ticker}: 같이 오른 날 ${c.hits} > 표본 ${c.events}`);
        if (c.events > view.events)
          note(`${slug}/${leader} ${c.ticker}: 표본 ${c.events} > 사건 ${view.events}`);
        if (c.rate != null && c.events > 0) {
          const r = (c.hits / c.events) * 100;
          if (Math.abs(r - c.rate) > 0.11)
            note(`${slug}/${leader} ${c.ticker}: 비율 ${c.rate} ≠ ${r.toFixed(1)}`);
        }
      }
    }
  }
  // 한 줄도 못 봤다면 그것 자체가 문제입니다 (위 사고의 재발 방지)
  if (stockCount > 0 && syncRows === 0) note("동조율 검사가 한 줄도 보지 못했습니다");

  /* ── 2-b-5. 브리핑이 층 온도와 같은 것을 가리키는가 ─────────── */
  const briefNum = await load<{
    themes: Record<
      string,
      {
        hottest?: { n: number; ret20: number };
        coldest?: { n: number; ret20: number };
        riser?: { n: number; rank20: number; rank5: number; delta: number };
      }
    >;
  }>("briefing.json");
  for (const [slug, b] of Object.entries(briefNum.themes ?? {})) {
    const ls = (layersNum.themes?.[slug]?.layers ?? []).filter((l) => l.ret20 != null);
    if (!ls.length) continue;
    const hot = ls.reduce((a, x) => ((x.ret20 as number) > (a.ret20 as number) ? x : a));
    const cold = ls.reduce((a, x) => ((x.ret20 as number) < (a.ret20 as number) ? x : a));
    if (b.hottest && b.hottest.n !== hot.n)
      note(`${slug} 브리핑의 가장 뜨거운 층 ${b.hottest.n} ≠ 실제 ${hot.n}`);
    if (b.coldest && b.coldest.n !== cold.n)
      note(`${slug} 브리핑의 가장 식은 층 ${b.coldest.n} ≠ 실제 ${cold.n}`);
    if (b.riser && b.riser.rank20 - b.riser.rank5 !== b.riser.delta)
      note(`${slug} riser 의 오른 계단 ${b.riser.delta} 이 순위차와 안 맞음`);
  }

  /* ── 2-b-6. 순환 그림의 순위가 그 시점 성과의 줄 세우기인가 ─── */
  const rotNum = await load<{
    themes: Record<
      string,
      { dates: string[]; layers: { n: number; ranks: (number | null)[]; rets: (number | null)[] }[] }
    >;
  }>("rotation.json");
  for (const [slug, r] of Object.entries(rotNum.themes ?? {})) {
    for (let i = 0; i < (r.dates?.length ?? 0); i++) {
      const pts = (r.layers ?? [])
        .map((l) => ({ n: l.n, rank: l.ranks?.[i], ret: l.rets?.[i] }))
        .filter((p): p is { n: number; rank: number; ret: number } => p.rank != null && p.ret != null);
      if (pts.length < 2) continue;
      const ranks = pts.map((p) => p.rank);
      if (new Set(ranks).size !== ranks.length)
        note(`${slug} ${r.dates[i]} 순위가 겹칩니다`);
      const want = [...pts].sort((a, b) => b.ret - a.ret);
      for (let k = 0; k < want.length; k++) {
        const got = pts.find((p) => p.rank === k + 1);
        if (!got) { note(`${slug} ${r.dates[i]} ${k + 1}위가 없습니다`); break; }
        // 동점은 순서가 갈릴 수 있으니 값이 다를 때만 따집니다
        if (got.ret !== want[k].ret) {
          note(`${slug} ${r.dates[i]} ${k + 1}위 성과 ${got.ret} ≠ 줄 세운 값 ${want[k].ret}`);
          break;
        }
      }
    }
  }

  /* ── 2-b-7. 곁다리 목록이 아직 유효한가 ─────────────────────
   *
   * 사람이 손으로 적는 목록이라(`src/data/peripheral.ts`), 큐레이션에서
   * 종목을 빼면 **조용히 아무 일도 안 하는 줄**이 남습니다.
   */
  for (const [slug, tickers] of Object.entries(PERIPHERAL)) {
    const th = themeMap.get(slug);
    if (!th) { note(`곁다리 목록에 없는 테마: ${slug}`); continue; }
    const have = new Set(
      th.layers.flatMap((l) => l.stocks.map((s) => s.ticker.toUpperCase())),
    );
    for (const t of tickers)
      if (!have.has(t.toUpperCase()))
        note(`곁다리 ${t} 가 ${slug} 테마에 없습니다 — 목록이 낡았습니다`);
  }

  /* ── 2-b-4. 대장주 순위가 점수 순인가 ──────────────────────── */
  const leadersNum = await load<{
    themes: Record<string, { ranked: { ticker: string; score: number }[] }>;
  }>("leaders.json");
  for (const [slug, v] of Object.entries(leadersNum.themes ?? {})) {
    const r = v.ranked ?? [];
    for (let i = 1; i < r.length; i++)
      if (r[i].score > r[i - 1].score + 1e-9)
        note(`${slug} 순위가 점수 순이 아님: ${r[i].ticker}(${r[i].score}) > ${r[i - 1].ticker}(${r[i - 1].score})`);
  }

  /* ── 2-c. 큐레이션 데이터 자체 ─────────────────────────────── */
  for (const t of THEMES) {
    const ns = new Set<number>();
    const keys = new Set<string>();
    for (const l of t.layers) {
      if (ns.has(l.n)) note(`${t.slug} 층 번호 중복: ${l.n}`);
      ns.add(l.n);
      if (keys.has(l.key)) note(`${t.slug} 층 key 중복: ${l.key}`);
      keys.add(l.key);
      if (l.stocks.length === 0) note(`${t.slug} ${l.n}층에 종목이 없음`);
      const inLayer = new Set<string>();
      let anchors = 0;
      for (const s of l.stocks) {
        const tk = s.ticker.toUpperCase();
        if (inLayer.has(tk)) note(`${t.slug} ${l.n}층에 ${tk} 가 두 번`);
        inLayer.add(tk);
        if (!s.why?.trim()) note(`${tk} (${t.slug} ${l.n}층) "왜 이 층인가" 가 비었음`);
        // 넘지 않는 선 — 배치 설명에 매매 판단 표현이 들어가면 안 됩니다
        if (/사세요|사야 |팔아야|매수하|매도하|추천합|목표가/.test(s.why ?? ""))
          note(`${tk} 의 설명에 매매 표현: "${s.why}"`);
        if (s.anchor) anchors++;
      }
      if (anchors > 1) note(`${t.slug} ${l.n}층에 축 종목이 ${anchors}개`);
    }
    const seq = [...ns].sort((a, b) => a - b);
    if (seq.length && (seq[0] !== 1 || seq.some((v, i) => v !== i + 1)))
      note(`${t.slug} 층 번호가 1부터 연속이 아님: ${seq.join(",")}`);
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

  /* ── 5-b. 달 파일끼리 같은 기사를 들고 있지 않은가 ──────────────
   *
   * 매체는 **같은 기사를 날짜만 바꿔 다시 내보냅니다.** 그 날짜가 달을
   * 넘기면 8월 파일과 9월 파일에 각각 들어가고, 예전에는 달 파일 안에서만
   * 걸렀기 때문에 아무도 못 잡았습니다. 화면용 파일에서야 드러났는데,
   * 그때는 이미 아카이브가 더러워진 뒤입니다.
   */
  const seenAcross = new Map<string, string>();
  for (const f of await readdir(`${DIR}/news`)) {
    if (!/^\d{4}-\d{2}\.json$/.test(f)) continue;
    const m = await load<{ items: { u: string }[] }>(`news/${f}`);
    for (const it of m.items ?? []) {
      const before = seenAcross.get(it.u);
      if (before && before !== f)
        note(`달 파일끼리 같은 기사: ${before} ↔ ${f} — ${it.u.slice(0, 46)}`);
      else if (before) note(`${f} 안에 같은 기사가 두 번: ${it.u.slice(0, 46)}`);
      seenAcross.set(it.u, f);
    }
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
