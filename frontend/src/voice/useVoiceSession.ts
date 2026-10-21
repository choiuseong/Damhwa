import { useCallback, useEffect, useRef, useState } from 'react';
import { USE_MOCK } from '../api/config';
import { ApiError } from '../api';
import type { TranscriptTurn } from '../types';
import { MockRealtimeClient } from './mockRealtimeClient';
import { OpenAIRealtimeClient } from './openaiRealtimeClient';
import type { RealtimeClient, VoiceEvents, VoiceState } from './types';

/** 기술적인 오류 문구를 어르신이 이해하기 쉬운 말로 바꿈 */
export function friendlyVoiceError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return '다마를 너무 자주 불렀어요. 10분쯤 쉬었다가 다시 불러 주세요.';
    if (e.status === 503) return '다마가 아직 준비 중이에요. 잠시 후 다시 불러 주세요.';
    if (e.status === 401) return '앱 등록 정보를 확인하지 못했어요. 앱을 껐다 켠 뒤 다시 시도해 주세요.';
    if (e.status >= 500) return '다마 서버에 잠시 문제가 생겼어요. 잠시 후 "다시 연결"을 눌러 주세요.';
  }
  const raw = e instanceof Error ? `${e.name} ${e.message}` : String(e ?? '');
  if (/NotAllowed|Permission|denied|권한/i.test(raw)) {
    return '마이크를 쓸 수 없어요. 휴대폰 설정에서 담화의 마이크를 "허용"으로 바꿔 주세요. 그동안은 "글로 쓰기"로 이야기할 수 있어요.';
  }
  if (/NotFound|no.*device|마이크를 찾/i.test(raw)) return '마이크를 찾지 못했어요. 이어폰을 뺐다가 다시 꽂아 보세요.';
  if (/network|fetch|abort|timeout|Failed to|연결/i.test(raw)) return '인터넷 연결이 약해서 다마를 부르지 못했어요. 와이파이나 데이터를 확인한 뒤 "다시 연결"을 눌러 주세요.';
  if (/[가-힣]/.test(raw) && e instanceof Error) return e.message; // 이미 쉬운 한국어 안내인 경우
  return '잠시 문제가 생겼어요. "다시 연결"을 눌러 주세요.';
}

export function useVoiceSession() {
  const [state, setState] = useState<VoiceState>('idle');
  const [userText, setUserText] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** 화면에 보여줄 대화 목록 (transcript 와 같은 내용) */
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);

  const transcript = useRef<TranscriptTurn[]>([]);
  const client = useRef<RealtimeClient | null>(null);
  const alive = useRef(true);

  const stop = useCallback(() => {
    const c = client.current;
    client.current = null;
    c?.stop();
    if (alive.current) setState('idle');
  }, []);

  const start = useCallback(async () => {
    if (client.current) return;
    transcript.current = [];
    setTurns([]);
    setState('connecting');
    setError(null);
    setUserText('');
    setAssistantText('');

    let c: RealtimeClient;
    const active = () => alive.current && client.current === c;
    const events: VoiceEvents = {
      onState: (s) => active() && setState(s),
      onUserTranscript: (text) => {
        if (!active()) return;
        transcript.current.push({ role: 'user', text });
        if (active()) {
          setUserText(text);
          setAssistantText('');
          setTurns([...transcript.current]);
        }
      },
      onAssistantDelta: (delta) => {
        if (active()) setAssistantText((prev) => prev + delta);
      },
      onAssistantDone: (full) => {
        if (!active()) return;
        transcript.current.push({ role: 'assistant', text: full });
        if (active()) {
          setAssistantText('');
          setTurns([...transcript.current]);
        }
      },
      onError: (message) => {
        if (!active()) return;
        client.current = null;
        c.stop();
        setError(friendlyVoiceError(new Error(message)));
        setState('error');
      },
    };

    c = USE_MOCK ? new MockRealtimeClient(events) : new OpenAIRealtimeClient(events);
    client.current = c;
    try {
      await c.start();
    } catch (e) {
      c.stop();
      const current = active();
      if (client.current === c) client.current = null;
      if (current) {
        setState('error');
        setError(friendlyVoiceError(e));
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop();
    };
  }, [stop]);

  return {
    state,
    userText,
    assistantText,
    error,
    turns,
    isMock: USE_MOCK,
    getTranscript: () => transcript.current,
    start,
    stop,
    commitTurn: () => client.current?.commitTurn(),
    interrupt: () => client.current?.interrupt(),
    sendText: (text: string) => client.current?.sendText(text),
  };
}
