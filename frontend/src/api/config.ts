/**
 * 백엔드 주소. .env 에 EXPO_PUBLIC_API_URL=https://... 를 넣으면 실서버 모드,
 * 비어 있으면 앱 안에서 가짜 데이터로 동작하는 목(mock) 모드입니다.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');

/**
 * 화면 미리보기 모드 (학술제 시연·웹 브라우저 확인용).
 * .env 에 EXPO_PUBLIC_PREVIEW_MODE=true 를 넣으면 켜지고, false 이거나 비워 두면 꺼집니다.
 * 켜지면 서버·마이크·위치·알림·채팅 서버 없이 src/preview/mockData.ts 의 가짜 데이터로 화면을 보여줍니다.
 * (원래 실서버/데모 동작 코드는 그대로 두고, 이 값이 true 일 때만 우회합니다.)
 */
export const PREVIEW_MODE = (process.env.EXPO_PUBLIC_PREVIEW_MODE ?? '').trim().toLowerCase() === 'true';

/** 미리보기 모드이거나 서버 주소가 없으면 서버를 부르지 않습니다. */
export const USE_MOCK = PREVIEW_MODE || API_URL.length === 0;

/** 반경 2km 이웃 매칭 */
export const NEIGHBOR_RADIUS_KM = 2;
