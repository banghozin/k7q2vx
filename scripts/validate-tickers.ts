/**
 * 티커 생존 검사.
 *
 * 큐레이션한 종목이 상장폐지되거나 티커가 바뀌면 조용히 데이터만 비게 됩니다.
 * 그걸 막기 위해 갱신 앞단에서 전부 조회해 보고, 하나라도 실패하면 멈춥니다.
 *
 * 실제로 이 검사로 5건을 잡았습니다 —
 *   CYBR(팔로알토 피인수) IRBT LICY(상장폐지) SMLR(합병) BK(티커 변경 → BNY)
 *
 * 실행: npm run validate
 */

import { readFile } from "node:fs/promises";
import { fetchMany } from "./lib/yahoo";
import { allFetchTickers } from "./lib/universe";

async function main() {
  const tickers = allFetchTickers();
  console.log(`[validate] ${tickers.length}개 티커를 확인합니다…`);

  // 생존 여부만 보면 되므로 짧은 구간으로 가볍게 조회합니다.
  const { series, failed } = await fetchMany(tickers, "5d");

  // 봉이 거의 없는 것도 사실상 죽은 종목으로 봅니다.
  const thin = series.filter((s) => s.bars.length < 2);

  console.log(`[validate] 정상 ${series.length - thin.length} / ${tickers.length}`);

  if (thin.length) {
    console.log(`[validate] 데이터가 너무 적은 티커 ${thin.length}개:`);
    for (const s of thin) console.log(`   ${s.ticker}  (${s.bars.length}봉)`);
  }

  if (failed.length) {
    console.error(`\n[validate] 조회 실패 ${failed.length}개:`);
    for (const f of failed) console.error(`   ${f.ticker}  — ${f.reason}`);
    console.error(
      `\n상장폐지·티커 변경일 수 있습니다. src/data/themes/ 에서 해당 종목을\n` +
        `교체하거나 제거한 뒤 다시 실행하세요.`,
    );
    process.exit(1);
  }

  if (thin.length) {
    console.error(`\n[validate] 데이터가 부족한 티커가 있어 중단합니다.`);
    process.exit(1);
  }

  /*
   * 영문 회사명 표에 빠진 종목이 있는지 봅니다.
   *
   * 종목을 새로 넣고 `npm run names` 를 안 돌리면 **영문 기사에서 그 종목이
   * 조용히 안 걸립니다.** 아무 오류도 안 나서 알아채기 어렵습니다.
   * 갱신을 멈출 일은 아니므로 알려만 줍니다.
   */
  try {
    const namesFile = JSON.parse(
      await readFile("src/data/generated/names.json", "utf8"),
    ) as { names?: Record<string, string> };
    const known = new Set(Object.keys(namesFile.names ?? {}));
    const missing = tickers.filter((t) => !known.has(t) && t !== "SPY" && t !== "QQQ");
    if (missing.length) {
      console.warn(
        `\n[validate] 영문 회사명이 없는 종목 ${missing.length}개: ${missing.join(", ")}\n` +
          `   → \`npm run names\` 를 돌리세요. 안 그러면 영문 기사에서 이 종목이 안 걸립니다.`,
      );
    }
  } catch {
    console.warn(
      `\n[validate] names.json 을 읽지 못했습니다. \`npm run names\` 를 한 번 돌리세요.`,
    );
  }

  console.log(`[validate] 전부 통과.`);
}

main().catch((e) => {
  console.error("[validate] 예기치 못한 오류:", e);
  process.exit(1);
});
