// [변경] ChatRoom 인원·참여·새 글·방장, ChatMessage 종류·삭제·공감, ChatRoomInfo
// [변경] 4차: ChatRoomInfo 에 방 이름·참석·출석
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
  /** 서버 모드에서만: 지금 참여 인원 */
  memberCount?: number;
  /** 최대 인원 (null = 제한 없음) */
  maxMembers?: number | null;
  /** 내가 참여 중인 방인지 */
  joined?: boolean;
  /** 안 읽은 새 글 수 */
  unread?: number;
  /** 내가 방장인 방 */
  isOwner?: boolean;
}

/** 채팅방 위쪽 안내: 방장, 공지, 오늘의 이야깃거리 */
export interface ChatRoomInfo {
  /** 방 이름 (방장이 바꿀 수 있음) */
  title?: string;
  /** 방장 이름 (기본 공용 방은 null = 운영팀) */
  ownerName: string | null;
  isOwner: boolean;
  notice: string | null;
  topic: string;
  /** 공지에 대한 모임 참석: 갈게요 / 못 가요 수, 갈게요 한 이웃, 내 답 */
  rsvpYes?: number;
  rsvpNo?: number;
  rsvpYesNames?: string[];
  rsvpMine?: 'yes' | 'no' | null;
  /** 출석 도장: 오늘 인사한 이웃 수, 내가 오늘 인사했는지, 연속 출석 일수 */
  checkinCount?: number;
  checkedInToday?: boolean;
  streak?: number;
}

/** text = 글, image = 사진(text 에 주소), sticker = 큰 이모티콘, system = "OO님이 들어왔어요" 같은 안내 */
export type ChatMessageKind = 'text' | 'image' | 'sticker' | 'system';

export interface ChatMessage {
  id: string;
  kind?: ChatMessageKind;
  /** 보낸 사람이 '모두에게 삭제'한 메시지 */
  deleted?: boolean;
  text: string;
  sender: string;
  isMine: boolean;
  /** 공감(하트) 수, 내가 눌렀는지 */
  likeCount?: number;
  likedByMe?: boolean;
  /** ISO 8601 */
  createdAt: string;
}

export interface TranscriptTurn {
  role: 'user' | 'assistant';
  text: string;
}
