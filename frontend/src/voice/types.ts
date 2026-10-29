/** 대화를 연 계기 (식사 안부 알림 → 'meal', 일정 알림 → 'alarm') */
export type VoiceTopic = 'meal' | 'alarm';

/** 일정 알림을 눌러 대화를 열었을 때 다마가 먼저 꺼낼 일정 */
export interface VoiceReminder {
  title: string;
  message: string;
}

export type VoiceState ='idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface VoiceEvents {
  onState: (state: VoiceState) => void;
  /** 사용자가 말한 내용(전사) 확정 */
  onUserTranscript: (text: string) => void;
  /** AI 응답 자막 조각 (누적은 호출하는 쪽에서) */
  onAssistantDelta: (delta: string) => void;
  /** AI 응답 한 턴 완료 */
  onAssistantDone: (fullText: string) => void;
  onError: (message: string) => void;
}

export interface RealtimeClient {
  start(): Promise<void>;
  stop(): void;
  /** '말 끝내기' — 서버 VAD를 기다리지 않고 지금 턴을 넘긴다 */
  commitTurn(): void;
  /** AI가 말하는 중에 끼어들기 */
  interrupt(): void;
  /** 글로 보내기(마이크를 못 쓸 때/목 모드) */
  sendText(text: string): void;
}
