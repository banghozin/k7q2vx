import { SBH, formatDate, type NewsItem } from "@/lib/sbhnews";

/**
 * SBHNews 공개 RSS에서 가져온 기사.
 * CC BY 4.0 조건에 따라 출처명 · 원문 링크 · 라이선스 · 가공 여부를 함께 표시합니다.
 */
export function NewsList({ items }: { items: NewsItem[] }) {
  if (items.length === 0) {
    return (
      <div className="empty">
        이 테마와 맞는 기사가 지금 피드에 없습니다. 하루 1회 갱신됩니다.
      </div>
    );
  }

  return (
    <>
      <div className="newslist">
        {items.map((n) => (
          <a
            key={n.link}
            className="newsitem"
            href={n.link}
            target="_blank"
            rel="noreferrer"
          >
            <div className="newsitem__meta">
              <span>{formatDate(n.pubDate)}</span>
              <span>{n.category}</span>
            </div>
            <div className="newsitem__title">{n.title}</div>
            {n.description && (
              <div className="newsitem__desc">{n.description}</div>
            )}
          </a>
        ))}
      </div>
      <p
        style={{
          fontSize: ".74rem",
          color: "var(--ink-4)",
          marginTop: ".85rem",
        }}
      >
        출처 · <strong>{SBH.source}</strong> — 각 기사 제목과 원문 링크는 위와
        같습니다. 라이선스{" "}
        <a href={SBH.licenseUrl} target="_blank" rel="noreferrer">
          {SBH.license}
        </a>
        . 본문은 수정하지 않았고, 테마 키워드로 골라 배치하는 가공만
        했습니다. 기사에 담긴 제3자 권리 자료는 이용 범위에서 제외됩니다.
      </p>
    </>
  );
}
