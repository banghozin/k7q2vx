/**
 * 영문 기사에서 우리 종목을 찾아내는 판정.
 *
 * 한국어 판정(`news-match.ts`)과 규칙이 다릅니다. 영어는 회사 이름이
 * **일상어와 훨씬 자주 겹칩니다.** 실제 데이터를 훑어보고 확인한 것:
 *
 *   Powell Industries(POWL) → 첫 낱말이 "Powell". 연준 의장 기사가 전부 걸립니다
 *   Advanced Micro Devices  → 첫 낱말이 "Advanced". AEIS 와도 겹칩니다
 *   Applied Materials       → "Applied"
 *   The Boeing / The Bank…  → 첫 낱말이 "The"
 *   Cloudflare(NET)         → 티커가 "NET"
 *   SentinelOne(S)          → 티커가 한 글자
 *
 * 그래서 두 가지를 지킵니다.
 *
 * 1. **대소문자를 구별합니다.** "intel" 과 "Intel", "net" 과 "NET" 은 다릅니다.
 *    한국어 판정은 대문자로 통일해 비교하지만 여기서는 그러면 안 됩니다.
 * 2. **티커를 맨몸으로 잡는 건 안전한 것만.** 나머지는 금융 기사의 관례
 *    표기 — `(NVDA)`, `$NVDA`, `NASDAQ: NVDA` — 일 때만 잡습니다.
 *
 * 판정 코드를 여기 따로 둔 이유는 회귀 테스트가 **이 코드를 그대로** 쓰게
 * 하기 위해서입니다(`npx tsx scripts/test-en-match.ts`).
 */

import namesJson from "@/data/generated/names.json";

type NamesFile = { generatedAt: string; names: Record<string, string> };

const NAMES = (namesJson as unknown as NamesFile).names ?? {};

/** 회사 이름 뒤에 붙는 법인 형태. 기사에서는 거의 안 쓰므로 떼어냅니다. */
const SUFFIX =
  /[,]?\s*\b(?:Inc\.?|Incorporated|Corporation|Corp\.?|Compan(?:y|ies)|Co\.?|Limited|Ltd\.?|plc|PLC|LLC|L\.P\.|LP|N\.V\.|NV|S\.A\.|SA|AB|ASA|Holdings?|Group|Trust|REIT|and Company)\b\.?/g;

/**
 * 첫 낱말 별칭으로 **쓰면 안 되는** 말.
 *
 * 위 목록을 실제로 뽑아 눈으로 훑어 고른 것입니다. 일상어이거나, 유명한
 * 사람·지명과 겹치거나, 두 종목이 같은 첫 낱말을 쓰는 경우입니다.
 * 여기 있어도 **회사 이름 전체**("Powell Industries")가 나오면 정상적으로 걸립니다.
 */
const STOP_HEADS = new Set([
  // 관사·일반 형용사
  "The", "Advanced", "Applied", "General", "International", "Global",
  "National", "American", "Western", "West", "Eastern", "Northern",
  "Southern", "First", "Standard", "United", "Allied",
  // 산업 일반 명사 — 테마 이름과 그대로 겹칩니다
  "Digital", "Energy", "Power", "Quantum", "Lithium", "Uranium", "Solar",
  "Nuclear", "Cipher", "Core", "Motors", "Materials", "Semiconductor",
  // 사람·지명과 겹침
  "Powell",   // 연준 의장 제롬 파월
  "Charles",  // Charles River
  "Huntington",
  "Palo",     // "Palo Alto" 전체로는 걸립니다
  "Novo",     // "Novo Nordisk" 전체로는 걸립니다
  "Taiwan",   // 나라 이름
  "Sociedad",
  // 흔한 낱말
  "Star", "Solid", "Serve", "Super", "Check", "Planet", "Circle", "Block",
  "Strategy", "Rocket", "Regal", "Rhythm", "Viking", "Aurora", "Blink",
  "Frontline", "Pony", "Corgi", "Hut", "Tema", "Strive", "Genco", "Scorpio",
  "Matson", "Expeditors", "Denison", "Centrus", "Arm",
  // 시험에서 걸린 것 — "Riot police", "the ouster of the CEO",
  // "a tenable position", "a coherent policy" 가 전부 회사로 잡혔습니다
  "Riot", "Ouster", "Tenable", "Coherent",
  // 앞의 `The` 를 떼면서 새로 첫 낱말이 된 것. "Bank shares rose" 처럼
  // 아무 은행 기사에나 걸립니다 — 전체 이름일 때만 잡습니다
  "Bank",
]);

/**
 * 맨몸 대문자로 잡으면 안 되는 티커.
 *
 * 영어 문장 안에서 다른 뜻으로 읽히거나 너무 짧은 것들입니다. 이것들도
 * `(NET)` `$NET` `NYSE: NET` 처럼 **관례 표기**로 나오면 정상적으로 걸립니다.
 */
const AMBIGUOUS_TICKERS = new Set([
  "ALB", "ALT", "AME", "ARM", "AUR", "BA", "CRL", "DHT", "EME", "F", "FORM",
  "FRO", "GD", "GE", "GM", "HII", "HUT", "IBM", "LAC", "LEU", "LITE", "MARA",
  "META", "MP", "MU", "NET", "ON", "PH", "PL", "PONY", "QS", "RIOT", "RR",
  "S", "SAIL", "SERV", "SMR", "SYM", "TER", "VC", "WST", "XYZ", "ZIM",
  "ALL", "AGX", "ART", "CEO", "IT", "US", "AI", "EV", "PC",
]);

/**
 * 회사 이름이 그 분야 이름과 **똑같은** 것.
 *
 * "Quantum Computing Inc."(QUBT) 가 그렇습니다. 양자컴퓨팅 기사 제목은
 * 대체로 제목 대문자라 고유명사 검사로도 안 걸러집니다. 이름으로 잡는 걸
 * 포기하고 `(QUBT)` `$QUBT` 같은 관례 표기일 때만 잡습니다.
 */
const GENERIC_FULL_NAMES = new Set(["Quantum Computing"]);

function stripSuffix(name: string): string {
  let s = name;
  // 여러 겹으로 붙는 경우가 있습니다 ("… Holdings, Inc.")
  for (let i = 0; i < 4; i++) s = s.replace(SUFFIX, " ");
  /*
   * 앞의 `The` 도 뗍니다. 야후는 `The Boeing Company`,
   * `The Bank of New York Mellon Corporation` 이라고 주는데 기사는 그냥
   * `Boeing`, `Bank of New York Mellon` 이라고 씁니다. 안 떼면 이 둘을
   * 통째로 놓칩니다(실제로 놓치고 있었습니다).
   */
  s = s.replace(/^The\s+/i, "");
  return s.replace(/[,\s]+$/g, "").replace(/\s{2,}/g, " ").trim();
}

/** 이름 → 티커. 회사 이름 전체와, 안전한 경우에만 첫 낱말. */
export function buildEnMatchers() {
  const byName = new Map<string, string>();
  const heads = new Map<string, string[]>();

  for (const [ticker, raw] of Object.entries(NAMES)) {
    const full = stripSuffix(raw);

    /*
     * 회사 이름이 **한 낱말**이면 그 자체가 첫 낱말이기도 합니다. 그래서
     * 아래 첫 낱말 검사를 그냥 통과해 버리는 구멍이 있었습니다 — Strategy
     * (MSTR), Tenable, Ouster, Arm 이 전부 일상어 그대로입니다.
     * 한 낱말짜리 이름은 여기서도 같은 목록으로 거릅니다. 걸러진 종목은
     * `(MSTR)` `$TENB` 같은 관례 표기로만 잡힙니다.
     */
    const oneWord = !full.includes(" ");
    if (
      full.length >= 3 &&
      !(oneWord && STOP_HEADS.has(full)) &&
      !GENERIC_FULL_NAMES.has(full)
    ) {
      byName.set(full, ticker);
    }

    const head = full.split(/\s+/)[0].replace(/[.,]+$/, "");
    if (head.length >= 4 && /^[A-Za-z][A-Za-z0-9.\-]*$/.test(head)) {
      heads.set(head, [...(heads.get(head) ?? []), ticker]);
    }
  }

  for (const [head, tickers] of heads) {
    // 두 종목이 같은 첫 낱말을 쓰면 어느 쪽인지 알 수 없으므로 버립니다
    if (tickers.length > 1) continue;
    if (STOP_HEADS.has(head)) continue;
    if (!byName.has(head)) byName.set(head, tickers[0]);
  }

  return { byName, tickers: new Set(Object.keys(NAMES)) };
}

const { byName, tickers } = buildEnMatchers();

/** 정규식에 넣을 수 있게 특수문자를 막습니다 */
function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 낱말 경계 판정.
 *
 * 앞뒤가 영문·숫자면 다른 낱말의 일부입니다. **하이픈도 막습니다** —
 * "Meta-analysis" 가 메타로, "e-Core" 가 코어로 걸리는 걸 막기 위해서입니다.
 * 소유격(`Nvidia's`)은 통과시켜야 하므로 어퍼스트로피는 허용합니다.
 */
function boundedMatch(text: string, needle: string): boolean {
  const re = new RegExp(`(^|[^A-Za-z0-9\\-])${esc(needle)}($|[^A-Za-z0-9\\-])`);
  return re.test(text);
}

/**
 * 영문 기사에서 티커를 찾습니다.
 *
 * 두 갈래입니다.
 *   1. 관례 표기 — `(NVDA)` `$NVDA` `NASDAQ: NVDA` `NYSE:NVDA`
 *      이건 사람이 일부러 종목을 가리킨 것이라 무조건 믿습니다.
 *   2. 맨몸 대문자 — 애매하지 않은 티커일 때만.
 */
export function enTickersIn(text: string): string[] {
  const hit = new Set<string>();
  for (const t of tickers) {
    const e = esc(t);
    const explicit = new RegExp(
      `[($]${e}[)\\s,.]|\\$${e}\\b|\\b(?:NASDAQ|Nasdaq|NYSE|NYSEARCA|AMEX|OTC)\\s*:\\s*${e}\\b`,
    );
    if (explicit.test(text)) {
      hit.add(t);
      continue;
    }
    if (t.length < 3 || AMBIGUOUS_TICKERS.has(t)) continue;
    if (boundedMatch(text, t)) hit.add(t);
  }
  return [...hit];
}

/**
 * 실제 기사에 쓰인 표기가 **고유명사 꼴**인가.
 *
 * 회사 이름은 낱말마다 대문자로 시작합니다("Applied Materials"). 반대로
 * 그냥 문장이면 첫 낱말만 대문자입니다("Applied materials science…").
 * 이 차이로 둘을 가릅니다. 세 글자 미만의 이음말(of, and, the)은 원래
 * 소문자로 쓰므로 검사에서 뺍니다.
 */
function properNoun(matched: string): boolean {
  const words = matched.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every(capitalized);
}

/**
 * 낱말 하나가 이름의 일부로 쓰인 꼴인가.
 *
 * 대문자로 시작하면 됩니다. 두 가지 예외가 있습니다.
 *   - 두 글자 미만의 이음말(of·and·the)은 원래 소문자로 씁니다
 *   - **소문자로 시작하는 상표**가 있습니다. `nVent Electric`(NVT) 이 그렇고,
 *     iRobot·eBay 도 같은 꼴입니다. 뒤에 대문자가 있으면 이름으로 봅니다.
 *     이걸 안 넣으면 nVent 기사가 통째로 안 걸립니다(실제로 그랬습니다).
 */
function capitalized(w: string): boolean {
  if (w.length < 3) return true;
  if (/^[A-Z]/.test(w)) return true;
  return /^[a-z][A-Z]/.test(w);
}

/**
 * 영문 기사에서 회사 이름을 찾습니다.
 *
 * 대소문자를 **완전히** 구별하면 안 됩니다. 야후는 `NVIDIA Corporation`,
 * `QUALCOMM`, `GLOBALFOUNDRIES` 처럼 로고 표기를 그대로 주는데 기사는
 * `Nvidia`, `Qualcomm`, `GlobalFoundries` 라고 씁니다. 그대로 비교하면
 * 엔비디아 기사를 통째로 놓칩니다(시험에서 잡혔습니다).
 *
 * 그렇다고 무시하면 동사 `applied`, 명사 `net` 이 회사로 걸립니다.
 * 그래서 **철자는 무시하되 첫 글자는 대문자여야 한다**로 정합니다.
 * 문장 첫머리의 일상어가 걸릴 여지는 남지만, 그건 위 STOP_HEADS 가 맡습니다.
 */
export function enNamesIn(text: string): string[] {
  const hit = new Set<string>();
  for (const [name, ticker] of byName) {
    /*
     * **나온 자리를 전부 봅니다.** 처음 걸린 것만 보면 낱말 순서에 따라
     * 답이 달라집니다. 실제로 이랬습니다(2026-08-27):
     *   "lucid dreaming … Lucid shares rose"  → 못 잡음
     *   "Lucid shares rose … lucid dreaming"  → 잡음
     * "intel sources say Intel will delay the fab" 처럼 흔한 문장에서
     * 종목을 통째로 놓칩니다. 하나라도 이름 꼴이면 걸린 것으로 봅니다.
     */
    const re = new RegExp(
      `(^|[^A-Za-z0-9\\-])(${esc(name)})($|[^A-Za-z0-9\\-])`,
      "gi",
    );
    for (const m of text.matchAll(re)) {
      if (properNoun(m[2])) {
        hit.add(ticker);
        break;
      }
    }
  }
  return [...hit];
}

/** 둘을 합쳐서 */
export function enMatch(text: string): string[] {
  return [...new Set([...enTickersIn(text), ...enNamesIn(text)])].sort();
}
