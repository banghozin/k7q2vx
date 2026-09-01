import type { MetadataRoute } from "next";
import { SITE_URL } from "./layout";

/**
 * 검색 로봇에게 주는 안내.
 *
 * 막을 것이 별로 없습니다 — 담긴 것은 이미 공개된 산업 구조 설명이고,
 * 개인 기록은 애초에 서버로 오지 않습니다.
 *
 * `/api/` 만 막습니다. 시세·기사를 중계하는 자리라 로봇이 훑을 값이 없고,
 * 괜히 긁으면 야후 쪽 요청만 늘어납니다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
