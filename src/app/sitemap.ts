import type { MetadataRoute } from "next";
import { THEMES } from "@/data/themes";
import { SITE_URL } from "./layout";
import { asOf } from "@/lib/market-data";

/**
 * 검색엔진에 "여기 이런 쪽들이 있다" 고 알려 주는 목록.
 *
 * 테마 열한 쪽은 손으로 쓴 설명이 들어 있어 검색으로 찾아올 값이 있습니다.
 * 반대로 **도구 쪽(분석·훈련·매매노트·워치리스트)은 넣지 않습니다** — 내용이
 * 전부 그 사람 기기에 있어서 검색 결과로 들어와 봐야 빈 화면입니다.
 *
 * `lastModified` 는 시세 기준일을 씁니다. 데이터가 바뀐 날이 곧 쪽이 바뀐
 * 날입니다. 아직 계산 결과가 없으면 오늘로 둡니다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const updated = asOf ? new Date(`${asOf}T00:00:00Z`) : new Date();

  return [
    { url: SITE_URL, lastModified: updated, changeFrequency: "daily", priority: 1 },
    {
      url: `${SITE_URL}/news`,
      lastModified: updated,
      changeFrequency: "hourly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: updated,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...THEMES.map((t) => ({
      url: `${SITE_URL}/theme/${t.slug}`,
      lastModified: updated,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];
}
