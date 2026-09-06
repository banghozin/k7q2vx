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
  /**
   * 개별 회사가 아닌 경우의 종류 ("ETF" · "우선주" · "SPAC" 등).
   * **없으면 개별 회사**입니다.
   */
  kind?: string;
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
   * 네 칸으로 나눠 담고 이 순서로 붙입니다.
   *
   *   ① 개별 회사 · 티커가 그 글자로 시작
   *   ② 개별 회사 · 그 밖에 걸림
   *   ③ ETF·우선주 등 · 티커가 그 글자로 시작
   *   ④ ETF·우선주 등 · 그 밖에 걸림
   *
   * 두 가지를 동시에 지키기 위해서입니다.
   *
   * **개별 회사가 먼저.** 나무에 있는 12,701개 중 ETF·우선주·SPAC 이 7,102개라
   * 절반이 넘습니다. 섞으면 찾던 회사가 ETF 더미에 묻힙니다.
   *
   * **티커로 시작하는 것이 먼저.** "MU" 를 쳤을 때 이름 안에 MU 가 든 종목이
   * 여덟 개 먼저 나오고 정작 마이크론이 안 보이면 검색이 아니라 방해입니다.
   */
  const bins: Hit[][] = [[], [], [], []];

  for (const row of rows) {
    const ticker = row[0];
    const name = row[1] ?? "";
    if (!ticker || seen.has(ticker)) continue;

    /*
     * **세 번째 칸이 있으면 개별 회사가 아닙니다.** 그 값은 화면에 보일 꼬리표인데,
     * 이름에 이미 "ETF" 가 들어 있는 경우엔 빈 문자열입니다 — 겹쳐 보이지 않게.
     * 그러니 "있는가" 와 "무엇을 보일까" 를 따로 봐야 합니다.
     */
    const isFund = row.length > 2;
    const kind = row[2] || undefined;

    const t = ticker.toUpperCase();
    const startsWith = t.startsWith(q);
    if (!startsWith && !t.includes(q) && !squash(name).includes(q)) continue;

    const bin = (isFund ? 2 : 0) + (startsWith ? 0 : 1);
    if (bins[bin].length >= room) continue;
    bins[bin].push({ ticker, name, curated: false, ...(kind ? { kind } : {}) });

    // 앞 칸이 이미 다 찼으면 더 볼 것이 없습니다
    if (bins[0].length >= room) break;
  }

  return [...curatedHits, ...bins.flat()].slice(0, limit);
}
