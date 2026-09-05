/**
 * 나무증권 취급 미국 종목 검색.
 *
 * "종목 찾기" 는 큐레이션한 186종목만 훑고 있었습니다. 그래서 나무에 멀쩡히
 * 있는 종목(메가 포춘·멀린 등)을 쳐도 아무것도 안 떴습니다. 층에 세우는 것은
 * 큐레이션이 하는 일이지만, **차트를 열어 보는 것까지 막을 이유는 없습니다.**
 *
 * 목록은 5,599종목이라 190KB 입니다. 페이지에 같이 실으면 안 열어 볼 사람에게도
 * 실려 가므로 **검색창에 첫 글자를 칠 때 한 번만** 받아옵니다. 받은 뒤에는
 * 모듈 안에 남아 다시 받지 않습니다.
 *
 * 목록은 `npm run namuh` 가 만듭니다.
 */

export type Hit = {
  ticker: string;
  name: string;
  /** 우리가 층에 세운 종목인가 — 검색 결과에서 위로 올립니다 */
  curated: boolean;
};

/**
 * JSON 은 `[["NVDA","엔비디아"], …]` 로 저장됩니다. 자리를 아끼려고 객체가
 * 아니라 짝으로 둔 것이라, 타입도 튜플이 아니라 배열로 받습니다 — JSON 을
 * 가져오면 타입스크립트가 `string[][]` 로 읽기 때문입니다.
 */
export type Row = readonly string[];

let cache: Row[] | null = null;
let inflight: Promise<Row[]> | null = null;

/**
 * 띄어쓰기와 가운뎃점을 지웁니다.
 *
 * 나무 표기는 "메가 포춘" 인데 사람은 "메가포춘" 이라고 붙여 씁니다. 이걸
 * 안 지우면 정작 찾으려던 종목이 안 나옵니다. 실제로 이 문제로 검색이
 * 안 된다는 이야기가 나왔습니다.
 */
function squash(s: string): string {
  return s.replace(/[\s·.,&\-()]/g, "").toUpperCase();
}

/** 목록을 받아옵니다. 여러 번 불러도 요청은 한 번만 나갑니다. */
export async function loadNamuhList(): Promise<Row[]> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = import("@/data/generated/namuh-us.json")
    .then((m) => {
      const rows: Row[] = (m.default ?? m).stocks ?? [];
      cache = rows;
      return rows;
    })
    .catch(() => {
      // 못 받아도 화면이 멈추면 안 됩니다. 큐레이션 종목 검색은 계속 됩니다.
      cache = [];
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/**
 * 검색.
 *
 * `curatedHits` 는 이미 찾아 둔 큐레이션 종목입니다. 그걸 위에 놓고, 모자란
 * 만큼만 나무 전체에서 채웁니다. 층에 세운 종목이 먼저 보여야 합니다 —
 * 그쪽은 "왜 이 층인가" 가 붙어 있는 종목이니까요.
 */
export function searchNamuh(
  rows: readonly Row[],
  query: string,
  curatedHits: Hit[],
  limit: number,
): Hit[] {
  const q = squash(query);
  if (q.length === 0) return curatedHits.slice(0, limit);

  const room = limit - curatedHits.length;
  if (room <= 0) return curatedHits.slice(0, limit);

  const seen = new Set(curatedHits.map((h) => h.ticker));

  /*
   * 티커가 그 글자로 **시작하는** 것을 먼저 봅니다. "MU" 를 쳤을 때 이름 안에
   * MU 가 들어간 종목 여덟 개가 먼저 나오고 정작 마이크론이 안 보이면
   * 검색이 아니라 방해입니다.
   */
  const starts: Hit[] = [];
  const contains: Hit[] = [];

  for (const row of rows) {
    const ticker = row[0];
    const name = row[1] ?? "";
    if (!ticker || seen.has(ticker)) continue;
    const t = ticker.toUpperCase();
    if (t.startsWith(q)) {
      starts.push({ ticker, name, curated: false });
      if (starts.length >= room) break;
      continue;
    }
    if (contains.length < room && (t.includes(q) || squash(name).includes(q))) {
      contains.push({ ticker, name, curated: false });
    }
  }

  return [...curatedHits, ...starts, ...contains].slice(0, limit);
}
