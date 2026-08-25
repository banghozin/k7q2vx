import type { Theme } from "../types";

export const quantum: Theme = {
  slug: "quantum",
  name: "양자컴퓨팅",
  tagline: "큐비트를 만드는 곳에서 그걸 빌려주는 곳까지, 여섯 개 층",
  question: "양자 관련주가 다 같이 튀는데, 실제로 매출이 나는 층은 어디인가",
  accent: "#5AA7C8",
  newsKeywords: ["양자", "양자컴퓨터", "큐비트", "양자내성", "퀀텀"],
  curatedAt: "2026-08-25",
  layers: [
    {
      n: 1,
      key: "qubit",
      name: "큐비트 하드웨어",
      role: "양자컴퓨터의 연산 소자 자체를 만드는 층. 방식이 회사마다 완전히 다릅니다.",
      caution:
        "이 층은 매출 규모가 아직 작고 적자인 곳이 대부분입니다. 뉴스 한 줄에 크게 흔들리는 이유가 여기 있습니다.",
      stocks: [
        {
          ticker: "IONQ",
          name: "아이온큐",
          why: "이온을 가둬 큐비트로 쓰는 방식. 이 층에서 시가총액이 가장 큰 순수 양자 회사.",
          anchor: true,
        },
        {
          ticker: "RGTI",
          name: "리게티 컴퓨팅",
          why: "초전도 방식. 칩 형태라 반도체 공정과 닮은 구조입니다.",
        },
        {
          ticker: "QBTS",
          name: "디웨이브 퀀텀",
          why: "범용 연산이 아닌 최적화 문제 전용(어닐링) 방식. 성격이 다른 기계입니다.",
        },
        {
          ticker: "QUBT",
          name: "퀀텀 컴퓨팅",
          why: "빛을 이용하는 광학 방식. 극저온 장비가 덜 필요한 접근.",
        },
      ],
    },
    {
      n: 2,
      key: "cryo",
      name: "극저온·정밀 장비",
      role: "큐비트를 절대영도 가까이 식히고 흔들림 없이 유지하는 장비 층.",
      stocks: [
        {
          ticker: "FORM",
          name: "폼팩터",
          why: "극저온 상태에서 칩을 측정하는 장비. 양자칩 검사에 쓰입니다.",
          anchor: true,
        },
        {
          ticker: "MKSI",
          name: "MKS 인스트루먼츠",
          why: "진공·레이저·유량 제어. 양자든 반도체든 공정 환경을 만드는 쪽.",
        },
        {
          ticker: "AEIS",
          name: "어드밴스드 에너지",
          why: "정밀 전원 공급 장치. 미세한 전력 흔들림이 큐비트를 깨뜨립니다.",
        },
      ],
    },
    {
      n: 3,
      key: "photonics",
      name: "광·레이저 부품",
      role: "빛으로 큐비트를 제어하고 신호를 주고받는 부품 층. AI 테마 5층과 회사가 겹칩니다.",
      stocks: [
        {
          ticker: "COHR",
          name: "코히어런트",
          why: "레이저와 광 부품. 이온 트랩 제어와 광통신 양쪽에 쓰입니다.",
          anchor: true,
        },
        {
          ticker: "LITE",
          name: "루멘텀",
          why: "광 부품 전문. 매출의 중심은 아직 데이터센터 광통신 쪽입니다.",
        },
      ],
    },
    {
      n: 4,
      key: "control",
      name: "제어·계측·시뮬레이션",
      role: "양자칩에 신호를 넣고 결과를 읽고, 고전 컴퓨터로 흉내 내보는 층.",
      stocks: [
        {
          ticker: "KEYS",
          name: "키사이트 테크놀로지스",
          why: "양자 신호를 측정하는 계측 장비. 어느 방식이 이기든 팔립니다.",
          anchor: true,
        },
        {
          ticker: "NVDA",
          name: "엔비디아",
          why: "GPU로 양자 회로를 흉내 내는 시뮬레이션 도구를 제공. AI 테마 1층과 같은 회사입니다.",
        },
        {
          ticker: "AMD",
          name: "AMD",
          why: "양자 제어에 쓰이는 FPGA(현장에서 회로를 바꿀 수 있는 칩) 공급.",
        },
      ],
    },
    {
      n: 5,
      key: "qsecurity",
      name: "양자보안·소프트웨어",
      role: "양자컴퓨터가 기존 암호를 깨는 상황에 대비하는 층.",
      caution:
        "미국 상장된 순수 양자보안 업체는 손에 꼽습니다. 이 주제 관련 뉴스는 대체로 아래 6층의 대기업 발표로 나옵니다.",
      stocks: [
        {
          ticker: "ARQQ",
          name: "아킷 퀀텀",
          why: "양자내성 암호키 배포 서비스. 시총이 작아 변동이 큽니다.",
          anchor: true,
        },
        {
          ticker: "PANW",
          name: "팔로알토 네트웍스",
          why: "기존 보안 제품에 양자내성 암호를 얹는 쪽. 사이버보안 테마와 겹칩니다.",
        },
      ],
    },
    {
      n: 6,
      key: "qcloud",
      name: "대기업·클라우드 접근",
      role: "양자컴퓨터를 직접 만들면서 동시에 시간 단위로 빌려주는 층.",
      caution:
        "이 층 회사들에게 양자는 전체 매출의 아주 작은 조각입니다. 양자 뉴스로 주가가 크게 움직이지 않는 이유입니다.",
      stocks: [
        {
          ticker: "IBM",
          name: "IBM",
          why: "초전도 양자 로드맵을 가장 구체적으로 공개하고 클라우드로 개방한 곳.",
          anchor: true,
        },
        {
          ticker: "GOOGL",
          name: "알파벳",
          why: "자체 양자칩 연구. 성과 발표가 이 테마 전체를 흔드는 방아쇠가 됩니다.",
        },
        {
          ticker: "MSFT",
          name: "마이크로소프트",
          why: "여러 회사의 양자컴퓨터를 클라우드에서 한데 묶어 빌려주는 창구.",
        },
        {
          ticker: "AMZN",
          name: "아마존",
          why: "AWS를 통해 외부 양자 하드웨어에 접근시켜 주는 중개 역할.",
        },
        {
          ticker: "HON",
          name: "허니웰",
          why: "분사한 양자 회사(퀀티넘)의 지분을 보유. 간접 노출 경로입니다.",
        },
      ],
    },
  ],
};
