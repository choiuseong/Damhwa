// [변경] 방별 테마(roomThemes)
// [변경] 3차: 방별 배경 사진(roomBackgrounds)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ChatThemeKey } from '../lib/chatThemes';
import type { ChatRoom, ConversationRecord, ScheduleItem, TranscriptTurn } from '../types';
import { makeId } from '../lib/format';

export const DEFAULT_ROOMS: ChatRoom[] = [
  { id: 'room-news', title: '오늘 아침 신문 이야기', meets: '매일 오전 10:00', icon: 'newspaper', featured: true },
  { id: 'room-town', title: '우리 동네 이야기', meets: '매주 화요일 오후 2:00', icon: 'cafe' },
  { id: 'room-anyang', title: '안양 소통방', meets: '언제든 편하게', icon: 'chatbubbles' },
];

interface AppState {
  hasOnboarded: boolean;
  schedules: ScheduleItem[];
  records: ConversationRecord[];
  rooms: ChatRoom[];
  largeText: boolean;
  notificationsEnabled: boolean;
  /** 매일 안부 시간 (자정 기준 분) */
  checkInMinutes: number;
  /** 채팅방 꾸미기 (방 id → 테마). 나에게만 적용 */
  roomThemes: Record<string, ChatThemeKey>;
  /** 채팅방 배경 사진 (방 id → 서버 사진 주소). 나에게만 적용 */
  roomBackgrounds: Record<string, string>;

  completeOnboarding: () => void;
  confirmConversation: (items: ScheduleItem[], summary: string, transcript?: TranscriptTurn[]) => void;
  removeSchedule: (id: string) => void;
  setRooms: (rooms: ChatRoom[]) => void;
  addRoom: (title: string, meets: string) => ChatRoom;
  setLargeText: (v: boolean) => void;
  setNotificationsEnabled: (v: boolean) => void;
  setCheckInMinutes: (m: number) => void;
  resetData: () => void;
  setRoomTheme: (roomId: string, theme: ChatThemeKey) => void;
  /** null 이면 배경 사진 지우기 */
  setRoomBackground: (roomId: string, url: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hasOnboarded: false,
      schedules: [],
      records: [],
      rooms: DEFAULT_ROOMS,
      largeText: false,
      notificationsEnabled: true,
      checkInMinutes: 10 * 60,

      completeOnboarding: () => set({ hasOnboarded: true }),

      confirmConversation: (items, summary, transcript) =>
        set((s) => ({
          schedules: [...s.schedules, ...items].sort((a, b) => a.date.localeCompare(b.date)),
          records: [
            { id: makeId(), date: new Date().toISOString(), summary, items, transcript },
            ...s.records,
          ],
        })),

      removeSchedule: (id) => set((s) => ({ schedules: s.schedules.filter((x) => x.id !== id) })),

      setRooms: (rooms) => set({ rooms }),

      addRoom: (title, meets) => {
        const room: ChatRoom = {
          id: makeId(),
          title,
          meets: meets || '언제든 편하게',
          icon: 'chatbubbles',
        };
        set({ rooms: [...get().rooms, room] });
        return room;
      },

      setLargeText: (largeText) => set({ largeText }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setCheckInMinutes: (m) => set({ checkInMinutes: ((m % 1440) + 1440) % 1440 }),
      roomThemes: {},
      setRoomTheme: (roomId, t) => set((s) => ({ roomThemes: { ...s.roomThemes, [roomId]: t } })),
      roomBackgrounds: {},
      setRoomBackground: (roomId, url) => set((s) => {
        const next = { ...s.roomBackgrounds };
        if (url) next[roomId] = url;
        else delete next[roomId];
        return { roomBackgrounds: next };
      }),
      resetData: () => set({ schedules: [], records: [], rooms: DEFAULT_ROOMS }),
    }),
    {
      name: 'damhwa-app-state',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
