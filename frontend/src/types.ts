import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type ScheduleCategory = '외출/쇼핑' | '경로당 방문' | '병원' | '일정';

export interface ScheduleItem {
  id: string;
  title: string;
  place?: string;
  category: ScheduleCategory;
  /** ISO 8601 */
  date: string;
}

export interface ConversationRecord {
  id: string;
  /** ISO 8601 */
  date: string;
  summary: string;
  items: ScheduleItem[];
  /** 다마와 주고받은 대화 (예전 기록에는 없을 수 있음) */
  transcript?: TranscriptTurn[];
}

export interface ChatRoom {
  id: string;
  title: string;
  meets: string;
  icon: IconName;
  featured?: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  isMine: boolean;
  /** ISO 8601 */
  createdAt: string;
}

export interface TranscriptTurn {
  role: 'user' | 'assistant';
  text: string;
}
