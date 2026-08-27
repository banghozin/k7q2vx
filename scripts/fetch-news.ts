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
import { fetchNews, hasUsSignal, type NewsItem } from "../src/lib/sbhnews";

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
  /**
   * 출처 id. `sbh` 또는 영문 피드 id(`cnbc-mkt` 등).
   *
   * 이 값이 없는 기사는 영문 피드를 붙이기(2026-08-27) 전에 쌓인 것이라
   * 전부 SBHNews 입니다. 읽는 쪽에서 없으면 `sbh` 로 봅니다.
   */
  s?: string;
};

import { namesIn, tickersIn } from "../src/lib/news-match";
import { enMatch } from "../src/lib/en-match";
import {
  fetchUsNews,
  US_FEEDS,
  US_FEED_LABEL,
  type UsNewsItem,
} from "../src/lib/usnews";

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

/**
 * 미국 시장 기사인가 — 종목이 안 걸린 기사를 남길지 정하는 기준입니다.
 *
 * 카테고리가 `economy` 인 것만 봅니다. 외교·사회 기사에도 "미국" 은 흔히
 * 나오지만 그건 시장 얘기가 아닙니다.
 */
function isUsMarket(it: NewsItem): boolean {
  if (it.category !== "economy") return false;
  return hasUsSignal(`${it.title} ${it.description}`);
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
 * 두 갈래로 남깁니다.
 *
 * 1. **종목 기사** — 우리 종목 이름이 실제로 나온 것. 종목별 뉴스, 매매노트
 *    진입일, 차트 위 표시에 쓰입니다.
 * 2. **시장 기사** — 종목은 안 걸렸지만 미국 시장 얘기인 것(연준·나스닥·
 *    관세 같은). 홈 헤드라인이 여기서 나옵니다.
 *
 * 처음엔 1번만 남겼는데, 그러면 홈 헤드라인은 **실시간 피드에만** 의존하게
 * 됩니다. 그 피드는 최근 100건, 재어 보니 **7.6시간치**밖에 없어서 어제 뭐가
 * 있었는지 볼 방법이 없었습니다. 지나가면 되찾을 수 없으니 같이 담습니다.
 *
 * 테마 키워드로 거는 방식은 쓰지 않습니다 — "보안" 으로 멕시코 치안 기사가,
 * "조선" 으로 시외버스 요금 기사가 딸려 들어왔습니다.
 */
function classify(it: NewsItem): Archived | null {
  const text = `${it.title} ${it.description}`;
  if (DOMESTIC.some((d) => it.title.includes(d))) return null;

  const tk = [...new Set([...tickersIn(text), ...namesIn(text)])].sort();
  // 종목이 안 걸렸으면 미국 시장 기사일 때만 남깁니다
  if (tk.length === 0 && !isUsMarket(it)) return null;

  const th = themesOfTickers(tk).sort();

  const d = new Date(it.pubDate);
  return {
    t: it.title,
    u: it.link,
    d: Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
    c: it.category,
    th,
    tk,
    s: "sbh",
  };
}

/**
 * 영문 기사를 보관 형태로 바꿉니다.
 *
 * 한국어 쪽과 달리 **거를 것이 없습니다.** 이 피드들은 처음부터 미국 시장
 * 매체라 "국내 기사인가"를 물을 필요가 없습니다. 종목이 안 걸린 기사도
 * 시장 기사로 그대로 담습니다 — 홈 헤드라인이 여기서 나옵니다.
 *
 * 종목 판정은 `en-match.ts` 가 맡습니다. 영어는 회사 이름이 일상어와 자주
 * 겹쳐서(Powell Industries ↔ 연준 의장) 한국어와 규칙이 다릅니다.
 */
function classifyUs(it: UsNewsItem): Archived {
  const tk = enMatch(`${it.title} ${it.description}`).sort();
  return {
    t: it.title,
    u: it.link,
    d: it.pubDate,
    c: "economy",
    th: themesOfTickers(tk).sort(),
    tk,
    s: it.source,
  };
}

type MonthFile = { month: string; updatedAt: string; items: Archived[] };

async function main() {
  // 한국어 피드와 영문 피드를 함께 받습니다. 한쪽이 죽어도 다른 쪽은 들어옵니다.
  const dead: string[] = [];
  const [koItems, usItems] = await Promise.all([
    fetchNews(),
    fetchUsNews((f) => dead.push(f.label)),
  ]);

  /*
   * 피드는 조용히 죽습니다 — 주소가 바뀌거나 형식이 Atom 으로 바뀌면 예외
   * 없이 0건이 됩니다. 그러면 몇 달 뒤에야 "요즘 기사가 적네" 하고 알게
   * 됩니다. 실행 때마다 눈에 띄게 찍어 둡니다.
   */
  if (dead.length) {
    console.warn(`[news] ⚠ 한 건도 못 받은 피드: ${dead.join(", ")}`);
  }
  if (koItems.length === 0) {
    console.warn("[news] ⚠ 한국어 피드(SBHNews)에서 한 건도 못 받았습니다.");
    dead.push("SBHNews");
  }

  /*
   * 죽은 피드를 파일에 적어 둡니다 — 자동 실행이 알아채게 하려고.
   *
   * 경고만 찍으면 아무도 안 봅니다. 이 코드 스스로 "몇 달 뒤에야 알게
   * 됩니다" 라고 적어 뒀는데 정말 그렇습니다. 그렇다고 여기서 그냥 멈추면
   * **이번에 받아 온 기사까지 커밋되지 못하고 날아갑니다.** 공개 피드는
   * 몇 시간치만 주므로 그건 되찾을 수 없는 손해입니다.
   *
   * 그래서 쌓는 일은 끝까지 마치고, 판정만 남겨 둡니다. 자동 실행이 커밋을
   * 끝낸 뒤에 이 파일을 보고 알립니다.
   *
   * 하나 죽은 것은 그날 그 매체가 잠깐 흔들린 것일 수 있어 넘어갑니다.
   * **절반 넘게 죽었으면** 흔들림이 아니라 고장입니다.
   */
  const feedCount = US_FEEDS.length + 1; // 영문 여섯 곳 + 한국어 한 곳
  const broken = dead.length > feedCount / 2;
  await writeFile(
    ".feed-health",
    JSON.stringify({ dead, feedCount, broken }) + "\n",
    "utf8",
  );

  if (koItems.length === 0 && usItems.length === 0) {
    console.error("[news] 어느 피드도 읽지 못했습니다. 기존 아카이브를 그대로 둡니다.");
    process.exit(0); // 실패해도 갱신 전체를 멈추지 않습니다
  }

  const koPicked = koItems
    .map(classify)
    .filter((x): x is Archived => x !== null);
  const usPicked = usItems.map(classifyUs);

  const picked = [...koPicked, ...usPicked];

  const bySource = new Map<string, number>();
  for (const a of usPicked) {
    bySource.set(a.s ?? "?", (bySource.get(a.s ?? "?") ?? 0) + 1);
  }

  console.log(
    `[news] 한국어 ${koItems.length}건 중 ${koPicked.length}건 보관 · ` +
      `영문 ${usItems.length}건 전부 보관 ` +
      `(${[...bySource].map(([s, n]) => `${US_FEED_LABEL[s] ?? s} ${n}`).join(", ")})`,
  );
  console.log(
    `[news] 그중 종목이 걸린 것 ${picked.filter((a) => a.tk.length > 0).length}건`,
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
  /*
   * 두 종류를 다른 기간으로 담습니다.
   *
   * 영문 피드를 붙이면서 하루 들어오는 기사가 열 배 넘게 늘었습니다. 예전처럼
   * 전부 90일치를 한 파일에 넣으면 수 MB가 됩니다. 쓰임새가 다르므로 나눕니다.
   *
   *   종목이 걸린 기사 — 90일. 종목 화면·매매노트·차트 표시가 과거를 되짚습니다
   *   시장 기사       — 10일. 홈 헤드라인과 보관함 앞부분에만 쓰입니다
   *
   * 장기 보관은 달별 파일이 계속 맡습니다. 여기서 빠져도 사라지지 않습니다.
   */
  const now = Date.now();
  const tickerCutoff = now - RECENT_DAYS * 86400000;
  const marketCutoff = now - MARKET_DAYS * 86400000;

  const tickerNews: Archived[] = [];
  const marketNews: Archived[] = [];
  for (const [, items] of byMonthAll(await readAllMonths())) {
    for (const a of items) {
      const t = new Date(a.d).getTime();
      if (a.tk.length > 0) {
        if (t >= tickerCutoff) tickerNews.push(a);
      } else if (t >= marketCutoff) {
        marketNews.push(a);
      }
    }
  }

  /*
   * 상한을 **종류별로 따로** 겁니다.
   *
   * 처음에는 합쳐 놓고 최신순으로 잘랐습니다. 그런데 시장 기사가 종목 기사보다
   * 대여섯 배 많이 들어오고(재어 보니 하루 99건 대 32건), 시장 기사는 열흘치라
   * 전부 최신입니다. 그러니 합쳐서 자르면 **잘려 나가는 것이 죄다 90일치 종목
   * 기사** 입니다 — 이 보관함이 존재하는 이유가 그 90일치인데 말입니다.
   * 홈 헤드라인용으로 며칠 쓰고 마는 시장 기사가 자리를 밀어냈습니다.
   *
   * 실제로 하루 130건 들어오면 종목 기사만 90일에 2,900건이 되어 합산 상한
   * 3,000건을 곧 넘깁니다. 며칠 안에 닿을 값이었습니다.
   */
  const cut = (list: Archived[], max: number) => {
    list.sort((a, b) => (a.d < b.d ? 1 : -1)); // 최신이 위로
    if (list.length <= max) return list;
    console.warn(
      `[news] ⚠ 상한에 걸려 ${list.length - max}건을 화면용에서 뺐습니다 ` +
        `(달별 파일에는 남아 있습니다)`,
    );
    return list.slice(0, max);
  };

  const recent = [...cut(tickerNews, MAX_TICKER), ...cut(marketNews, MAX_MARKET)];
  recent.sort((a, b) => (a.d < b.d ? 1 : -1));

  const recentFile = {
    updatedAt: new Date().toISOString(),
    days: RECENT_DAYS,
    marketDays: MARKET_DAYS,
    /** 출처는 기사마다 `s` 로 들어 있습니다. 여기 값은 한국어 피드 표기용입니다. */
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

/** 종목이 걸린 기사를 들고 갈 기간 */
const RECENT_DAYS = 90;
/** 종목이 안 걸린 시장 기사를 들고 갈 기간 */
const MARKET_DAYS = 10;
/**
 * 화면용 파일에 담을 최대 건수 — 종류별로 따로 겁니다.
 *
 * 종목 기사가 이 보관함의 값진 쪽이라 자리를 넉넉히 갖습니다. 시장 기사는
 * 홈 헤드라인과 보관함 앞부분에만 쓰이므로 열흘치가 다 들어갈 만큼만 둡니다.
 * 넘쳐도 달별 파일에는 그대로 남으므로 사라지지는 않습니다.
 */
const MAX_TICKER = 3000;
const MAX_MARKET = 1500;

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
