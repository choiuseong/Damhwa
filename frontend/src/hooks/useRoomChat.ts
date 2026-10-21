import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { PREVIEW_MODE, USE_MOCK } from '../api/config';
import { previewMessages } from '../preview/mockData';
import { makeId } from '../lib/format';
import type { ChatMessage } from '../types';

const REPLIES = ['반갑습니다! 저도 이 동네 살아요.', '오늘 날씨가 참 좋네요.', '식사는 하셨어요?', '다음에 경로당에서 뵈어요.'];
export function useRoomChat(roomId: string, onIncoming?: (msg: ChatMessage) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const generation = useRef(0);
  const cursor = useRef<string | undefined>(undefined);
  const seen = useRef(new Set<string>());
  const room = useRef(roomId);
  useEffect(() => { room.current = roomId; }, [roomId]);
  const incoming = useRef(onIncoming);
  useEffect(() => { incoming.current = onIncoming; }, [onIncoming]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const sendingRef = useRef(false);
  const retry = useRef<{ text: string; id: string } | null>(null);

  const blocked = useRef(new Set<string>());
  const append = useCallback((items: ChatMessage[]) => {
    const fresh = items.filter((x) => !seen.current.has(x.id) && (x.isMine || !blocked.current.has(x.sender)));
    fresh.forEach((x) => seen.current.add(x.id));
    if (!fresh.length) return;
    setMessages((prev) => [...prev, ...fresh].sort((a, b) => USE_MOCK ? a.createdAt.localeCompare(b.createdAt) : (BigInt(a.id) < BigInt(b.id) ? -1 : 1)));
    fresh.filter((x) => !x.isMine).forEach((x) => incoming.current?.(x));
  }, []);

  const refresh = useCallback(async (reset = false) => {
    if (USE_MOCK) return;
    const current = roomId;
    if (reset) generation.current++;
    const epoch = generation.current;
    const items = await api.listMessages(roomId, reset ? undefined : cursor.current);
    if (!mounted.current || room.current !== current || epoch !== generation.current) return;
    if (reset) { seen.current.clear(); setMessages([]); cursor.current = undefined; }
    append(items);
    if (items.length) cursor.current = items[items.length - 1].id;
    setError(null);
  }, [roomId, append]);

  useEffect(() => {
    generation.current++;
    mounted.current = true;
    cursor.current = undefined;
    seen.current.clear();
    retry.current = null;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setMessages([]);
      setError(null);
      // 미리보기: 동네 이웃 메시지 예시를 미리 채움 (읽어주기 대상이 되지 않도록 incoming 콜백은 부르지 않음)
      if (PREVIEW_MODE) {
        const items = previewMessages(roomId).filter((x) => x.isMine || !blocked.current.has(x.sender));
        items.forEach((x) => seen.current.add(x.id));
        setMessages(items);
      }
    });
    let polling = false;
    const tick = async () => {
      if (cancelled || polling) return;
      polling = true;
      try { await refresh(); }
      catch { if (!cancelled) setError('메시지를 불러오지 못했어요. 연결 후 자동으로 다시 시도해요.'); }
      finally { polling = false; }
    };
    if (!USE_MOCK) void tick();
    const interval = setInterval(() => { if (!USE_MOCK) void tick(); }, 3000);
    return () => { cancelled = true; mounted.current = false; clearInterval(interval); if (timer.current) clearTimeout(timer.current); };
  }, [roomId, refresh]);

  const send = useCallback(async (text: string): Promise<boolean> => {
    const t = text.trim();
    if (!t || sendingRef.current) return false;
    sendingRef.current = true;
    setSending(true);
    const current = roomId;
    const clientId = retry.current?.text === t ? retry.current.id : makeId();
    retry.current = { text: t, id: clientId };
    try {
      if (USE_MOCK) {
        append([{ id: makeId(), text: t, sender: '나', isMine: true, createdAt: new Date().toISOString() }]);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (mounted.current && room.current === current) append([{ id: makeId(), text: REPLIES[Math.floor(Math.random() * REPLIES.length)], sender: PREVIEW_MODE ? (['김순자 님', '이말순 님', '박영철 님'].find((n) => !blocked.current.has(n)) ?? '이웃 님') : '이웃분 (데모)', isMine: false, createdAt: new Date().toISOString() }]);
        }, 1200);
      } else {
        const sent = await api.sendMessage(roomId, t, clientId);
        if (mounted.current && room.current === current) append([sent]);
        // Polling cursor only advances on GET, never on POST. This prevents
        // skipping another person's message between two polling cycles.
      }
      retry.current = null;
      if (mounted.current) setError(null);
      return true;
    } catch {
      if (mounted.current) setError('전송하지 못했어요. 입력한 내용을 확인하고 다시 보내주세요.');
      return false;
    } finally {
      sendingRef.current = false;
      if (mounted.current) setSending(false);
    }
  }, [roomId, append]);
  /** 미리보기/데모 모드에서 차단한 이웃의 메시지를 화면에서 숨김 (실서버는 refresh(true) 로 서버가 걸러줌) */
  const hideSender = useCallback((sender: string) => {
    blocked.current.add(sender);
    setMessages((prev) => prev.filter((m) => m.isMine || m.sender !== sender));
  }, []);
  return { messages, send, error, sending, refresh, hideSender };
}
