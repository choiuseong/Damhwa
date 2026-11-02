// [변경] 사이버 경로당 API (기기 ID 헤더, 방·메시지·참여·나가기·삭제·읽음·사진·예약·요약·신고·차단)
// [변경] 3차: 방 정보·공지·공감·배경 사진
// [변경] 4차: 방 이름 바꾸기, 참석 답, 출석 도장
import type {
  ChatMessage,
  ChatRoom,
  ChatRoomInfo,
  ScheduleItem,
  TranscriptTurn,
} from '../types';
import { parseSchedules } from '../lib/scheduleParser';
import { makeId } from '../lib/format';
import { getDeviceId } from '../lib/chatIdentity';
import { API_URL, USE_MOCK } from './config';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new ApiError(
        res.status,
        `${res.status} ${await res.text().catch(() => '')}`,
      );
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[];
}

export async function createConversation(
  userId: string,
  title?: string,
): Promise<Conversation> {
  return request<Conversation>('/conversations', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      title,
    }),
  });
}

/**
 * 사용자의 대화 목록과 각 대화의 메시지를 조회한다.
 * 기본 userId는 현재 테스트 데이터에 맞춰 '1'로 설정한다.
 */
export async function getConversations(
  userId = '1',
): Promise<ConversationWithMessages[]> {
  return request<ConversationWithMessages[]>(
    `/conversations?userId=${encodeURIComponent(userId)}`,
  );
}

export async function getConversation(id: string) {
  return request<ConversationWithMessages>(
    `/conversations/${encodeURIComponent(id)}`,
  );
}

export async function listConversationMessages(
  conversationId: string,
): Promise<ConversationMessage[]> {
  return request<ConversationMessage[]>(
    `/conversations/${conversationId}/messages`,
  );
}

export async function createConversationMessage(
  conversationId: string,
  role: string,
  content: string,
): Promise<ConversationMessage> {
  return request<ConversationMessage>(
    `/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        role,
        content,
      }),
    },
  );
}

export async function createRealtimeSession(
  sdp: string,
): Promise<string> {
  console.log('Realtime API 요청 시작');
  console.log('API_URL:', API_URL);
  console.log('SDP length:', sdp.length);

  try {
    const res = await fetch(`${API_URL}/realtime/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
      },
      body: sdp,
    });

    console.log('Realtime API 응답:', res.status);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.log('Realtime API 오류:', text);

      throw new ApiError(
        res.status,
        `${res.status} ${text}`,
      );
    }

    const answerSdp = await res.text();

    console.log(
      'Realtime SDP answer length:',
      answerSdp.length,
    );

    return answerSdp;
  } catch (error) {
    console.error('Realtime fetch 실패:', error);
    throw error;
  }
}

export interface ConversationSummary {
  summary: string;
  pending: ScheduleItem[];
}

export async function endConversation(
  transcript: TranscriptTurn[],
): Promise<ConversationSummary> {
  if (USE_MOCK) {
    await sleep(900);

    const userText = transcript
      .filter((t) => t.role === 'user')
      .map((t) => t.text);

    const joined = userText.join(' · ');

    return {
      summary: joined ? joined.slice(0, 80) : '오늘 나눈 이야기',
      pending: parseSchedules(userText.join('. ')),
    };
  }

  return request<ConversationSummary>('/conversations/end', {
    method: 'POST',
    body: JSON.stringify({ transcript }),
  });
}

export async function confirmSchedules(
  items: ScheduleItem[],
): Promise<void> {
  if (USE_MOCK || items.length === 0) {
    return;
  }

  await request<void>('/schedules/confirm', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  if (USE_MOCK) {
    return;
  }

  await request<void>(
    `/users/1/schedules/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

// ───────── 사이버 경로당 (동네 채팅) ─────────
// 모든 요청에 기기 ID(X-Device-Id)를 붙여 "나"를 구분합니다. 실시간 수신은 hooks/useRoomChat.ts 의 WebSocket.

/** 실시간 연결 주소: http://PC주소:3000 → ws://PC주소:3000/ws */
export const CHAT_WS_URL = API_URL ? `${API_URL.replace(/^http/, 'ws')}/ws` : '';

async function chatRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const deviceId = await getDeviceId();
  return request<T>(path, { ...init, headers: { 'X-Device-Id': deviceId, ...(init.headers ?? {}) } });
}

export async function listRooms(
  coords?: { lat: number; lng: number },
): Promise<ChatRoom[] | null> {
  if (USE_MOCK) {
    return null;
  }

  // 위치는 약 100m 단위로만 보냄 (개인정보 보호)
  const q = coords
    ? `?lat=${coords.lat.toFixed(3)}&lng=${coords.lng.toFixed(3)}&radiusKm=2`
    : '';

  return chatRequest<ChatRoom[]>(`/rooms${q}`);
}

export async function createRoom(
  title: string,
  meets: string,
  coords?: { lat: number; lng: number },
  maxMembers?: number | null,
): Promise<ChatRoom | null> {
  if (USE_MOCK) {
    return null;
  }

  return chatRequest<ChatRoom>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      title,
      meets,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      ...(maxMembers ? { maxMembers } : {}),
    }),
  });
}

export async function listMessages(
  roomId: string,
  after?: string,
): Promise<ChatMessage[]> {
  if (USE_MOCK) {
    return [];
  }

  const q = after
    ? `?after=${encodeURIComponent(after)}`
    : '';

  return chatRequest<ChatMessage[]>(
    `/rooms/${encodeURIComponent(roomId)}/messages${q}`,
  );
}

/** clientId: 같은 메시지를 다시 보내도(재시도) 한 번만 저장되도록 하는 값 */
export async function sendMessage(
  roomId: string,
  text: string,
  clientId: string = makeId().replace(/[^A-Za-z0-9_-]/g, ''),
  kind: 'text' | 'sticker' = 'text',
): Promise<ChatMessage> {
  if (USE_MOCK) {
    return {
      id: makeId(),
      kind,
      text,
      sender: '나',
      isMine: true,
      createdAt: new Date().toISOString(),
    };
  }

  return chatRequest<ChatMessage>(
    `/rooms/${encodeURIComponent(roomId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ text, clientId, kind }),
    },
  );
}

/** 신고 사유 (백엔드 src/chat/shapes.ts 의 REPORT_REASONS 와 같은 키) */
export const REPORT_REASONS = [
  { key: 'abuse', label: '욕설·비방' },
  { key: 'spam', label: '광고·스팸' },
  { key: 'scam', label: '사기 의심' },
  { key: 'etc', label: '기타' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['key'];

export interface ReportResult {
  reported: boolean;
  alreadyReported: boolean;
  /** 서로 다른 이웃 여러 명이 신고해서 메시지가 숨겨졌는지 */
  hidden: boolean;
}

/** 메시지 신고 (서로 다른 3명이 신고하면 서버가 자동으로 숨김) */
export async function reportMessage(
  roomId: string,
  messageId: string,
  reason: ReportReason,
): Promise<ReportResult> {
  if (USE_MOCK) {
    return { reported: true, alreadyReported: false, hidden: false };
  }

  return chatRequest<ReportResult>(
    `/rooms/${encodeURIComponent(roomId)}/report`,
    {
      method: 'POST',
      body: JSON.stringify({ messageId, reason }),
    },
  );
}

/** 메시지를 쓴 이웃 차단 (그 이웃의 메시지가 모든 방에서 나에게 안 보임) */
export async function blockSender(
  roomId: string,
  messageId: string,
): Promise<void> {
  if (USE_MOCK) {
    return;
  }

  await chatRequest<unknown>(
    `/rooms/${encodeURIComponent(roomId)}/block`,
    {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    },
  );
}

/** 방 들어가기 결과. full = 인원이 가득 참, closed = 모두 나가서 닫힌 방 */
export type JoinResult =
  | { ok: true; memberCount: number; maxMembers: number | null; info: ChatRoomInfo | null }
  | { ok: false; full: boolean; message: string };

/** 방 들어가기 (인원 제한 확인, 처음이면 "OO님이 들어왔어요") */
export async function joinRoom(roomId: string): Promise<JoinResult> {
  if (USE_MOCK) return { ok: true, memberCount: 1, maxMembers: null, info: null };
  try {
    const { memberCount, maxMembers, ...rest } = await chatRequest<{ memberCount: number; maxMembers: number | null } & Partial<ChatRoomInfo>>(
      `/rooms/${encodeURIComponent(roomId)}/join`, { method: 'POST' });
    const info: ChatRoomInfo | null = typeof rest.topic === 'string'
      ? { ...rest, ownerName: rest.ownerName ?? null, isOwner: !!rest.isOwner, notice: rest.notice ?? null, topic: rest.topic }
      : null;
    return { ok: true, memberCount, maxMembers, info };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      return { ok: false, full: true, message: serverMessage(e) ?? '인원이 가득 찼어요.' };
    }
    if (e instanceof ApiError && e.status === 404) {
      return { ok: false, full: false, message: serverMessage(e) ?? '없어진 채팅방이에요.' };
    }
    throw e;
  }
}

/** 방 위쪽 안내 다시 받기 */
export async function getRoomInfo(roomId: string): Promise<ChatRoomInfo> {
  return chatRequest<ChatRoomInfo>(`/rooms/${encodeURIComponent(roomId)}/info`);
}

/** 방 공지 쓰기·내리기 (방장만). 빈 글이면 공지를 내림 */
export async function setNotice(roomId: string, notice: string): Promise<ChatRoomInfo> {
  return chatRequest<ChatRoomInfo>(`/rooms/${encodeURIComponent(roomId)}/notice`, {
    method: 'PUT', body: JSON.stringify({ notice }),
  });
}

/** 방 이름 바꾸기 (방장만) */
export async function setRoomTitle(roomId: string, title: string): Promise<ChatRoomInfo> {
  return chatRequest<ChatRoomInfo>(`/rooms/${encodeURIComponent(roomId)}/title`, {
    method: 'PUT', body: JSON.stringify({ title }),
  });
}

/** 모임 참석 답: yes = 갈게요, no = 못 가요, null = 답 지우기 */
export async function setRsvp(roomId: string, answer: 'yes' | 'no' | null): Promise<ChatRoomInfo> {
  return chatRequest<ChatRoomInfo>(`/rooms/${encodeURIComponent(roomId)}/rsvp`, {
    method: 'PUT', body: JSON.stringify({ answer }),
  });
}

/** 출석 도장 (하루 한 번 인사) */
export async function checkIn(roomId: string): Promise<ChatRoomInfo> {
  return chatRequest<ChatRoomInfo>(`/rooms/${encodeURIComponent(roomId)}/checkin`, { method: 'POST' });
}

/** 공감(하트) 누르기·취소 */
export async function likeMessage(roomId: string, messageId: string, liked: boolean): Promise<{ liked: boolean; count: number }> {
  return chatRequest<{ liked: boolean; count: number }>(
    `/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/like`,
    { method: 'POST', body: JSON.stringify({ liked }) },
  );
}

/** 방 나가기 (내가 쓴 글은 남고, 예약 메시지는 취소, 다시 들어오면 그 뒤 대화부터 보임) */
export async function leaveRoom(roomId: string): Promise<void> {
  if (USE_MOCK) return;
  await chatRequest<unknown>(`/rooms/${encodeURIComponent(roomId)}/leave`, { method: 'POST' });
}

/** 메시지 삭제: all = 모두에게(내 메시지만), me = 나에게만 */
export async function deleteMessage(roomId: string, messageId: string, scope: 'all' | 'me'): Promise<void> {
  if (USE_MOCK) return;
  await chatRequest<unknown>(
    `/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/delete`,
    { method: 'POST', body: JSON.stringify({ scope }) },
  );
}

/** 어디까지 읽었는지 알려 주기 (방 목록 '새 글' 수, 한 줄 요약에 반영) */
export async function markRead(roomId: string, lastId: string): Promise<void> {
  if (USE_MOCK || !/^\d+$/.test(lastId)) return;
  await chatRequest<void>(`/rooms/${encodeURIComponent(roomId)}/read`, { method: 'POST', body: JSON.stringify({ lastId }) });
}

/** 사진 주소 (/uploads/… → 서버 전체 주소) */
export function imageUrl(path: string): string {
  return /^(https?:|data:|blob:|file:)/.test(path) ? path : `${API_URL}${path}`;
}

/** 사진 보내기: 휴대폰·웹에서 고른 사진 주소(uri)를 그대로 서버로 올림 (최대 5MB) */
export async function sendImage(roomId: string, uri: string, mimeType = 'image/jpeg'): Promise<ChatMessage> {
  const clientId = makeId().replace(/[^A-Za-z0-9_-]/g, '');
  if (USE_MOCK) {
    return { id: makeId(), kind: 'image', text: uri, sender: '나', isMine: true, createdAt: new Date().toISOString() };
  }
  const blob = await (await fetch(uri)).blob();
  const deviceId = await getDeviceId();
  // 인터넷이 느려도 1분이 지나면 포기하고 알려줌 ('보내는 중'이 계속 남지 않게)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/images?clientId=${clientId}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || mimeType, 'X-Device-Id': deviceId },
      body: blob,
      signal: controller.signal,
    });
    if (!res.ok) throw new ApiError(res.status, `${res.status} ${await res.text().catch(() => '')}`);
    return (await res.json()) as ChatMessage;
  } finally {
    clearTimeout(timer);
  }
}

/** 채팅방 꾸미기: 내 사진을 배경으로 올리고 서버 주소(/uploads/…)를 받음 (최대 5MB) */
export async function uploadBackground(roomId: string, uri: string, mimeType = 'image/jpeg'): Promise<string> {
  if (USE_MOCK) return uri;
  const blob = await (await fetch(uri)).blob();
  const deviceId = await getDeviceId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/background`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || mimeType, 'X-Device-Id': deviceId },
      body: blob,
      signal: controller.signal,
    });
    if (!res.ok) throw new ApiError(res.status, `${res.status} ${await res.text().catch(() => '')}`);
    return ((await res.json()) as { url: string }).url;
  } finally {
    clearTimeout(timer);
  }
}

export interface ScheduledMessage {
  id: string;
  text: string;
  /** ISO 8601 */
  sendAt: string;
}

/** 예약 전송 만들기 (1분 뒤 ~ 7일 안) */
export async function scheduleMessage(roomId: string, text: string, sendAt: Date): Promise<ScheduledMessage> {
  if (USE_MOCK) throw new ApiError(400, '{"message":"예약 전송은 서버에 연결했을 때 쓸 수 있어요."}');
  return chatRequest<ScheduledMessage>(`/rooms/${encodeURIComponent(roomId)}/scheduled`, {
    method: 'POST', body: JSON.stringify({ text, sendAt: sendAt.toISOString() }),
  });
}

export async function listScheduled(roomId: string): Promise<ScheduledMessage[]> {
  if (USE_MOCK) return [];
  return chatRequest<ScheduledMessage[]>(`/rooms/${encodeURIComponent(roomId)}/scheduled`);
}

export async function cancelScheduled(roomId: string, scheduleId: string): Promise<void> {
  if (USE_MOCK) return;
  await chatRequest<unknown>(
    `/rooms/${encodeURIComponent(roomId)}/scheduled/${encodeURIComponent(scheduleId)}`, { method: 'DELETE' });
}

export interface ChatSummary {
  /** 어르신이 한 번에 알 수 있는 한 문장 */
  line: string;
  /** ai = OpenAI 요약, rule = 규칙 기반, none = 새 글 없음 */
  source: 'ai' | 'rule' | 'none';
  totalUnread: number;
  rooms: { roomId: string; title: string; unread: number; lastText: string }[];
}

/** 알림 한 줄 요약 (참여 중인 방의 안 읽은 글) */
export async function getChatSummary(): Promise<ChatSummary | null> {
  if (USE_MOCK) return null;
  return chatRequest<ChatSummary>('/rooms/summary');
}

/** 서버가 보낸 쉬운 안내 문구 꺼내기 (ApiError 의 message 는 "상태코드 본문") */
export function serverMessage(e: unknown): string | null {
  if (!(e instanceof ApiError)) return null;
  const body = e.message.replace(/^\d+\s*/, '');
  try {
    const parsed = JSON.parse(body) as { message?: string };
    return typeof parsed.message === 'string' ? parsed.message : null;
  } catch {
    return null;
  }
}

export async function registerDevice(
  expoPushToken: string,
): Promise<void> {
  if (USE_MOCK) {
    return;
  }

  await request<void>('/devices', {
    method: 'POST',
    body: JSON.stringify({
      expoPushToken,
    }),
  });
}

export interface CreateScheduleInput {
  title: string;
  scheduleTime: string;
  rawMessage: string;
}

export interface CreatedSchedule {
  id: string;
  userId: string;
  title: string;
  scheduleTime: string;
  rawMessage: string | null;
  notified: boolean;
  createdAt: string;
}

export async function createSchedule(
  userId: string,
  data: CreateScheduleInput,
): Promise<CreatedSchedule> {
  return request<CreatedSchedule>(
    `/users/${encodeURIComponent(userId)}/schedules`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export interface BackendSchedule {
  id: string;
  userId: string;
  title: string;
  scheduleTime: string;
  rawMessage: string | null;
  notified: boolean;
  createdAt: string;
}

export async function getSchedules(
  userId = '1',
): Promise<BackendSchedule[]> {
  return request<BackendSchedule[]>(
    `/users/${encodeURIComponent(userId)}/schedules`,
  );
}