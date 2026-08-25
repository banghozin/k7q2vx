/**
 * 빌드 전에 계산 결과 파일이 있는지 확인하고, 없으면 빈 껍데기를 만듭니다.
 *
 * 왜 필요한가: 화면 코드가 `import ... from "@/data/generated/stocks.json"`
 * 으로 가져오는데, 파일이 없으면 **빌드가 통째로 실패합니다.** 저장소를 처음
 * 클론했거나 계산을 아직 안 돌린 사람이 `npm run build` 만 쳤을 때 그렇습니다.
 *
 * 빈 껍데기가 들어가면 화면은 숫자 자리에 "—" 를 표시하고 층 구조는 그대로
 * 보입니다. 사이트가 깨지는 것보다 낫습니다.
 *
 * package.json 의 prebuild 로 걸려 있어 `npm run build` 시 자동 실행됩니다.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const DIR = "src/data/generated";

const EMPTY: Record<string, unknown> = {
  "stocks.json": { generatedAt: "", asOf: "", source: "", stocks: {} },
  "layers.json": { generatedAt: "", asOf: "", source: "", themes: {} },
  "sync.json": { generatedAt: "", asOf: "", source: "", minEvents: 10, themes: {} },
  "leaders.json": { generatedAt: "", asOf: "", source: "", themes: {} },
  "briefing.json": { generatedAt: "", asOf: "", source: "", themes: {} },
  "rotation.json": { generatedAt: "", asOf: "", source: "", themes: {} },
};

mkdirSync(DIR, { recursive: true });

let made = 0;
for (const [name, shape] of Object.entries(EMPTY)) {
  const path = `${DIR}/${name}`;
  if (existsSync(path)) continue;
  writeFileSync(path, JSON.stringify(shape) + "\n", "utf8");
  made++;
  console.log(`[ensure] ${name} 이 없어 빈 파일을 만들었습니다`);
}

if (made > 0) {
  console.log(
    `[ensure] 시세 숫자 없이 빌드합니다. \`npm run update\` 를 돌리면 채워집니다.`,
  );
}
