// [변경] 새 파일: 말로 입력하기 (브라우저 음성 인식)
import { Platform } from 'react-native';

/**
 * 말로 입력하기 (말하면 글자로 바뀜)
 * - PC·휴대폰 브라우저: Web Speech API (크롬·엣지·사파리)
 * - 휴대폰 앱: 키보드의 마이크 버튼(받아쓰기)을 쓰도록 안내
 */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen(): boolean {
  return recognitionCtor() !== null;
}

/**
 * 듣기 시작. onText 는 말하는 동안 계속 불림(중간 결과 포함), onEnd 는 끝났을 때.
 * 돌려주는 함수를 부르면 멈춤.
 */
export function startListening(
  onText: (text: string) => void,
  onEnd: (error?: string) => void,
): (() => void) | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'ko-KR';
  rec.interimResults = true;
  rec.continuous = false;
  let failed: string | undefined;
  rec.onresult = (e) => {
    let text = '';
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    onText(text.trim());
  };
  rec.onerror = (e) => { failed = e.error ?? 'error'; };
  rec.onend = () => onEnd(failed);
  try {
    rec.start();
  } catch {
    return null;
  }
  return () => { try { rec.stop(); } catch { /* 이미 멈춤 */ } };
}
