// [변경] 새 파일: 기기 ID 만들기·저장
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 사이버 경로당에서 "나"를 구분하는 기기 ID.
 * 앱을 처음 실행할 때 무작위로 만들어 휴대폰에 저장하고 계속 같은 값을 씁니다. (로그인 없음)
 */
const KEY = 'damhwa-chat-device-id';
let cached: Promise<string> | null = null;

function randomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = 'dev-';
  for (let i = 0; i < 28; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function getDeviceId(): Promise<string> {
  if (!cached) {
    cached = (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) return saved;
      } catch { /* 저장소를 못 읽으면 새로 만듦 */ }
      const id = randomId();
      try { await AsyncStorage.setItem(KEY, id); } catch { /* 이번 실행 동안만 사용 */ }
      return id;
    })();
  }
  return cached;
}
