// [변경] 서버 모드: 참여 → 불러오기 → WebSocket 실시간, 끊기면 3초 확인·재연결, 삭제·숨김·인원·나감 반영, 읽음 표시
// [변경] 3차: 방 정보, 공감(먼저 반영 후 실패 시 되돌림)
// [변경] 4차: 방 정보 변경을 합쳐서 반영(내 답·내 출석 유지)
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as api from '../api';
import { USE_MOCK } from '../api/config';
import { getDeviceId } from '../lib/chatIdentity';
import { makeId } from '../lib/format';
import type { ChatMessage, ChatRoomInfo } from '../types';

const NEIGHBOR_REPLIES = [
  '반갑습니다! 저도 이 동네 살아요.',
  '오늘 날씨가 참 좋네요.',
  '식사는 하셨어요?',
  '다음에 경로당에서 뵈어요.',
];

/** 서버 메시지 id 는 숫자 문자열. 순서대로 정렬 */
const byId = (a: ChatMessage, b: ChatMessage) =>
  a.id.length === b.id.length ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.id.length - b.id.length;

/** joining = 들어가는 중, ready = 대화 가능, full = 인원이 가득 참, error = 서버 연결 실패 */
export type RoomStatus = 'joining' | 'ready' | 'full' | 'error';

const newClientId = () => makeId().replace(/[^A-Za-z0-9_-]/g, '');

/**
 * 채팅방 메시지 (서버 모드)
 * 0) 방에 참여(POST /join, 인원 제한 확인)
 * 1) REST 로 최근 메시지를 불러오고
 * 2) WebSocket(/ws)으로 새 메시지·숨김(신고)·삭제·인원 변경을 즉시 받습니다.
 * 3) WebSocket 이 끊기면 3초마다 REST 로 새 메시지를 확인하면서, 1→2→4…최대 15초 간격으로 다시 연결합니다.
 * 보내기는 REST(POST)로 하고, 같은 메시지를 다시 보내도 서버가 한 번만 저장합니다(clientId).
 */
export function useRoomChat(roomId: string, onIncoming?: (msg: ChatMessage) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  /** 'connecting' | 'live'(실시간) | 'polling'(끊겨서 3초마다 확인) */
  const [connection, setConnection] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [status, setStatus] = useState<RoomStatus>(USE_MOCK ? 'ready' : 'joining');
  const [statusMessage, setStatusMessage] = useState('');
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [maxMembers, setMaxMembers] = useState<number | null>(null);
  /** 방장·공지·오늘의 이야깃거리 */
  const [info, setInfo] = useState<ChatRoomInfo | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const lastId = useRef<string | undefined>(undefined);
  const replyIdx = useRef(0);
  const onIncomingRef = useRef(onIncoming);
  useEffect(() => { onIncomingRef.current = onIncoming; }, [onIncoming]);

  const seen = useRef(new Set<string>());
  /** 방금 차단한 이웃 (서버가 걸러 주기 전에 도착한 메시지도 화면에 안 보이게) */
  const blockedSenders = useRef(new Set<string>());

  // 읽은 위치를 서버에 알림 (방 목록 '새 글' 수, 한 줄 요약). 1초에 한 번으로 모아서
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportRead = useCallback(() => {
    if (USE_MOCK || readTimer.current) return;
    readTimer.current = setTimeout(() => {
      readTimer.current = null;
      if (lastId.current) api.markRead(roomId, lastId.current).catch(() => {});
    }, 1000);
  }, [roomId]);
  // 화면을 나갈 때 기다리던 읽음 표시는 바로 보냄 (목록에 '새 글'이 남지 않게)
  useEffect(() => () => {
    if (readTimer.current) {
      clearTimeout(readTimer.current);
      readTimer.current = null;
      if (lastId.current) api.markRead(roomId, lastId.current).catch(() => {});
    }
  }, [roomId]);

  /**
   * @param advance false 면 '어디까지 받았는지'(lastId)를 옮기지 않음.
   *   내가 방금 보낸 글로 lastId 를 옮기면, 아직 못 받은 이웃 글을 건너뛸 수 있어서 보낸 글은 false
   */
  const append = useCallback((msgs: ChatMessage[], notify = true, advance = true) => {
    const fresh = msgs.filter((m) => !seen.current.has(m.id) && (m.isMine || !blockedSenders.current.has(m.sender)));
    if (fresh.length === 0) return;
    fresh.forEach((m) => seen.current.add(m.id));
    setMessages((prev) => (USE_MOCK ? [...prev, ...fresh] : [...prev, ...fresh].sort(byId)));
    if (!USE_MOCK && advance) {
      const max = [...fresh].sort(byId)[fresh.length - 1].id;
      if (!lastId.current || byId({ id: max } as ChatMessage, { id: lastId.current } as ChatMessage) > 0) lastId.current = max;
      reportRead();
    }
    // 새로 들어온 상대 메시지만 알림(읽어주기). 안내·삭제된 메시지는 제외
    if (notify) fresh.filter((m) => !m.isMine && m.kind !== 'system' && !m.deleted).forEach((m) => onIncomingRef.current?.(m));
  }, [reportRead]);

  /** 차단 직후: 그 이웃의 메시지를 화면에서 바로 지움 (이후 서버도 보내지 않음) */
  const hideSender = useCallback((sender: string) => {
    blockedSenders.current.add(sender);
    setMessages((prev) => prev.filter((m) => m.isMine || m.kind === 'system' || m.sender !== sender));
  }, []);

  /** 모두에게 삭제된 메시지를 '삭제된 메시지예요'로 바꿈 */
  const markDeleted = useCallback((messageId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, deleted: true, text: '' } : m)));
  }, []);

  useEffect(() => {
    if (USE_MOCK) return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    lastId.current = undefined;
    seen.current = new Set();
    // 방이 바뀌면 화면 초기화 (렌더가 끝난 뒤에)
    queueMicrotask(() => { if (!cancelled) { setMessages([]); setInfo(null); setConnection('connecting'); setStatus('joining'); } });

    let catchingUp = false;
    const catchUp = async () => {
      if (catchingUp) return;
      catchingUp = true;
      try {
        // 한 번에 200개씩, 덜 올 때까지 이어서 받음 (오래 끊겼어도 빠짐없이)
        for (let page = 0; page < 10 && !cancelled; page++) {
          const first = lastId.current === undefined;
          const fresh = await api.listMessages(roomId, lastId.current);
          if (cancelled) return;
          append(fresh, !first);
          if (first || fresh.length < 200) break;
        }
      } catch {
        // 일시적인 네트워크 오류는 다음 주기에 재시도
      } finally {
        catchingUp = false;
      }
    };
    const startPolling = () => {
      if (pollTimer || cancelled) return;
      setConnection('polling');
      pollTimer = setInterval(catchUp, 3000);
    };
    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    /**
     * 다시 연결됐을 때: 최근 메시지를 새로 받아 화면과 맞춤
     * (끊긴 동안 '모두에게 삭제'·신고 숨김·나에게만 삭제가 있었어도 반영)
     */
    const resync = async () => {
      try {
        const latest = await api.listMessages(roomId);
        if (cancelled) return;
        const byKey = new Map(latest.map((m) => [m.id, m]));
        const oldest = latest[0]?.id;
        setMessages((prev) => {
          const kept = prev.filter((m) => {
            if (!oldest || byId(m, { id: oldest } as ChatMessage) < 0) return true; // 범위 밖(더 오래된 글)은 그대로
            return byKey.has(m.id); // 범위 안인데 서버에 없으면 숨겨진 것
          }).map((m) => byKey.get(m.id) ?? m);
          const ids = new Set(kept.map((m) => m.id));
          return [...kept, ...latest.filter((m) => !ids.has(m.id))].sort(byId);
        });
        latest.forEach((m) => seen.current.add(m.id));
        const max = latest[latest.length - 1]?.id;
        if (max && (!lastId.current || byId({ id: max } as ChatMessage, { id: lastId.current } as ChatMessage) > 0)) lastId.current = max;
      } catch {
        // 다음 기회에
      }
    };

    let connecting = false;
    const sockets = new Set<WebSocket>();
    const connect = async () => {
      // 이미 연결 중이거나 연결돼 있으면 또 만들지 않음 (소켓이 두 개 생기는 문제 방지)
      if (cancelled || !api.CHAT_WS_URL || connecting || ws) return;
      connecting = true;
      let deviceId: string;
      try { deviceId = await getDeviceId(); } finally { connecting = false; }
      if (cancelled || ws) return;
      const socket = new WebSocket(`${api.CHAT_WS_URL}?deviceId=${encodeURIComponent(deviceId)}`);
      ws = socket;
      sockets.add(socket);
      socket.onopen = () => socket.send(JSON.stringify({ type: 'join', roomId }));
      socket.onmessage = (ev) => {
        let data: { type?: string; roomId?: string; message?: ChatMessage; messageId?: string; count?: number; info?: ChatRoomInfo };
        try { data = JSON.parse(String(ev.data)); } catch { return; }
        if (data.type === 'joined') {
          const wasDisconnected = !!pollTimer;
          retry = 0;
          stopPolling();
          setConnection('live');
          if (wasDisconnected) {
            void resync(); // 끊긴 동안의 삭제·숨김·공감까지 맞춤
            api.getRoomInfo(roomId).then((i) => { if (!cancelled) setInfo(i); }).catch(() => {});
          } else catchUp(); // 놓친 새 메시지
        } else if (data.roomId !== roomId) {
          // 다른 방 소식은 무시
        } else if (data.type === 'message' && data.message) {
          append([data.message]);
        } else if (data.type === 'hidden' && data.messageId) {
          seen.current.delete(data.messageId); // 운영자가 숨김을 풀면 다시 받을 수 있게
          setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
        } else if (data.type === 'deleted' && data.messageId) {
          markDeleted(data.messageId);
        } else if (data.type === 'members' && typeof data.count === 'number') {
          setMemberCount(data.count);
        } else if (data.type === 'likes' && data.messageId && typeof data.count === 'number') {
          const { messageId, count } = data;
          setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, likeCount: count } : m)));
        } else if (data.type === 'room' && data.info) {
          const next = data.info; // 방 이름·방장·공지·참석·출석 수 변경 (내 답·내 출석은 그대로 둠)
          setInfo((prev) => (prev ? { ...prev, ...next } : next));
        } else if (data.type === 'kicked') {
          // 다른 창(기기)에서 이 방을 나감
          cancelled = true;
          sockets.forEach((s) => s.close());
          stopPolling();
          setStatus('error');
          setStatusMessage('이 채팅방에서 나왔어요. 다시 들어오려면 "다시 시도"를 눌러 주세요.');
        } else if (data.type === 'error') {
          socket.close(); // 방에 못 들어갔으면 닫고 다시 연결 (그동안 3초 확인)
        }
      };
      socket.onclose = () => {
        sockets.delete(socket);
        if (ws !== socket) return;
        ws = null;
        if (cancelled) return;
        startPolling();
        if (retryTimer) clearTimeout(retryTimer);
        const delay = Math.min(15000, 1000 * 2 ** retry++);
        retryTimer = setTimeout(connect, delay);
      };
      socket.onerror = () => { /* onclose 에서 처리 */ };
    };

    // 0) 참여 → 1) 불러오기 → 2) 실시간 연결
    (async () => {
      try {
        const r = await api.joinRoom(roomId);
        if (cancelled) return;
        if (!r.ok) { setStatus(r.full ? 'full' : 'error'); setStatusMessage(r.message); return; }
        setMemberCount(r.memberCount);
        setMaxMembers(r.maxMembers);
        setInfo(r.info);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setStatusMessage(api.serverMessage(e) ?? '채팅방에 들어가지 못했어요. 인터넷 연결을 확인해 주세요.');
        return;
      }
      await catchUp();
      void connect();
    })();

    // 휴대폰이 잠들었다 깨어나면 바로 다시 연결
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !ws && !cancelled) {
        if (retryTimer) clearTimeout(retryTimer);
        retry = 0;
        connect();
      }
    });

    return () => {
      cancelled = true;
      sub.remove();
      stopPolling();
      if (retryTimer) clearTimeout(retryTimer);
      sockets.forEach((s) => s.close());
      ws = null;
    };
  }, [roomId, append, markDeleted, retryKey]);

  /** 서버 메시지 보내기 (실패하면 1번 재시도). 잘못된 요청·도배 제한은 재시도하지 않음 */
  const sendToServer = useCallback(async (fn: () => Promise<ChatMessage>): Promise<boolean> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        append([await fn()], false, false);
        return true;
      } catch (e) {
        if (e instanceof api.ApiError && e.status < 500) return false;
      }
    }
    return false;
  }, [append]);

  /** 글 보내기. 실패하면 false (입력한 글은 화면에서 다시 채워 둠) */
  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const t = text.trim();
      if (!t) return false;
      if (USE_MOCK) {
        append([{ id: makeId(), text: t, sender: '나', isMine: true, createdAt: new Date().toISOString() }]);
        const reply = NEIGHBOR_REPLIES[replyIdx.current++ % NEIGHBOR_REPLIES.length];
        setTimeout(() => {
          append([{ id: makeId(), text: reply, sender: '이웃분', isMine: false, createdAt: new Date().toISOString() }]);
        }, 1200);
        return true;
      }
      const clientId = newClientId();
      return sendToServer(() => api.sendMessage(roomId, t, clientId));
    },
    [roomId, append, sendToServer],
  );

  /** 스티커 보내기 (큰 이모티콘) */
  const sendSticker = useCallback(async (emoji: string): Promise<boolean> => {
    if (USE_MOCK) {
      append([{ id: makeId(), kind: 'sticker', text: emoji, sender: '나', isMine: true, createdAt: new Date().toISOString() }]);
      return true;
    }
    const clientId = newClientId();
    return sendToServer(() => api.sendMessage(roomId, emoji, clientId, 'sticker'));
  }, [roomId, append, sendToServer]);

  /** 사진 보내기 */
  const sendImage = useCallback(async (uri: string, mimeType?: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      append([await api.sendImage(roomId, uri, mimeType)], false, false);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: api.serverMessage(e) ?? undefined };
    }
  }, [roomId, append]);

  /** 메시지 삭제: all = 모두에게(내 메시지), me = 나에게만 */
  const deleteMessage = useCallback(async (messageId: string, scope: 'all' | 'me'): Promise<boolean> => {
    try {
      await api.deleteMessage(roomId, messageId, scope);
    } catch {
      return false;
    }
    if (scope === 'all') markDeleted(messageId);
    else setMessages((prev) => prev.filter((m) => m.id !== messageId));
    return true;
  }, [roomId, markDeleted]);

  /** 공감(하트) 누르기·취소. 화면에 먼저 반영하고, 실패하면 되돌림 */
  const toggleLike = useCallback(async (msg: ChatMessage): Promise<boolean> => {
    const liked = !msg.likedByMe;
    const patch = (likedByMe: boolean, likeCount: number) =>
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, likedByMe, likeCount } : m)));
    const before = msg.likeCount ?? 0;
    patch(liked, Math.max(0, before + (liked ? 1 : -1)));
    if (USE_MOCK) return true;
    try {
      const r = await api.likeMessage(roomId, msg.id, liked);
      patch(r.liked, r.count);
      return true;
    } catch {
      patch(!liked, before);
      return false;
    }
  }, [roomId]);

  /** 공지를 바꾼 뒤 바로 반영 */
  const updateInfo = useCallback((i: ChatRoomInfo) => setInfo(i), []);

  /** 화면에서 바로 지우기 (신고로 숨겨졌을 때) */
  const remove = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  /** 인원이 차서 못 들어갔을 때 등 다시 시도 */
  const retryJoin = useCallback(() => setRetryKey((k) => k + 1), []);

  return {
    messages, send, sendSticker, sendImage, deleteMessage, hideSender, remove, toggleLike,
    connection, status, statusMessage, memberCount, maxMembers, retryJoin, info, updateInfo,
  };
}
