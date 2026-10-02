/**
 * 백엔드 주소. .env 에 EXPO_PUBLIC_API_URL=https://... 를 넣으면 실서버 모드,
 * 비어 있으면 앱 안에서 가짜 데이터로 동작하는 목(mock) 모드입니다.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
export const USE_MOCK = API_URL.length === 0;

/** 반경 2km 이웃 매칭 */
export const NEIGHBOR_RADIUS_KM = 2;
