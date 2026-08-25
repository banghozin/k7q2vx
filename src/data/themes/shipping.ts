import type { Theme } from "../types";

export const shipping: Theme = {
  slug: "shipping",
  name: "조선·해운",
  tagline: "무엇을 싣느냐로 갈리는 다섯 개 층",
  question: "해운주가 올랐다는데 내가 산 건 왜 안 가나",
  accent: "#4F8FA8",
  newsKeywords: [
    "해운",
    "조선",
    "운임",
    "컨테이너",
    "유조선",
    "LNG",
    "물류",
    "홍해",
  ],
  curatedAt: "2026-08-25",
  layers: [
    {
      n: 1,
      key: "container",
      name: "컨테이너 해운",
      role: "공산품을 실어 나르는 층. 소비 경기와 항로 차질(운하·분쟁)에 반응합니다.",
      caution:
        "해운은 '해운주'로 묶이지만 층마다 운임 지수가 완전히 다릅니다. 컨테이너가 올라도 유조선은 내릴 수 있고 그 반대도 흔합니다.",
      stocks: [
        {
          ticker: "ZIM",
          name: "ZIM 인티그레이티드 시핑",
          why: "컨테이너 운임에 가장 민감. 운임이 뛰면 배당까지 크게 늘리는 구조입니다.",
          anchor: true,
        },
        {
          ticker: "MATX",
          name: "마트슨",
          why: "태평양 특정 항로 중심. 노선이 한정돼 시장 평균과 다르게 움직입니다.",
        },
      ],
    },
    {
      n: 2,
      key: "drybulk",
      name: "벌크·원자재 운반",
      role: "철광석·곡물처럼 포장 없는 화물을 나르는 층. 중국 건설 경기에 직결됩니다.",
      stocks: [
        {
          ticker: "SBLK",
          name: "스타 벌크 캐리어스",
          why: "대형 벌크선단 보유. 벌크 운임 지수와 거의 같이 움직입니다.",
          anchor: true,
        },
        {
          ticker: "GOGL",
          name: "골든 오션 그룹",
          why: "대형선 비중이 높아 철광석 물동량에 특히 민감합니다.",
        },
        {
          ticker: "GNK",
          name: "젠코 시핑 앤 트레이딩",
          why: "중형선 중심. 곡물 등 다양한 화물에 걸쳐 있습니다.",
        },
      ],
    },
    {
      n: 3,
      key: "tanker",
      name: "유조선·가스 운반",
      role: "원유와 가스를 나르는 층. 유가보다 '어디서 어디로 가느냐'가 더 중요합니다.",
      caution:
        "제재나 항로 우회로 운항 거리가 길어지면 물동량이 그대로여도 운임이 오릅니다. 유가 방향과 이 층의 방향이 자주 어긋나는 이유입니다.",
      stocks: [
        {
          ticker: "FRO",
          name: "프론트라인",
          why: "대형 원유 운반선 중심. 항로 우회 이슈에 가장 빠르게 반응합니다.",
          anchor: true,
        },
        {
          ticker: "STNG",
          name: "스콜피오 탱커스",
          why: "석유제품 운반. 원유가 아니라 정제품 흐름에 걸려 있습니다.",
        },
        {
          ticker: "DHT",
          name: "DHT 홀딩스",
          why: "원유 운반 단일 사업. 구조가 단순해 운임 반영이 직관적입니다.",
        },
        {
          ticker: "FLNG",
          name: "플렉스 LNG",
          why: "LNG 운반. 장기 계약 비중이 높아 단기 운임 변동을 덜 탑니다.",
        },
      ],
    },
    {
      n: 4,
      key: "logistics",
      name: "항만·물류 주선",
      role: "배가 아니라 화물의 흐름을 관리해 수수료를 버는 층. 운임이 내려도 물량이 늘면 돈을 법니다.",
      stocks: [
        {
          ticker: "EXPD",
          name: "익스페디터스 인터내셔널",
          why: "선복을 사서 되파는 주선업. 운임 급등기에 오히려 마진이 눌립니다.",
          anchor: true,
        },
        {
          ticker: "CHRW",
          name: "C.H. 로빈슨 월드와이드",
          why: "육상 포함 종합 주선. 미국 내수 화물 경기와 함께 움직입니다.",
        },
        {
          ticker: "GXO",
          name: "GXO 로지스틱스",
          why: "창고 운영 위탁. 물류 자동화라 로봇 테마와도 겹칩니다.",
        },
      ],
    },
    {
      n: 5,
      key: "shipbuild",
      name: "조선·방산 조선",
      role: "배를 실제로 짓는 층.",
      caution:
        "상선 조선은 한국·중국·일본이 사실상 나눠 갖고 있어 미국 상장 종목으로 접근할 방법이 거의 없습니다. 미국 시장에서 '조선'은 사실상 군함입니다.",
      stocks: [
        {
          ticker: "HII",
          name: "헌팅턴 잉걸스 인더스트리스",
          why: "미 해군 군함 건조. 해운 운임이 아니라 국방예산에 걸려 있습니다.",
          anchor: true,
        },
        {
          ticker: "GD",
          name: "제너럴 다이내믹스",
          why: "잠수함 건조 부문 보유. 우주·방산 테마와 같은 회사입니다.",
        },
      ],
    },
  ],
};
