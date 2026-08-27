"use client";

import { createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";

/**
 * 기기에 저장하는 통로 — 워치리스트·매매노트·훈련기록·분석 그림이 함께 씁니다.
 *
 * 왜 따로 두는가
 * --------------
 * zustand 의 `persist` 는 저장 실패를 **감싸 주지 않습니다.** 안을 열어 보면
 * 이렇습니다.
 *
 *     api.setState = (state, replace) => { savedSetState(state, replace); return setItem(); }
 *
 * `setItem()` 이 던지면 그대로 위로 올라갑니다. 즉 **브라우저 저장 공간이 차는
 * 순간, 별표를 누르거나 매매를 기록하는 그 클릭이 예외로 끝납니다.** 리액트는
 * 이벤트 처리 중에 난 예외를 오류 경계로 잡아 주지 않으므로 화면이 그대로
 * 멈춥니다. 저장 공간은 대략 5MB 인데 분석 그림·훈련 기록이 같은 칸을 나눠
 * 쓰므로 도달할 수 있는 값입니다.
 *
 * 읽을 때도 마찬가지입니다. 저장된 값이 깨져 있으면 `JSON.parse` 가 던지고,
 * zustand 는 그것을 잡되 **완료 신호(`setHydrated`)를 부르지 않습니다.**
 * 그러면 `/notes` 와 `/watchlist` 가 "불러오는 중…" 에서 영원히 멈춥니다.
 * 비개발자 이용자에게는 빠져나올 방법이 없는 상태입니다.
 *
 * 그래서 여기서
 * -------------
 * - **깨진 값은 지우고 없던 것으로 봅니다.** 어차피 못 읽는 값이고, 남겨 두면
 *   다음 방문에도 같은 자리에서 멈춥니다. 지우면 최소한 화면은 다시 돕니다.
 * - **저장 실패는 삼킵니다.** 화면은 계속 돌고, 이번에 적은 것이 이 기기에
 *   남지 않을 뿐입니다. 조용히 넘기지는 않고 콘솔에 남깁니다.
 *
 * 서버에서는 `localStorage` 자체가 없습니다. 그때는 지금까지와 똑같이
 * **여기서 예외가 나야** `createJSONStorage` 가 저장소 없음으로 처리하고
 * 넘어갑니다. 잡아서 가짜 저장소를 돌려주면 서버가 "다 읽었다" 고 판단해
 * 화면이 처음 그려질 때 어긋납니다.
 */

let warned = false;

function warnOnce(what: string, e: unknown) {
  if (warned) return;
  warned = true;
  console.warn(
    `[기기 저장] ${what} 이 기기의 저장 공간이 찼거나 브라우저가 막고 있을 수 있습니다. ` +
      `화면은 그대로 쓰이지만 이번에 적은 것이 다음 방문에 남지 않습니다.`,
    e,
  );
}

function backing(): StateStorage {
  // 서버에는 없습니다 — 여기서 나는 예외가 지금까지의 동작을 그대로 지킵니다
  const ls = window.localStorage;

  return {
    getItem: (name) => {
      try {
        const raw = ls.getItem(name);
        if (raw == null) return null;
        // 못 읽는 값이면 여기서 걸립니다. 위쪽에서 걸리면 완료 신호가 안 옵니다
        JSON.parse(raw);
        return raw;
      } catch (e) {
        warnOnce("저장된 값을 읽지 못해 지웠습니다.", e);
        try {
          ls.removeItem(name);
        } catch {
          /* 지우는 것마저 막혔다면 더 할 수 있는 게 없습니다 */
        }
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        ls.setItem(name, value);
      } catch (e) {
        warnOnce("저장하지 못했습니다.", e);
      }
    },
    removeItem: (name) => {
      try {
        ls.removeItem(name);
      } catch (e) {
        warnOnce("지우지 못했습니다.", e);
      }
    },
  };
}

/** `persist({ storage: deviceStorage() })` 로 씁니다 */
export const deviceStorage = () => createJSONStorage(() => backing());
