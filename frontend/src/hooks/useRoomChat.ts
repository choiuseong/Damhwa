import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { USE_MOCK } from '../api/config';
import { makeId } from '../lib/format';
import type { ChatMessage } from '../types';

const NEIGHBOR_REPLIES = [
  '반갑습니다! 저도 이 동네 살아요.',
  '오늘 날씨가 참 좋네요.',
  '식사는 하셨어요?',
  '다음에 경로당에서 뵈어요.',
];

/**
 * 채팅방 메시지. 서버 모드에서는 REST 로 보내고 3초마다 새 메시지를 가져옵니다.
 * (실시간성이 더 필요하면 이 훅 안쪽만 WebRTC 데이터 채널/WebSocket 으로 바꾸면 됩니다.)
 */
export function useRoomChat(roomId: string, onIncoming?: (msg: ChatMessage) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const lastId = useRef<string | undefined>(undefined);
  const replyIdx = useRef(0);
  const onIncomingRef = useRef(onIncoming);
  onIncomingRef.current = onIncoming;

  const append = useCallback((msgs: ChatMessage[]) => {
    if (msgs.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...prev, ...msgs.filter((m) => !seen.has(m.id))];
    });
    lastId.current = msgs[msgs.length - 1].id;
    msgs.filter((m) => !m.isMine).forEach((m) => onIncomingRef.current?.(m));
  }, []);

  useEffect(() => {
    if (USE_MOCK) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const fresh = await api.listMessages(roomId, lastId.current);
        if (!cancelled) append(fresh);
      } catch {
        // 일시적인 네트워크 오류는 다음 주기에 재시도
      }
    };
    tick();
    const timer = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [roomId, append]);

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t) return;
      if (USE_MOCK) {
        append([{ id: makeId(), text: t, sender: '나', isMine: true, createdAt: new Date().toISOString() }]);
        const reply = NEIGHBOR_REPLIES[replyIdx.current++ % NEIGHBOR_REPLIES.length];
        setTimeout(() => {
          append([{ id: makeId(), text: reply, sender: '이웃분', isMine: false, createdAt: new Date().toISOString() }]);
        }, 1200);
        return;
      }
      try {
        append([await api.sendMessage(roomId, t)]);
      } catch {
        // 실패 표시는 화면 쪽에서 필요 시 추가
      }
    },
    [roomId, append],
  );

  return { messages, send };
}
