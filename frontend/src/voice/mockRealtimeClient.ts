import type { RealtimeClient, VoiceEvents } from './types';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 서버·마이크 없이 UI 흐름을 확인하기 위한 목 클라이언트 (Expo Go 에서도 동작).
 * 화면의 '글로 말하기' 입력창으로 말을 보내면, AI가 부드러운 말투로 짧게 답합니다.
 */
export class MockRealtimeClient implements RealtimeClient {
  private stopped = false;
  private aborted = false;
  private fallbackIdx = 0;

  constructor(private ev: VoiceEvents) {}

  async start() {
    this.stopped = false;
    this.ev.onState('connecting');
    await sleep(400);
    await this.say('안녕하세요! 오늘 하루는 어떠셨어요?');
  }

  private async say(text: string) {
    if (this.stopped) return;
    this.aborted = false;
    this.ev.onState('speaking');
    let acc = '';
    for (const word of text.split(' ')) {
      await sleep(90);
      if (this.stopped || this.aborted) break;
      acc += `${word} `;
      this.ev.onAssistantDelta(`${word} `);
    }
    if (this.stopped) return;
    this.ev.onAssistantDone(acc.trim());
    this.ev.onState('listening');
  }

  private pick(t: string): string {
    const has = (...ws: string[]) => ws.some((w) => t.includes(w));
    if (has('피곤', '힘들', '아파', '아프')) return '고생 많으셨어요. 천천히 이야기해 주세요.';
    if (has('쇼핑', '딸', '아들', '손주')) return '좋으시겠어요! 언제 가실 예정이세요?';
    if (has('경로당')) return '경로당 가시면 반가운 분들 만나시겠어요. 몇 시에 가세요?';
    if (has('좋았', '좋아', '행복', '재밌')) return '다행이에요. 어떤 일이 제일 좋으셨어요?';
    const fallbacks = [
      '그렇군요. 조금 더 들려주시겠어요?',
      '아, 그러셨어요. 그때 기분은 어떠셨어요?',
      '말씀해 주셔서 고마워요. 또 어떤 일이 있었어요?',
    ];
    return fallbacks[this.fallbackIdx++ % fallbacks.length];
  }

  sendText(text: string) {
    this.aborted = true;
    this.ev.onUserTranscript(text);
    this.ev.onState('thinking');
    sleep(700).then(() => this.say(this.pick(text)));
  }

  /** 목 모드엔 마이크가 없으니, 말을 다 들은 것처럼 한 턴을 넘긴다 */
  commitTurn() {
    this.aborted = true;
    this.ev.onState('thinking');
    sleep(600).then(() => this.say(this.pick('')));
  }

  interrupt() {
    this.aborted = true;
  }

  stop() {
    this.stopped = true;
    this.ev.onState('idle');
  }
}
