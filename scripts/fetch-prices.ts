/**
 * 전 종목 2년치 일봉 수집 → .cache/prices.json
 *
 * 이 파일은 커밋하지 않습니다(190종목 × 500봉 ≈ 2.6MB). 계산 결과만 커밋합니다.
 * 계산만 다시 돌려보고 싶으면 이 스크립트를 건너뛰고 compute 만 실행하면 됩니다.
 *
 * 실행: npm run fetch
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchMany } from "./lib/yahoo";
import { allFetchTickers } from "./lib/universe";

const OUT = ".cache/prices.json";
const RANGE = "2y"; // 동조율에 1년, 상대강도에 여유분

async function main() {
  const tickers = allFetchTickers();
  const started = Date.now();
  console.log(`[fetch] ${tickers.length}개 티커 · ${RANGE} 일봉 수집 시작`);

  let lastLog = 0;
  const { series, failed } = await fetchMany(tickers, RANGE, (done, total) => {
    // 진행 상황을 10개마다만 찍습니다 (CI 로그가 지저분해지지 않게)
    if (done - lastLog >= 10 || done === total) {
      lastLog = done;
      console.log(`[fetch] ${done}/${total}`);
    }
  });

  if (failed.length) {
    console.warn(`[fetch] 실패 ${failed.length}개:`);
    for (const f of failed) console.warn(`   ${f.ticker} — ${f.reason}`);
  }

  // 절반 넘게 실패하면 뭔가 크게 잘못된 것입니다. 멀쩡한 이전 결과를
  // 망가진 데이터로 덮어쓰지 않도록 여기서 멈춥니다.
  if (series.length < tickers.length * 0.5) {
    console.error(
      `[fetch] 수집 성공이 절반도 안 됩니다 (${series.length}/${tickers.length}). ` +
        `차단이나 장애로 보입니다. 기존 데이터를 유지하고 중단합니다.`,
    );
    process.exit(1);
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    range: RANGE,
    source: "Yahoo Finance v8 chart",
    count: series.length,
    failed,
    series,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload) + "\n", "utf8");

  const bars = series.reduce((a, s) => a + s.bars.length, 0);
  const thin = series.filter((s) => s.bars.length < 400).length;
  console.log(
    `[fetch] 완료 — ${series.length}종목 / ${bars.toLocaleString()}봉 / ` +
      `${((Date.now() - started) / 1000).toFixed(0)}초`,
  );
  if (thin) {
    console.log(
      `[fetch] 봉이 400개 미만인 종목 ${thin}개 — 대체로 상장한 지 2년이 안 된 곳입니다.`,
    );
  }
}

main().catch((e) => {
  console.error("[fetch] 실패:", e);
  process.exit(1);
});
