import { SBH, formatDate, type NewsItem } from "@/lib/sbhnews";

/** 출처 이름과 걸린 종목을 붙일 수 있는 기사 */
export type FeedItem = NewsItem & {
  sourceLabel?: string;
  /** 이 기사에 이름이 나온, 우리가 다루는 종목 */
  tickers?: string[];
};

/**
 * 공개 RSS에서 가져온 기사 목록.
 *
 * 한국어(SBHNews)와 미국 금융 매체가 섞여 들어옵니다. 어느 매체 기사인지
 * 항목마다 보여야 읽는 사람이 무게를 다르게 둘 수 있습니다.
 * SBHNews 기사가 섞여 있을 때만 CC BY 4.0 표기를 답니다.
 */
export function NewsList({ items }: { items: FeedItem[] }) {
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
              <span>{n.sourceLabel ?? n.category}</span>
            </div>
            <div className="newsitem__title">{n.title}</div>
            {n.description && (
              <div className="newsitem__desc">{n.description}</div>
            )}
            {n.tickers && n.tickers.length > 0 && (
              <div className="newsitem__tickers mono">
                {n.tickers.slice(0, 5).join(" · ")}
              </div>
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
        출처는 기사마다 옆에 적었습니다. <strong>제목과 원문 링크만</strong>{" "}
        가져오며 본문은 받지도 고치지도 않습니다.
        {items.some((n) => !n.sourceLabel || n.sourceLabel === "SBHNews") && (
          <>
            {" "}
            <strong>{SBH.source}</strong> 기사는 라이선스{" "}
            <a href={SBH.licenseUrl} target="_blank" rel="noreferrer">
              {SBH.license}
            </a>{" "}
            조건으로 씁니다.
          </>
        )}{" "}
        기사에 담긴 제3자 권리 자료는 이용 범위에서 제외됩니다.
      </p>
    </>
  );
}
