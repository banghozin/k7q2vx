/**
 * 티커 → 영문 회사명 표를 만듭니다.
 *
 * 왜 필요한가
 * ----------
 * 영문 매체(CNBC·MarketWatch 등)의 기사를 우리 종목에 걸려면 영문 이름이
 * 있어야 합니다. 기사는 "Micron" 이라 쓰지 "MU" 라고 쓰지 않습니다.
 *
 * 190개를 손으로 적으면 오타가 나고 티커가 바뀔 때 같이 안 바뀝니다.
 * 야후가 이미 정확한 이름을 들고 있으므로 거기서 받아옵니다
 * (`chart` 응답의 `meta.longName` / `meta.shortName`).
 *
 * 자주 돌 필요가 없습니다. 종목을 새로 넣거나 티커가 바뀌었을 때만
 * `npm run names` 로 다시 만들면 됩니다.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { themeTickers } from "./lib/universe";
import { CONCURRENCY, GAP_MS, sleep, toYahoo } from "./lib/yahoo";

const OUT = "src/data/generated/names.json";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

type NameRow = { ticker: string; long: string; short: string };

async function fetchName(ticker: string): Promise<NameRow | null> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(toYahoo(ticker))}` +
    `?interval=1d&range=1d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: Array<{ meta?: { longName?: string; shortName?: string } }> };
    };
    const meta = json.chart?.result?.[0]?.meta;
    const long = meta?.longName?.trim() ?? "";
    const short = meta?.shortName?.trim() ?? "";
    if (!long && !short) return null;
    return { ticker, long: long || short, short: short || long };
  } catch {
    return null;
  }
}

async function main() {
  const tickers = themeTickers();
  const rows: NameRow[] = [];
  const failed: string[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < tickers.length) {
      const t = tickers[cursor++];
      const row = await fetchName(t);
      if (row) rows.push(row);
      else failed.push(t);
      await sleep(GAP_MS);
    }
  }

  console.log(`[names] ${tickers.length}종목 이름 조회 시작`);
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tickers.length) }, worker),
  );

  rows.sort((a, b) => (a.ticker < b.ticker ? -1 : 1));

  await mkdir("src/data/generated", { recursive: true });
  const file = {
    generatedAt: new Date().toISOString(),
    source: "Yahoo Finance chart meta",
    count: rows.length,
    names: Object.fromEntries(rows.map((r) => [r.ticker, r.long])),
  };
  await writeFile(OUT, JSON.stringify(file, null, 1) + "\n", "utf8");

  console.log(
    `[names] ${rows.length}건 저장 (${(JSON.stringify(file).length / 1024).toFixed(1)}KB)` +
      (failed.length ? ` · 실패 ${failed.length}건: ${failed.join(", ")}` : ""),
  );
}

main().catch((e) => {
  console.error("[names] 실패:", e);
  process.exit(1);
});
