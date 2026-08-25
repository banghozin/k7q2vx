/**
 * 뉴스 아카이브 — 매일 조금씩 쌓아 둡니다.
 *
 * 왜 쌓아야 하는가
 * ----------------
 * SBHNews 의 공개 RSS 는 **최근 100건만** 줍니다. 실제로 재어 보니 100건이
 * 7시간 반이면 다 찹니다. 즉 **하루만 안 모으면 그날 기사는 영영 사라집니다.**
 * 지금까지 우리는 읽어서 화면에 보여주기만 하고 저장을 하지 않았습니다.
 *
 * 쌓이면 할 수 있는 일:
 *   - 종목별 뉴스 ("이 종목에 무슨 일이 있었나")
 *   - 매매노트의 진입일에 무슨 기사가 있었는지 ("내가 왜 샀지")
 *   - 차트 위에 기사 터진 날 표시 ("이 급등이 이 뉴스였구나")
 *
 * 이용 근거: https://www.sbhnews.com/data-use — CC BY 4.0 이 보관과
 * 데이터베이스화를 명시적으로 허용합니다. 출처·원문 링크·라이선스를 함께
 * 저장하고 화면에도 표시합니다.
 *
 * 저장 범위
 * ---------
 * **우리 테마나 종목에 걸리는 기사만** 남깁니다. 아무 데도 안 걸리는 기사는
 * 이 사이트에서 쓸 데가 없고, 그것까지 담으면 파일만 커집니다.
 * 본문 요약(description)은 저장하지 않습니다 — 목록에 요약이 필요한 화면은
 * 실시간 피드가 담당하고, 아카이브는 "언제 무슨 제목의 기사가 있었나"만
 * 답하면 됩니다.
 *
 * 실행: npm run news
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { THEMES } from "../src/data/themes";
import { fetchNews, type NewsItem } from "../src/lib/sbhnews";
import { hasName } from "./lib/korean-match";

const DIR = "src/data/generated/news";

/** 보관한 기사 하나. 키를 짧게 둬 파일이 커지지 않게 합니다. */
type Archived = {
  /** 제목 */
  t: string;
  /** 원문 주소 */
  u: string;
  /** 발행 시각 (ISO) */
  d: string;
  /** 카테고리 */
  c: string;
  /** 걸린 테마 slug */
  th: string[];
  /** 걸린 티커 */
  tk: string[];
};

/**
 * 회사명으로 종목을 찾을 때 쓰면 안 되는 낱말.
 *
 * 한국어 기사에 흔히 나오는 말과 겹치는 것들입니다. 그냥 두면
 * "블록체인" 기사가 블록(XYZ)으로 잘못 걸립니다.
 */
const AMBIGUOUS_NAMES = new Set([
  "블록",
  "서클",
  "코어",
  "스트래티지",
  "리듬",
  "에너지",
  "글로벌",
  "아메리카스",
  // "삼성전자 갤럭시 버즈" 기사가 갤럭시 디지털(GLXY)로 걸렸습니다.
  "갤럭시",
]);

/**
 * 두 글자라도 써도 되는 회사명.
 *
 * 짧은 이름은 아무 문장에나 걸려서 원칙적으로 뺍니다. 그런데 그 규칙 때문에
 * "인텔·IBM 등 경쟁사들도" 라는 문장에서 IBM 은 잡히고 **인텔은 놓쳤습니다.**
 * 한국어 기사에서 다른 뜻으로 쓰일 일이 거의 없는 것만 골라 되살립니다.
 * ("메타", "포드" 처럼 일반 낱말과 겹치는 것은 넣지 않습니다.)
 */
const SAFE_SHORT = new Set(["인텔", "퀄컴", "마벨"]);

/**
 * 한글 회사명 → 티커.
 *
 * 회사명 전체("포드 모터")뿐 아니라 **첫 어절**("포드")도 넣습니다. 기사에서는
 * 정식 명칭보다 줄여 쓰는 일이 훨씬 많기 때문입니다. 다만 첫 어절이 세 글자
 * 미만이면(예: "델") 아무 문장에나 걸리므로 넣지 않습니다.
 */
function buildMatchers() {
  const byName = new Map<string, string>();
  const tickers = new Set<string>();
  for (const theme of THEMES) {
    for (const layer of theme.layers) {
      for (const s of layer.stocks) {
        tickers.add(s.ticker.toUpperCase());
        const full = s.name.trim();
        const usable = (w: string) =>
          !AMBIGUOUS_NAMES.has(w) && (w.length >= 3 || SAFE_SHORT.has(w));

        if (usable(full)) byName.set(full, s.ticker);

        const head = full.split(/\s+/)[0];
        if (usable(head) && !byName.has(head)) byName.set(head, s.ticker);
      }
    }
  }
  return { byName, tickers };
}

const { byName, tickers } = buildMatchers();

/** 티커는 앞뒤가 영문·숫자가 아닐 때만 잡습니다. 세 글자 미만은 오탐이 심해 뺍니다. */
function tickersIn(text: string): string[] {
  const hit = new Set<string>();
  const upper = text.toUpperCase();
  for (const t of tickers) {
    if (t.length < 3) continue;
    const i = upper.indexOf(t);
    if (i < 0) continue;
    const before = i === 0 ? " " : upper[i - 1];
    const after = upper[i + t.length] ?? " ";
    if (/[A-Z0-9]/.test(before) || /[A-Z0-9]/.test(after)) continue;
    hit.add(t);
  }
  return [...hit];
}

function namesIn(text: string): string[] {
  const hit = new Set<string>();
  for (const [name, ticker] of byName) {
    if (hasName(text, name)) hit.add(ticker);
  }
  return [...hit];
}

/** 티커가 걸리면 그 종목이 속한 테마도 걸린 것으로 봅니다 */
function themesOfTickers(tk: string[]): string[] {
  const out = new Set<string>();
  for (const theme of THEMES) {
    for (const layer of theme.layers) {
      for (const s of layer.stocks) {
        if (tk.includes(s.ticker)) out.add(theme.slug);
      }
    }
  }
  return [...out];
}

/** 국내 시장 상품 기사는 제외합니다 — 이 사이트는 미국 상장만 다룹니다 */
const DOMESTIC = [
  "KODEX",
  "TIGER",
  "코스피",
  "코스닥",
  "국내 상장",
  "한국거래소",
  "공모주",
];

/**
 * 기사 하나를 보관할지 판단합니다.
 *
 * **종목이 하나라도 걸려야 보관합니다.** 처음엔 테마 키워드로도 걸었는데
 * 결과가 엉망이었습니다 — "반도체" 하나로 국내 부품사 기사가, "보안" 으로
 * 멕시코 치안 기사가, "드론" 으로 우크라이나 전황 기사가 딸려 들어왔습니다.
 * 우리가 이 아카이브로 하려는 일(종목별 뉴스 · 매매노트 진입일 · 차트 표시)은
 * 전부 종목 단위라, 종목이 안 걸린 기사는 애초에 쓸 데가 없습니다.
 *
 * 테마 페이지의 "이 테마에 걸린 기사" 목록은 실시간 피드가 그대로 담당합니다.
 */
function classify(it: NewsItem): Archived | null {
  const text = `${it.title} ${it.description}`;
  if (DOMESTIC.some((d) => it.title.includes(d))) return null;

  const tk = [...new Set([...tickersIn(text), ...namesIn(text)])].sort();
  if (tk.length === 0) return null;

  const th = themesOfTickers(tk).sort();

  const d = new Date(it.pubDate);
  return {
    t: it.title,
    u: it.link,
    d: Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
    c: it.category,
    th,
    tk,
  };
}

type MonthFile = { month: string; updatedAt: string; items: Archived[] };

async function main() {
  const items = await fetchNews();
  if (items.length === 0) {
    console.error("[news] 피드를 읽지 못했습니다. 기존 아카이브를 그대로 둡니다.");
    process.exit(0); // 실패해도 갱신 전체를 멈추지 않습니다
  }

  const picked = items
    .map(classify)
    .filter((x): x is Archived => x !== null);

  console.log(
    `[news] 받은 기사 ${items.length}건 중 우리 테마·종목에 걸린 것 ${picked.length}건`,
  );

  // 달별로 나눠 담습니다. 한 파일에 다 넣으면 시간이 갈수록 감당이 안 됩니다.
  const byMonth = new Map<string, Archived[]>();
  for (const a of picked) {
    const m = a.d.slice(0, 7);
    byMonth.set(m, [...(byMonth.get(m) ?? []), a]);
  }

  await mkdir(DIR, { recursive: true });
  let added = 0;

  for (const [month, fresh] of byMonth) {
    const path = `${DIR}/${month}.json`;
    let existing: MonthFile = { month, updatedAt: "", items: [] };
    try {
      existing = JSON.parse(await readFile(path, "utf8")) as MonthFile;
    } catch {
      // 그 달의 첫 기사입니다
    }

    const seen = new Set(existing.items.map((x) => x.u));
    for (const a of fresh) {
      if (seen.has(a.u)) continue;
      existing.items.push(a);
      seen.add(a.u);
      added++;
    }

    // 최신이 위로
    existing.items.sort((a, b) => (a.d < b.d ? 1 : -1));
    existing.month = month;
    existing.updatedAt = new Date().toISOString();

    await writeFile(path, JSON.stringify(existing) + "\n", "utf8");
    console.log(
      `[news] ${month}.json — 누적 ${existing.items.length}건 (${(
        JSON.stringify(existing).length / 1024
      ).toFixed(1)}KB)`,
    );
  }

  /*
   * 화면이 읽을 파일을 따로 하나 만듭니다.
   *
   * 달별 파일은 장기 보관용이고, 화면은 최근 것만 씁니다. 달별 파일을 화면에서
   * 직접 가져오면 달이 바뀔 때마다 코드에서 파일 경로를 손으로 고쳐야 하고,
   * 그걸 잊으면 새 달 기사가 조용히 안 보이게 됩니다. 경로가 고정된 파일
   * 하나로 합쳐 두면 그런 일이 없습니다.
   */
  const cutoff = Date.now() - RECENT_DAYS * 86400000;
  const recent: Archived[] = [];
  for (const [, items] of byMonthAll(await readAllMonths())) {
    for (const a of items) {
      if (new Date(a.d).getTime() >= cutoff) recent.push(a);
    }
  }
  recent.sort((a, b) => (a.d < b.d ? 1 : -1));

  const recentFile = {
    updatedAt: new Date().toISOString(),
    days: RECENT_DAYS,
    source: "SBHNews / 센서스튜디오",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    count: recent.length,
    items: recent,
  };
  await writeFile(
    `${DIR}/recent.json`,
    JSON.stringify(recentFile) + "\n",
    "utf8",
  );

  console.log(
    `[news] 새로 보관한 기사 ${added}건 · 화면용 recent.json ${recent.length}건 ` +
      `(${(JSON.stringify(recentFile).length / 1024).toFixed(1)}KB)`,
  );
}

/** 화면이 들고 갈 기간 */
const RECENT_DAYS = 90;

async function readAllMonths(): Promise<MonthFile[]> {
  const { readdir } = await import("node:fs/promises");
  const out: MonthFile[] = [];
  let names: string[] = [];
  try {
    names = await readdir(DIR);
  } catch {
    return out;
  }
  for (const n of names) {
    if (!/^\d{4}-\d{2}\.json$/.test(n)) continue;
    try {
      out.push(JSON.parse(await readFile(`${DIR}/${n}`, "utf8")) as MonthFile);
    } catch {
      // 읽지 못한 달은 건너뜁니다
    }
  }
  return out;
}

function byMonthAll(files: MonthFile[]): [string, Archived[]][] {
  return files.map((f) => [f.month, f.items ?? []]);
}

main().catch((e) => {
  console.error("[news] 실패:", e);
  process.exit(1);
});
