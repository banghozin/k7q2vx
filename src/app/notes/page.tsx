import type { Metadata } from "next";
import { NotesView } from "@/components/notes/notes-view";

export const metadata: Metadata = {
  title: "매매노트",
  description:
    "진입가·손절가·익절가와 매매 이유를 적어 두는 노트. 데이터는 이 브라우저에만 저장됩니다.",
};

export default function NotesPage() {
  return (
    <div className="wrap">
      <header className="dochead">
        <h1 className="dochead__title">매매노트</h1>
        <p className="dochead__tagline">
          사는 이유와 나오는 조건을 먼저 적어 두는 곳입니다. 잔소리 대신 숫자로
          원칙을 붙듭니다.
        </p>
      </header>

      <div className="notice" style={{ marginTop: "1.5rem" }}>
        <strong>여기 적는 모든 것은 이 브라우저 안에만 있습니다.</strong> 서버로
        전송되지 않고, 다른 기기와 동기화되지 않으며, 운영자도 볼 수 없습니다.
        브라우저 데이터를 지우거나 기기를 바꾸면 사라지므로{" "}
        <strong>내보내기로 백업</strong>해 두세요. 이 화면은 적정 매수가·목표가를
        제안하지 않습니다. 모든 숫자는 직접 적은 값과 그 값들의 산수입니다.
      </div>

      <section className="section" style={{ borderBottom: "none" }}>
        <NotesView />
      </section>
    </div>
  );
}
