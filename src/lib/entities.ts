/**
 * HTML 문자 참조(&amp; &#x2014; &#233; …)를 글자로 되돌립니다.
 *
 * 예전 해독기는 이름 붙은 몇 개만 알았습니다. 그래서 미국 피드 제목에
 * `&#x2014;`(—) `&#xE9;`(é) `&#x20AC;`(€) 가 그대로 남았고, 한 번 더
 * 감싸 보내는 피드(`&amp;quot;`)는 `&quot;` 로 화면에 나왔습니다. 2026-11
 * 기준 보관 기사 16,206건 중 약 350건이 그랬습니다.
 *
 * **두 번까지** 풉니다 — 두 겹으로 감싼 피드가 실제로 있습니다. 제목에
 * `&amp;lt;` 같은 글자를 일부러 쓰는 일은 사실상 없어 과하게 풀 걱정은 작습니다.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  euro: "€",
  pound: "£",
  yen: "¥",
  copy: "©",
  reg: "®",
  trade: "™",
};

function once(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      return String.fromCodePoint(code);
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

export function decodeEntities(s: string): string {
  const out = once(once(s));
  // 줄바꿈 없는 공백·폭 없는 공백은 제목에서 보통 공백·없음으로
  return out.replace(/ /g, " ").replace(/[​‌‍﻿]/g, "");
}
