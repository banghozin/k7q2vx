/**
 * 나무증권 취급 종목 검사.
 *
 * 이 사이트는 **미국 개별종목을 매매하는 한국인**을 위한 것입니다. 나무증권에서
 * 살 수 없는 종목을 층에 세워 두면 "그래서 뭘 사면 되나" 라는 물음에 답이
 * 안 됩니다. 그래서 큐레이션한 종목이 전부 나무 취급 목록에 있는지 봅니다.
 *
 * ── 왜 이 검사가 따로 필요한가 ──────────────────────────────────────
 *
 * `npm run validate` 는 "티커가 응답하는가" 만 봅니다. 그런데 **티커는 살아
 * 있는데 다른 회사가 되어 있는** 경우가 있습니다. 상장폐지된 회사의 티커를
 * 거래소가 다른 종목에 다시 내주기 때문입니다. 2026-09-06 에 둘을 잡았습니다.
 *
 *   GOGL  골든 오션 그룹(벌크선) → Corgi GOOGL 2배 레버리지 ETF  (2026-06-26~)
 *   LAZR  루미나 테크놀로지스(라이다) → Tema Photonics ETF        (2026-06-30~)
 *
 * 둘 다 야후에서 정상 응답하고, 야후는 종류를 `EQUITY` 로 줍니다. 그래서
 * 기존 검사로는 잡히지 않았습니다. 나무 마스터의 **종목구분** 이 잡아냅니다.
 *
 * ── 자료 출처 ──────────────────────────────────────────────────────
 *
 * NH투자증권이 공개해 둔 해외주식 종목마스터입니다.
 *   https://www.nhplug.com/instruments/m_gtsstock.mst
 *
 * **계좌도 인증도 필요 없습니다.** 앱키 없이 그냥 받아집니다(2026-09-06 확인).
 * 미국 12,701종목이 들어 있고 한글 종목명도 함께 옵니다.
 *
 * 고정폭 이진 파일입니다 — 한 레코드 164바이트, 인코딩 CP949, 마지막
 * 1바이트가 줄바꿈. 구조는 같은 자리의 `m_gtsstock.h` 에 적혀 있습니다.
 *
 * ⚠️ 마스터에 **"거래 가능" 을 가르는 필드는 없습니다.** `gPosTrade`(거래가능
 * 구분)·`gListed`(상장구분) 는 12,701건이 전부 같은 값이라 아무것도 못
 * 가릅니다 — NH 가 배포하는 헤더 파일에도 "실측 전부 1 → 사실상 단일값"
 * 이라고 적혀 있습니다. `sIndustryKorea`(한국업종코드) 도 9999/공백뿐입니다.
 * 그러므로 **마스터에 있다 = 나무가 취급한다** 로 봅니다. 장외(PNK)가
 * 12,701건 중 1건뿐인 것도 이 해석과 맞습니다(거래소 상장분만 들어 있음).
 *
 * 실행: npm run namuh
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { BENCHMARKS, themeTickers } from "./lib/universe";
import { THEMES } from "../src/data/themes";

const MASTER_URL = "https://www.nhplug.com/instruments/m_gtsstock.mst";
const CACHE_DIR = ".cache";
const CACHE_FILE = `${CACHE_DIR}/m_gtsstock.mst`;

/** 하루 지난 캐시는 다시 받습니다. 마스터는 영업일마다 새로 만들어집니다. */
const CACHE_MAX_AGE_MS = 20 * 60 * 60 * 1000;

/** 레코드 한 줄의 길이. 마지막 1바이트(0x0A)까지 포함한 값입니다. */
const RECORD = 164;

/**
 * 필드 정의 — 이름과 길이(바이트). `m_gtsstock.h` 를 그대로 옮긴 것이라
 * 순서를 바꾸면 안 됩니다. 지금 쓰는 것만 주석을 답니다.
 */
const FIELDS: [name: string, len: number][] = [
  ["gic", 15],
  ["korName", 40], // 한글종목명
  ["engName", 40],
  ["nation", 3], // 국가코드 (USA)
  ["symbol", 12], // 심볼 (NVDA)
  ["exch", 3], // 거래소 NYY=NYSE NQQ=나스닥 BTQ=Cboe ASQ=AMEX
  ["isin", 12],
  ["issue", 2], // 종목구분 — 아래 ISSUE_KIND 참고
  ["indReuter", 4],
  ["indKorea", 4],
  ["lock", 2],
  ["posTrade", 1],
  ["payMoney", 3],
  ["listed", 1],
  ["topix100", 1],
  ["originNation", 3],
  ["originSymbol", 12],
  ["originCurrency", 3],
  ["decimalPoint", 1],
  ["tradePoint", 1],
  ["eol", 1],
];

/**
 * 종목구분 코드. NH 헤더 파일에 적힌 것에, 실제 자료에서 확인한 것을 보탰습니다.
 */
const ISSUE_KIND: Record<string, string> = {
  "01": "보통주",
  "02": "우선주·채권형",
  "03": "SPAC 유닛",
  "06": "결합증권",
  "07": "예탁증서(ADR·CDI)",
  "09": "신주인수권",
  "10": "폐쇄형 펀드",
  "11": "암호화폐 ETP",
  "12": "ETF",
  "13": "ETN",
  "14": "실물자산 ETC",
};

/**
 * 층에 세워도 되는 종류. **개별 회사만** 둡니다.
 *
 * ETF·ETN 은 여러 회사를 묶은 것이라 "이 회사가 이 층에 있는 이유" 를 한 줄로
 * 쓸 수 없습니다. 벤치마크(SPY·QQQ)는 층에 세우지 않고 상대강도 계산에만
 * 쓰므로 애초에 검사 대상이 아닙니다.
 */
const ALLOWED_ISSUES = new Set(["01", "07"]);

type Record_ = Record<string, string>;

/** 마스터 내려받기 — 하루 안 지난 캐시가 있으면 그걸 씁니다. */
async function loadMaster(): Promise<Buffer> {
  try {
    const s = await stat(CACHE_FILE);
    if (Date.now() - s.mtimeMs < CACHE_MAX_AGE_MS) {
      console.log(`[namuh] 캐시 사용 (${(s.size / 1e6).toFixed(1)}MB)`);
      return await readFile(CACHE_FILE);
    }
  } catch {
    // 캐시 없음 — 받으면 됩니다
  }

  console.log(`[namuh] 종목마스터를 받는 중…`);
  const res = await fetch(MASTER_URL, {
    // 한글이 들어간 User-Agent 는 거절당하는 서버가 있어 ASCII 로만 씁니다.
    headers: { "User-Agent": "theme-map/1.0 (+https://stocksinfo.vercel.app)" },
  });
  if (!res.ok) throw new Error(`마스터를 받지 못했습니다 — HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  if (buf.length === 0 || buf.length % RECORD !== 0) {
    throw new Error(
      `마스터 크기가 이상합니다 (${buf.length}바이트). ` +
        `${RECORD}로 나누어떨어져야 합니다 — 규격이 바뀌었을 수 있습니다.`,
    );
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, buf);
  console.log(`[namuh] 받음 — ${(buf.length / 1e6).toFixed(1)}MB · ${buf.length / RECORD}종목`);
  return buf;
}

/** 고정폭 이진 파일을 레코드 배열로 풉니다. */
function parse(buf: Buffer): Record_[] {
  const dec = new TextDecoder("windows-949");
  const offsets: number[] = [];
  let acc = 0;
  for (const [, len] of FIELDS) {
    offsets.push(acc);
    acc += len;
  }

  const rows: Record_[] = [];
  for (let i = 0; i + RECORD <= buf.length; i += RECORD) {
    const row: Record_ = {};
    FIELDS.forEach(([name, len], k) => {
      const from = i + offsets[k];
      row[name] = dec.decode(buf.subarray(from, from + len)).trim();
    });
    rows.push(row);
  }
  return rows;
}

/** 큐레이션에 적어 둔 한글 이름 (티커 → 이름) */
function curatedNames(): Map<string, string> {
  const m = new Map<string, string>();
  for (const theme of THEMES) {
    for (const layer of theme.layers) {
      for (const s of layer.stocks) {
        m.set(s.ticker.trim().toUpperCase(), s.name);
      }
    }
  }
  return m;
}

async function main() {
  const buf = await loadMaster();
  const rows = parse(buf);

  const us = rows.filter((r) => r.nation === "USA");
  const bySymbol = new Map<string, Record_>();
  for (const r of us) {
    // 같은 심볼이 두 번 나오면 앞의 것을 남깁니다 (실제 자료에서는 중복이 없습니다)
    if (!bySymbol.has(r.symbol)) bySymbol.set(r.symbol, r);
  }
  console.log(`[namuh] 미국 ${us.length}종목 · 전체 ${rows.length}종목`);

  const bench = new Set<string>(BENCHMARKS);
  const tickers = themeTickers().filter((t) => !bench.has(t));
  const names = curatedNames();

  const absent: string[] = [];
  const wrongKind: { t: string; kind: string; ko: string; en: string }[] = [];
  const renamed: { t: string; ours: string; theirs: string }[] = [];

  for (const t of tickers) {
    const r = bySymbol.get(t);
    if (!r) {
      absent.push(t);
      continue;
    }
    if (!ALLOWED_ISSUES.has(r.issue)) {
      wrongKind.push({
        t,
        kind: ISSUE_KIND[r.issue] ?? `알 수 없음(${r.issue})`,
        ko: r.korName,
        en: r.engName,
      });
      continue;
    }
    const ours = names.get(t);
    if (ours && r.korName && !sameName(ours, r.korName)) {
      renamed.push({ t, ours, theirs: r.korName });
    }
  }

  console.log(
    `[namuh] 큐레이션 ${tickers.length}종목 중 ` +
      `나무 취급 ${tickers.length - absent.length} · ` +
      `개별회사 ${tickers.length - absent.length - wrongKind.length}`,
  );

  /*
   * 이름 차이는 대부분 표기 취향입니다("노스럽 그러먼" ↔ "노스롭 그루만").
   * 매번 서른 줄씩 쏟아지면 목록을 안 보게 되므로 셈만 보이고, 볼 사람이
   * `--names` 로 펼치게 합니다. 그래도 이 목록에 값이 있습니다 — 회사가
   * 사명을 바꾼 것이 여기 섞여 나옵니다(CIFR 사이퍼 마이닝 → 사이퍼 디지털).
   */
  if (renamed.length) {
    if (process.argv.includes("--names")) {
      console.log(`\n[namuh] 나무 표기와 다른 이름 ${renamed.length}개 (참고용, 멈추지 않습니다):`);
      for (const r of renamed) console.log(`   ${r.t.padEnd(6)} 우리: ${r.ours}   나무: ${r.theirs}`);
    } else {
      console.log(
        `[namuh] 나무와 표기가 다른 이름 ${renamed.length}개 — 보려면 \`npm run namuh -- --names\``,
      );
    }
  }

  let bad = false;

  if (absent.length) {
    bad = true;
    console.error(`\n[namuh] 나무 취급 목록에 없는 종목 ${absent.length}개:`);
    for (const t of absent) console.error(`   ${t}`);
    console.error(
      `   → 나무증권에서 살 수 없는 종목입니다. src/data/themes/ 에서 빼세요.`,
    );
  }

  if (wrongKind.length) {
    bad = true;
    console.error(`\n[namuh] 개별 회사가 아닌 종목 ${wrongKind.length}개:`);
    for (const w of wrongKind) {
      console.error(`   ${w.t.padEnd(6)} ${w.kind} — ${w.ko || w.en}`);
    }
    console.error(
      `   → 티커가 다른 종목에 재배정되었을 수 있습니다. 큐레이션에 적힌\n` +
        `      회사와 같은 회사가 맞는지 확인하세요.`,
    );
  }

  await writeSearchList(us);

  if (bad) process.exit(1);
  console.log(`\n[namuh] 전부 통과.`);
}

/**
 * 검색용 목록을 뽑아 둡니다 → `src/data/generated/namuh-us.json`
 *
 * 화면의 "종목 찾기" 는 큐레이션한 186종목만 훑고 있었습니다. 그래서 나무에
 * 멀쩡히 있는 종목(메가 포춘·멀린 등)을 쳐도 아무것도 안 떴습니다. 층에
 * 세우는 것은 큐레이션이 하는 일이지만, **차트를 열어 보는 것까지 막을
 * 이유는 없습니다.**
 *
 * 개별 회사(보통주·예탁증서)만 담습니다. ETF·ETN·우선주·SPAC 유닛·
 * 신주인수권은 뺍니다 — 5,600개가 15,000개가 되면 검색이 쓰레기가 됩니다.
 *
 * 영문명은 넣지 않습니다. 한글명과 티커로 덮이는 데다, 넣으면 파일이 두 배
 * (51KB → 87KB, 압축 후)가 됩니다. 이 파일은 **검색창에 첫 글자를 칠 때**
 * 받아오므로 페이지 용량에는 영향이 없습니다.
 */
async function writeSearchList(us: Record_[]) {
  const list = us
    .filter((r) => ALLOWED_ISSUES.has(r.issue) && r.symbol && r.korName)
    .map((r) => [r.symbol, r.korName] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const out = {
    generatedAt: new Date().toISOString(),
    source: "NH투자증권 해외주식 종목마스터 (m_gtsstock.mst)",
    note: "보통주·예탁증서만. 층 배치가 아니라 검색·차트 열람용입니다.",
    count: list.length,
    stocks: list,
  };

  const path = "src/data/generated/namuh-us.json";
  await writeFile(path, JSON.stringify(out) + "\n");
  console.log(`[namuh] 검색 목록 ${list.length}종목 → ${path}`);
}

/**
 * 이름이 사실상 같은지 봅니다.
 *
 * 나무 표기와 우리 표기는 띄어쓰기·법인격 꼬리표에서 자주 갈립니다
 * ("마이크론 테크놀로지" ↔ "마이크론"). 그런 차이로 매번 시끄러워지면
 * 목록을 안 보게 되므로, **한쪽이 다른 쪽으로 시작하면** 같은 것으로 봅니다.
 */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/\(.*?\)/g, "");
  const x = norm(a);
  const y = norm(b);
  return x === y || x.startsWith(y) || y.startsWith(x);
}

main().catch((e) => {
  console.error("[namuh] 예기치 못한 오류:", e);
  process.exit(1);
});
