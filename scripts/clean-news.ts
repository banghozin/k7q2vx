/**
 * 보관된 기사 중 **지금 기준으로는 걸리지 않을 것**을 걷어냅니다.
 *
 * 왜 필요한가: 종목 이름 별칭을 고치면(예: "디지털"을 별칭에서 뺌) 그 전에
 * 잘못 걸려 보관된 기사가 그대로 남습니다. 2026-08-26 에 실제로 이런 것들이
 * 들어 있었습니다.
 *   "AI·디지털 일자리센터 개관"     → 디지털 리얼티(DLR)
 *   "사우디 원전 협정, 우라늄 농축" → 우라늄 에너지(UEC)
 *
 * 판정 기준은 **제목만 다시 훑어 아무 종목도 안 걸리면 버림**입니다.
 * 아카이브에는 본문 요약을 저장하지 않기 때문에 제목만 볼 수 있습니다.
 * 제목에서 하나라도 걸리면 저장된 티커 목록은 **그대로 둡니다** — 본문에서
 * 걸렸던 종목까지 조용히 지우지 않기 위해서입니다.
 *
 * 실행: npx tsx scripts/clean-news.ts        (무엇을 지울지 보여주기만 함)
 *       npx tsx scripts/clean-news.ts --apply (실제로 지움)
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { namesIn, tickersIn } from "../src/lib/news-match";

const DIR = "src/data/generated/news";
const apply = process.argv.includes("--apply");

type Archived = {
  t: string;
  u: string;
  d: string;
  c: string;
  th: string[];
  tk: string[];
};

function stillMatches(a: Archived): boolean {
  const hit = new Set([...tickersIn(a.t), ...namesIn(a.t)]);
  return hit.size > 0;
}

async function main() {
  let names: string[] = [];
  try {
    names = await readdir(DIR);
  } catch {
    console.log("[clean] 아카이브 폴더가 없습니다.");
    return;
  }

  let dropped = 0;
  let kept = 0;

  for (const n of names) {
    if (!/^\d{4}-\d{2}\.json$/.test(n) && n !== "recent.json") continue;
    const path = `${DIR}/${n}`;
    const file = JSON.parse(await readFile(path, "utf8")) as {
      items?: Archived[];
      [k: string]: unknown;
    };
    const items = file.items ?? [];
    const good = items.filter((a) => {
      const ok = stillMatches(a);
      if (!ok) {
        dropped++;
        console.log(`  버림 [${a.tk.join(",")}] ${a.t.slice(0, 50)}`);
      } else kept++;
      return ok;
    });
    if (good.length === items.length) continue;
    if (!apply) continue;
    file.items = good;
    if ("count" in file) file.count = good.length;
    await writeFile(path, `${JSON.stringify(file)}\n`, "utf8");
    console.log(`  ${n} — ${items.length} → ${good.length}건`);
  }

  console.log(
    `\n[clean] 남길 것 ${kept}건 · 버릴 것 ${dropped}건` +
      (apply ? " (적용함)" : " (보여주기만 함. --apply 로 실제 적용)"),
  );
}

main().catch((e) => {
  console.error("[clean] 실패:", e);
  process.exit(1);
});
