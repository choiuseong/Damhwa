import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ChatRoom, ConversationRecord, ScheduleItem, TranscriptTurn } from '../types';
import { makeId } from '../lib/format';
import { previewRecords, previewSchedules } from '../preview/mockData';

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
  /** 미리보기 가짜 데이터를 이미 넣었는지 (모두 지우기 후 다시 채우지 않도록) */
  previewSeeded: boolean;

  completeOnboarding: () => void;
  confirmConversation: (items: ScheduleItem[], summary: string, transcript?: TranscriptTurn[]) => void;
  removeSchedule: (id: string) => void;
  syncSchedules: (items: ScheduleItem[]) => void;
  setRooms: (rooms: ChatRoom[]) => void;
  addRoom: (title: string, meets: string) => ChatRoom;
  setLargeText: (v: boolean) => void;
  setNotificationsEnabled: (v: boolean) => void;
  setCheckInMinutes: (m: number) => void;
  resetData: () => void;
  /** 미리보기 모드: 비어 있을 때만 가짜 기록·일정을 채움 */
  seedPreview: () => void;
  /** 미리보기를 끈 뒤 남은 가짜 데이터(id 가 preview- 로 시작)를 지움 */
  purgePreview: () => void;
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
      previewSeeded: false,

      completeOnboarding: () => set({ hasOnboarded: true }),

      confirmConversation: (items, summary, transcript) =>
        set((s) => ({
          schedules: [...s.schedules, ...items].sort((a, b) => a.date.localeCompare(b.date)),
          records: [
            { id: makeId(), date: new Date().toISOString(), summary, items, transcript },
            ...s.records,
          ],
        })),

      syncSchedules: (items) => set((s) => ({ schedules: [...s.schedules.filter((x) => !x.serverBacked), ...items].sort((a, b) => a.date.localeCompare(b.date)) })),

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
      resetData: () => set({ schedules: [], records: [], rooms: DEFAULT_ROOMS }),
      purgePreview: () => {
        const isPreview = (id: string) => id.startsWith('preview-');
        const s = get();
        if (!s.previewSeeded && !s.schedules.some((x) => isPreview(x.id)) && !s.records.some((x) => isPreview(x.id))) return;
        set({
          previewSeeded: false,
          schedules: s.schedules.filter((x) => !isPreview(x.id)),
          records: s.records.filter((x) => !isPreview(x.id)),
        });
      },
      seedPreview: () => {
        const s = get();
        if (s.previewSeeded) return;
        set({ previewSeeded: true, ...(s.schedules.length || s.records.length ? {} : { schedules: previewSchedules(), records: previewRecords() }) });
      },
    }),
    {
      name: 'damhwa-app-state',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
