import type { ScheduleCategory } from '../types';
import { theme } from '../theme';
import type { IconName } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** "오전 10:00" */
export function formatAmPm(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${pad(h % 12 === 0 ? 12 : h % 12)}:${pad(d.getMinutes())}`;
}

/** "10:00" */
export function formatTime24(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "6월 1일" */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** "6월 1일 일요일" */
export function formatDayLong(iso: string): string {
  return `${formatDay(iso)} ${WEEKDAYS[new Date(iso).getDay()]}요일`;
}

/** 오늘/내일이면 그 말을, 아니면 null */
export function relativeDayLabel(iso: string): string | null {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const d = new Date(iso);
  if (isSameDay(d, now)) return '오늘';
  if (isSameDay(d, tomorrow)) return '내일';
  return null;
}

/** "6월 1일 오전 10:00" */
export function formatDayTime(iso: string): string {
  return `${formatDay(iso)} ${formatAmPm(iso)}`;
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h < 12 ? '오전' : '오후'} ${pad(h % 12 === 0 ? 12 : h % 12)}:${pad(m)}`;
}

export const categoryMeta: Record<ScheduleCategory, { icon: IconName; color: string }> = {
  '외출/쇼핑': { icon: 'bag-handle', color: theme.pink },
  '경로당 방문': { icon: 'home', color: theme.success },
  '병원': { icon: 'medkit', color: theme.blue },
  '일정': { icon: 'calendar', color: theme.brand },
};
