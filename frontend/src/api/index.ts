import type {
  ChatMessage,
  ChatRoom,
  ScheduleItem,
  TranscriptTurn,
} from '../types';
import { parseSchedules } from '../lib/scheduleParser';
import { makeId } from '../lib/format';
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

  await request<void>(`/schedules/${id}`, {
    method: 'DELETE',
  });
}

export async function listRooms(
  coords?: { lat: number; lng: number },
): Promise<ChatRoom[] | null> {
  if (USE_MOCK) {
    return null;
  }

  const q = coords
    ? `?lat=${coords.lat}&lng=${coords.lng}&radiusKm=2`
    : '';

  return request<ChatRoom[]>(`/rooms${q}`);
}

export async function createRoom(
  title: string,
  meets: string,
): Promise<ChatRoom | null> {
  if (USE_MOCK) {
    return null;
  }

  return request<ChatRoom>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      title,
      meets,
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
      body: JSON.stringify({ text }),
    },
  );
}

export async function reportOrBlock(
  roomId: string,
  kind: 'report' | 'block',
  messageId?: string,
): Promise<void> {
  if (USE_MOCK) {
    return;
  }

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