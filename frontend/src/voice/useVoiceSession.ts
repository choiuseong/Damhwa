import { useCallback, useEffect, useRef, useState } from 'react';
import { USE_MOCK } from '../api/config';
import type { TranscriptTurn } from '../types';
import { MockRealtimeClient } from './mockRealtimeClient';
import { OpenAIRealtimeClient } from './openaiRealtimeClient';
import type { RealtimeClient, VoiceEvents, VoiceState } from './types';

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
    client.current?.stop();
    client.current = null;
  }, []);

  const start = useCallback(async () => {
    if (client.current) return;
    setError(null);
    setUserText('');
    setAssistantText('');

    const events: VoiceEvents = {
      onState: (s) => alive.current && setState(s),
      onUserTranscript: (text) => {
        transcript.current.push({ role: 'user', text });
        if (alive.current) {
          setUserText(text);
          setAssistantText('');
          setTurns([...transcript.current]);
        }
      },
      onAssistantDelta: (delta) => {
        if (alive.current) setAssistantText((prev) => prev + delta);
      },
      onAssistantDone: (full) => {
        transcript.current.push({ role: 'assistant', text: full });
        if (alive.current) {
          setAssistantText('');
          setTurns([...transcript.current]);
        }
      },
      onError: (message) => {
        if (alive.current) setError(message);
      },
    };

    const c: RealtimeClient = USE_MOCK ? new MockRealtimeClient(events) : new OpenAIRealtimeClient(events);
    client.current = c;
    try {
      await c.start();
    } catch (e) {
      client.current = null;
      if (alive.current) {
        setState('error');
        setError(e instanceof Error ? e.message : '연결에 실패했어요.');
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
