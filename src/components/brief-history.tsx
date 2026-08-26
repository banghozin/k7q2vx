import Link from "next/link";
import { getTheme } from "@/data/themes";
import { type BriefingDay, briefingHistory } from "@/lib/market-data";

/**
 * 지난 며칠 브리핑을 모아 본 것.
 *
 * 한 줄 브리핑은 **오늘 것만** 보여 줍니다. 그래서 "이번 주에 어느 층이 계속
 * 앞에 있었나" 를 알 수 없었습니다. 하루 한 번 쌓아 둔 기록으로 그걸 셉니다.
 *
 * 세는 것은 두 가지뿐입니다.
 *   - 그 테마에서 **가장 여러 날 1위였던 층**
 *   - 층 사이 **자리바꿈이 있었던 날 수**
 *
 * 둘 다 "며칠 중 며칠" 이라는 사실이지 앞날에 대한 말이 아닙니다. 분모를
 * 숨기지 않는 이유는 동조율과 같습니다 — 3일치로 센 것과 20일치로 센 것을
 * 같은 얼굴로 내보내면 안 됩니다.
 *
 * 기록이 사흘도 안 쌓였으면 **아무것도 내보내지 않습니다.** 반쯤 채워진 표는
 * 없느니만 못합니다.
 */

const MIN_DAYS = 3;

type Row = {
  slug: string;
  name: string;
  top: { n: number; name: string; days: number } | null;
  rotatedDays: number;
};

function tally(days: BriefingDay[]): Row[] {
  const rows: Row[] = [];

  for (const slug of themeSlugsIn(days)) {
    const theme = getTheme(slug);
    if (!theme) continue;

    const seen = new Map<string, { n: number; name: string; days: number }>();
    let rotatedDays = 0;

    for (const day of days) {
      const b = day.themes[slug];
      if (!b) continue;
      if (b.rotated) rotatedDays++;
      if (!b.hottest) continue;
      const key = `${b.hottest.n}`;
      const cur = seen.get(key);
      if (cur) cur.days++;
      else seen.set(key, { n: b.hottest.n, name: b.hottest.name, days: 1 });
    }

    const top =
      [...seen.values()].sort((a, b) => b.days - a.days)[0] ?? null;
    rows.push({ slug, name: theme.name, top, rotatedDays });
  }

  // 자리바꿈이 잦았던 테마부터 — 지금 안이 흔들리고 있는 곳입니다
  return rows.sort((a, b) => b.rotatedDays - a.rotatedDays);
}

function themeSlugsIn(days: BriefingDay[]): string[] {
  const set = new Set<string>();
  for (const d of days) for (const slug of Object.keys(d.themes)) set.add(slug);
  return [...set];
}

export function BriefHistory() {
  const days = briefingHistory(7);
  if (days.length < MIN_DAYS) return null;

  const rows = tally(days);
  if (rows.length === 0) return null;

  const n = days.length;
  const from = days[0].asOf;
  const to = days[n - 1].asOf;

  return (
    <div className="wrap">
      <section className="section">
        <h2 className="section__title">지난 {n}일 동안</h2>
        <p className="section__sub">
          하루 한 번 적어 둔 브리핑을 모아 셌습니다.{" "}
          <span className="mono">{from}</span> 부터{" "}
          <span className="mono">{to}</span> 까지 <strong>{n}일치</strong>입니다.
          며칠 중 며칠인지를 그대로 적었습니다. 지나간 기록이며 앞날에 대한 말이
          아닙니다.
        </p>

        <ul className="bhist">
          {rows.map((r) => (
            <li key={r.slug} className="bhist__row">
              <Link href={`/theme/${r.slug}`} className="bhist__theme">
                {r.name}
              </Link>
              <span className="bhist__top">
                {r.top ? (
                  <>
                    <strong>
                      {r.top.n}층 {r.top.name}
                    </strong>
                    <span className="bhist__count mono">
                      {r.top.days}/{n}일 1위
                    </span>
                  </>
                ) : (
                  <span className="bhist__count">—</span>
                )}
              </span>
              <span className="bhist__rot mono">
                {r.rotatedDays > 0 ? `자리바꿈 ${r.rotatedDays}일` : "잠잠"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
