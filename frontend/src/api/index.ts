import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ChatMessage,
  ChatRoom,
  ScheduleItem,
  TranscriptTurn,
} from '../types';
import { parseSchedules } from '../lib/scheduleParser';
import { makeId } from '../lib/format';
import { API_URL, PREVIEW_MODE, USE_MOCK } from './config';
import { PREVIEW_SUMMARY, previewSchedules } from '../preview/mockData';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 15000,
  authenticated = true,
): Promise<T> {
  const identity = authenticated && !USE_MOCK ? await ensureUser() : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(identity ? { Authorization: `Bearer ${identity.sessionToken}` } : {}),
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

interface Identity { id: string; sessionToken: string }
let identityPromise: Promise<Identity> | null = null;
const identityKey = `damhwa-user:${API_URL}`;
export function ensureUser(): Promise<Identity> {
  if (USE_MOCK) return Promise.resolve({ id: 'demo', sessionToken: '' });
  if (!identityPromise) {
    identityPromise = (async () => {
      const saved = await AsyncStorage.getItem(identityKey);
      if (saved) {
        try {
          const value = JSON.parse(saved) as Identity;
          if (/^\d+$/.test(value.id) && /^[a-f0-9]{64}$/.test(value.sessionToken)) return value;
        } catch { /* invalid local value: register again */ }
      }
      const user = await request<Identity>('/users', { method: 'POST', body: JSON.stringify({ name: '이웃' }) }, 15000, false);
      await AsyncStorage.setItem(identityKey, JSON.stringify(user));
      return user;
    })().catch((error) => { identityPromise = null; throw error; });
  }
  return identityPromise;
}


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

export async function createConversation(
  title?: string,
): Promise<Conversation> {
  if (USE_MOCK) return { id: makeId(), userId: 'demo', title: title ?? null, startedAt: new Date().toISOString(), endedAt: null };
  const { id: userId } = await ensureUser();
  return request<Conversation>('/conversations', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      title,
    }),
  });
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
  clientId: string,
): Promise<ConversationMessage> {
  return request<ConversationMessage>(
    `/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        role,
        content,
        clientId,
      }),
    },
  );
}

export async function createRealtimeSession(
  sdp: string,
): Promise<string> {
  const user = await ensureUser();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${API_URL}/realtime/session`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/sdp', Authorization: `Bearer ${user.sessionToken}` }, body: sdp,
    });
    if (!res.ok) throw new ApiError(res.status, '음성 연결에 실패했어요. 다시 시도해주세요.');
    return await res.text();
  } finally { clearTimeout(timer); }
}

export interface ConversationSummary {
  summary: string;
  pending: ScheduleItem[];
}

// This is an excerpt plus rule-based schedule candidates, not an AI summary.
export async function endConversation(transcript: TranscriptTurn[]): Promise<ConversationSummary> {
  const userText = transcript.filter((t) => t.role === 'user').map((t) => t.text);
  const pending = parseSchedules(userText.join('. '));
  if (PREVIEW_MODE && pending.length === 0) {
    // 미리보기: AI 요약·일정 추출 결과 예시를 보여줌 (실제 연결 시 서버 요약 API 로 교체)
    return { summary: PREVIEW_SUMMARY, pending: previewSchedules().map((x) => ({ ...x, id: makeId() })) };
  }
  if (PREVIEW_MODE) {
    // 미리보기: AI 요약처럼 보이는 간단한 문장 (실제 연결 시 서버 요약 결과로 교체)
    return { summary: `다마와 오늘 하루 이야기를 나누셨어요. ${pending.map((x) => x.title).join(', ')} 일정이 있다고 하셨어요.`, pending };
  }
  return { summary: userText.join(' · ').slice(0, 80) || '오늘 나눈 이야기', pending };
}
export async function confirmSchedules(items: ScheduleItem[]): Promise<ScheduleItem[]> {
  if (USE_MOCK || items.length === 0) return items;
  const user = await ensureUser();
  const saved = await request<ScheduleItem[]>(`/users/${user.id}/schedules/confirm`, { method: 'POST', body: JSON.stringify({ items }) });
  return saved.map((item) => ({ ...item, serverBacked: true }));
}
export async function listSchedules(): Promise<ScheduleItem[] | null> {
  if (USE_MOCK) return null;
  const user = await ensureUser();
  const saved = await request<ScheduleItem[]>(`/users/${user.id}/schedules`);
  return saved.map((item) => ({ ...item, serverBacked: true }));
}
export async function deleteSchedule(id: string): Promise<void> {
  if (USE_MOCK) return;
  const user = await ensureUser();
  await request<void>(`/users/${user.id}/schedules/${id}`, { method: 'DELETE' });
}

export async function listRooms(
  coords?: { lat: number; lng: number },
): Promise<ChatRoom[] | null> {
  if (USE_MOCK) {
    return null;
  }

  // 정확한 위치 대신 약 100m 단위로 반올림한 좌표만 보냄 (useNeighborhood 에서 반올림)
  const q = coords
    ? `?lat=${coords.lat}&lng=${coords.lng}&radiusKm=2`
    : '';

  return request<ChatRoom[]>(`/rooms${q}`);
}

export async function createRoom(
  title: string,
  meets: string,
  coords?: { lat: number; lng: number },
): Promise<ChatRoom | null> {
  if (USE_MOCK) {
    return null;
  }

  return request<ChatRoom>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      title,
      meets,
      ...coords,
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

  return request<ChatMessage[]>(
    `/rooms/${roomId}/messages${q}`,
  );
}

export async function sendMessage(
  roomId: string,
  text: string,
  clientId: string,
): Promise<ChatMessage> {
  if (USE_MOCK) {
    return {
      id: makeId(),
      text,
      sender: '나',
      isMine: true,
      createdAt: new Date().toISOString(),
    };
  }

  return request<ChatMessage>(
    `/rooms/${roomId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ text, clientId }),
    },
  );
}

export async function reportOrBlock(
  roomId: string,
  kind: 'report' | 'block',
  messageId?: string,
): Promise<void> {
  if (PREVIEW_MODE) { await new Promise((r) => setTimeout(r, 300)); return; } // 미리보기: 접수된 것처럼 처리
  if (USE_MOCK) throw new Error('데모 모드에서는 신고·차단을 접수할 수 없어요.');

  await request<void>(
    `/rooms/${roomId}/${kind}`,
    {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    },
  );
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