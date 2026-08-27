/**
 * 이동·선택 모드를 나타내는 손 표식.
 *
 * 글자만 있으면 "이동" 이 무엇을 옮긴다는 것인지(화면인지 선인지) 헷갈립니다.
 * 손 모양이 붙으면 지도 앱에서 하던 그것과 같다는 게 바로 읽힙니다.
 */
export function HandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11V6.5a1.5 1.5 0 0 1 3 0V13" />
      <path d="M9 11V9.5a1.5 1.5 0 0 0-3 0V15c0 3.3 2.7 6 6 6h1a6 6 0 0 0 6-6v-2" />
    </svg>
  );
}
