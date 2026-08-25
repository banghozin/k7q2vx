import type { Metadata } from "next";
import { WatchlistView } from "@/components/watchlist-view";

export const metadata: Metadata = {
  title: "워치리스트",
  description: "별표한 종목과 그 종목이 걸쳐 있는 층.",
};

export default function WatchlistPage() {
  return (
    <div className="wrap">
      <header className="dochead">
        <div className="eyebrow">이 브라우저에만 저장됨</div>
        <h1 className="dochead__title">워치리스트</h1>
        <p className="dochead__tagline">
          별표한 종목입니다. 각 종목이 어느 테마 어느 층에 올라 있는지 자동으로
          붙습니다.
        </p>
      </header>
      <section className="section" style={{ borderBottom: "none" }}>
        <WatchlistView />
      </section>
    </div>
  );
}
