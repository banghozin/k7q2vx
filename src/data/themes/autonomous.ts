import type { Theme } from "../types";

export const autonomous: Theme = {
  slug: "autonomous",
  name: "자율주행",
  tagline: "칩에서 로보택시 운영까지, 여섯 개 층",
  question: "로보택시 뉴스가 나오면 부품사도 같이 가야 맞는 것 아닌가",
  accent: "#5F92C8",
  newsKeywords: ["자율주행", "로보택시", "라이다", "웨이모", "무인차", "ADAS"],
  curatedAt: "2026-08-25",
  layers: [
    {
      n: 1,
      key: "compute",
      name: "연산 반도체",
      role: "차가 스스로 판단하게 만드는 두뇌 칩 층. AI·로봇 테마와 회사가 겹칩니다.",
      stocks: [
        {
          ticker: "NVDA",
          name: "엔비디아",
          why: "차량용 자율주행 연산 플랫폼을 공급. AI 테마 1층과 같은 회사입니다.",
          anchor: true,
        },
        {
          ticker: "MBLY",
          name: "모빌아이 글로벌",
          why: "운전보조 칩과 소프트웨어를 묶어 파는 순수 자율주행 노출.",
        },
        {
          ticker: "QCOM",
          name: "퀄컴",
          why: "차량용 반도체 사업을 키우는 중. 휴대폰 사업 비중이 여전히 큽니다.",
        },
        {
          ticker: "AMBA",
          name: "암바렐라",
          why: "차량 카메라 영상을 기기 안에서 처리하는 칩.",
        },
      ],
    },
    {
      n: 2,
      key: "sensing",
      name: "센서 (라이다·레이더·카메라)",
      role: "차가 주변을 인식하게 하는 눈을 만드는 층. 채택 여부가 곧 생존입니다.",
      caution:
        "센서를 얼마나 쓸지는 완성차 회사의 철학에 달려 있습니다. 카메라만 쓰겠다는 회사가 이기면 이 층 일부는 수요가 사라집니다.",
      stocks: [
        {
          ticker: "LAZR",
          name: "루미나 테크놀로지스",
          why: "장거리 라이다. 완성차 양산 채택 소식이 유일한 방아쇠입니다.",
          anchor: true,
        },
        {
          ticker: "OUST",
          name: "오스터",
          why: "라이다를 자동차 밖(로봇·산업)으로도 팔아 수요처를 분산했습니다.",
        },
        {
          ticker: "INVZ",
          name: "이노비즈 테크놀로지스",
          why: "완성차 납품 계약 중심. 시총이 작아 계약 하나에 크게 움직입니다.",
        },
        {
          ticker: "ON",
          name: "온세미컨덕터",
          why: "차량용 이미지센서와 전력 반도체. 전기차 테마와도 겹칩니다.",
        },
      ],
    },
    {
      n: 3,
      key: "tier1",
      name: "차량 부품·시스템 통합",
      role: "칩과 센서를 실제 차에 붙여 하나로 묶는 층. 완성차와 부품사 사이에 있습니다.",
      stocks: [
        {
          ticker: "APTV",
          name: "앱티브",
          why: "차량 전기 배선과 자율주행 시스템 통합. 전기차 테마와 겹칩니다.",
          anchor: true,
        },
        {
          ticker: "ALV",
          name: "오토리브",
          why: "에어백 등 안전 부품. 자율주행 실패 시에도 남는 수요를 갖고 있습니다.",
        },
        {
          ticker: "VC",
          name: "비스테온",
          why: "차량 디스플레이와 전장. 완성차 생산 대수에 실적이 직결됩니다.",
        },
      ],
    },
    {
      n: 4,
      key: "oem",
      name: "완성차",
      role: "자율주행 기능을 실제로 차에 얹어 파는 층.",
      stocks: [
        {
          ticker: "TSLA",
          name: "테슬라",
          why: "카메라 중심 방식을 고수. 이 회사의 선택이 2층 라이다 업체들의 운명을 가릅니다.",
          anchor: true,
        },
        {
          ticker: "GM",
          name: "제너럴 모터스",
          why: "자율주행 자회사에 대한 투자 조절이 반복돼 왔습니다.",
        },
        {
          ticker: "F",
          name: "포드 모터",
          why: "운전보조 구독 모델을 밀고 있습니다. 완전 자율보다 단계적 접근.",
        },
        {
          ticker: "RIVN",
          name: "리비안 오토모티브",
          why: "자체 운전보조 개발. 생산량 자체가 아직 작은 단계입니다.",
        },
      ],
    },
    {
      n: 5,
      key: "robotaxi",
      name: "로보택시·운영",
      role: "차를 팔지 않고 태워주는 서비스로 돈을 버는 층.",
      stocks: [
        {
          ticker: "GOOGL",
          name: "알파벳",
          why: "웨이모를 통해 실제 유료 운행 중. 다만 회사 전체 매출에서는 아주 작습니다.",
          anchor: true,
        },
        {
          ticker: "UBER",
          name: "우버 테크놀로지스",
          why: "자율주행차를 자기 앱에 태우는 유통 창구. 직접 개발은 접었습니다.",
        },
        {
          ticker: "LYFT",
          name: "리프트",
          why: "같은 방식의 제휴 전략. 규모가 작아 협상력이 약합니다.",
        },
      ],
    },
    {
      n: 6,
      key: "freight",
      name: "자율주행 화물·트럭",
      role: "사람이 아니라 짐을 나르는 쪽. 정해진 노선이라 기술 난도가 다릅니다.",
      stocks: [
        {
          ticker: "AUR",
          name: "오로라 이노베이션",
          why: "고속도로 자율 트럭 상용화에 집중. 아직 매출 전 단계입니다.",
          anchor: true,
        },
        {
          ticker: "PONY",
          name: "포니에이아이",
          why: "중국 기반 자율주행 업체의 미국 상장분. 규제 리스크가 별도로 붙습니다.",
        },
      ],
    },
  ],
};
