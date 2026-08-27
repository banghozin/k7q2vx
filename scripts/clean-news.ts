/**
 * 보관된 기사 중 **지금 기준으로는 걸리지 않을 것**을 걷어냅니다.
 *
 * 왜 필요한가: 종목 이름 별칭을 고치면(예: "디지털"을 별칭에서 뺌) 그 전에
 * 잘못 걸려 보관된 기사가 그대로 남습니다. 2026-08-26 에 실제로 이런 것들이
 * 들어 있었습니다.
 *   "AI·디지털 일자리센터 개관"     → 디지털 리얼티(DLR)
 *   "사우디 원전 협정, 우라늄 농축" → 우라늄 에너지(UEC)
 *
 * 버릴 수 있는 것은 **한국어 기사 중 종목이 걸린 채로 담겼는데 지금 기준으로는
 * 제목에서 아무것도 안 걸리는 것**뿐입니다. 영문 매체 기사와 시장 기사(종목이
 * 안 걸린 채로 담긴 것)는 별칭과 무관하므로 건드리지 않습니다.
 *
 * 제목에서 하나라도 걸리면 저장된 티커 목록은 **그대로 둡니다** — 본문에서
 * 걸렸던 종목까지 조용히 지우지 않기 위해서입니다.
 *
 * 실행: npx tsx scripts/clean-news.ts        (무엇을 지울지 보여주기만 함)
 *       npx tsx scripts/clean-news.ts --apply (실제로 지움)
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { namesIn, tickersIn } from "../src/lib/news-match";
import { enMatch } from "../src/lib/en-match";

const DIR = "src/data/generated/news";
const apply = process.argv.includes("--apply");

type Archived = {
  t: string;
  u: string;
  d: string;
  c: string;
  th: string[];
  tk: string[];
  /** 출처 id. 없으면 영문 피드를 붙이기 전에 쌓인 것이라 SBHNews 입니다. */
  s?: string;
};

/**
 * 이 기사를 남길 것인가.
 *
 * ⚠️ 2026-08-27 에 여기서 크게 잘못될 뻔했습니다. 원래는 **한국어 판정만**
 * 제목에 돌려 아무것도 안 걸리면 버렸습니다. 영문 피드를 붙인 뒤 그대로
 * 돌렸더니 414건 중 **348건을 버리려 했습니다** — 제대로 걸린 영문 기사
 * (CSCO·CRWV 등)와 종목이 안 걸리는 시장 기사까지 전부요. 이 폴더는
 * **지우면 되찾을 수 없습니다.**
 *
 * 그래서 버릴 수 있는 것을 좁혔습니다. 이 도구가 실제로 잡아야 하는 것은
 * **잘못된 별칭 때문에 들어온 한국어 기사** 하나뿐입니다.
 */
function keepReason(a: Archived): string | null {
  // 영문 매체 기사는 애초에 종목과 무관하게 시장 기사로 담습니다
  const source = a.s ?? "sbh";
  if (source !== "sbh") return "영문 매체 기사";

  // 종목이 안 걸린 채로 담긴 것은 시장 기사입니다. 별칭과 무관합니다
  if (a.tk.length === 0) return "시장 기사";

  // 제목에서 아직 걸리면 그대로 둡니다
  const hit = new Set([...tickersIn(a.t), ...namesIn(a.t)]);
  if (hit.size > 0) return null;

  return null;
}

/** 참고용 — 영문 기사에서 지금 기준으로 걸리는 종목 */
function currentTags(a: Archived): string[] {
  const source = a.s ?? "sbh";
  if (source !== "sbh") return enMatch(a.t);
  return [...new Set([...tickersIn(a.t), ...namesIn(a.t)])];
}

function stillMatches(a: Archived): boolean {
  if (keepReason(a) !== null) return true;
  return currentTags(a).length > 0;
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
        console.log(`  후보 [${a.tk.join(",")}] ${a.t.slice(0, 50)}`);
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
    `\n[clean] 남길 것 ${kept}건 · 버릴 후보 ${dropped}건` +
      (apply ? " (적용함)" : " (보여주기만 함. --apply 로 실제 적용)"),
  );
  if (dropped > 0) {
    console.log(
      "\n⚠ 후보 중에는 **본문에서 걸린 정상 기사**도 섞입니다. 아카이브에는\n" +
        "  제목만 저장되므로 여기서는 본문을 다시 볼 수 없습니다. 목록을 눈으로\n" +
        "  확인하고 나서 --apply 를 쓰세요. 지운 기사는 되찾을 수 없습니다.",
    );
  }
}

main().catch((e) => {
  console.error("[clean] 실패:", e);
  process.exit(1);
});
