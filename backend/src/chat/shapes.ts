// [변경] 새 파일: 앱에 보내는 방·메시지 모양, 신고 사유, 스티커
// [변경] 3차: isOwner, 공감 수, 오늘의 이야깃거리
/** 앱(frontend/src/types.ts)의 ChatRoom / ChatMessage 와 같은 모양으로 변환 */

export interface RoomRow {
  id: string;
  title: string;
  meets: string;
  icon: string;
  featured: boolean;
  maxMembers?: number | null;
  memberCount?: number | string | null;
  joined?: boolean | null;
  unread?: number | string | null;
  ownerId?: string | number | null;
}

export type MessageKind = "text" | "image" | "sticker" | "system";

export interface MessageRow {
  id: string | number;
  userId: string | number;
  nickname: string;
  text: string;
  kind?: MessageKind | null;
  deletedAt?: Date | string | null;
  createdAt: Date | string;
}

export function roomShape(r: RoomRow, viewerId?: string) {
  return {
    id: r.id,
    title: r.title,
    meets: r.meets,
    icon: r.icon,
    featured: r.featured,
    maxMembers: r.maxMembers ?? null,
    memberCount: Number(r.memberCount ?? 0),
    joined: !!r.joined,
    unread: Number(r.unread ?? 0),
    isOwner: !!viewerId && r.ownerId !== null && r.ownerId !== undefined && String(r.ownerId) === viewerId,
  };
}

/** 공감(하트) 수와 내가 눌렀는지 */
export interface Likes { count: number; mine: boolean }

export function messageShape(r: MessageRow, viewerId: string, likes?: Likes) {
  const kind = (r.kind ?? "text") as MessageKind;
  const mine = kind !== "system" && String(r.userId) === viewerId;
  const deleted = !!r.deletedAt;
  return {
    id: String(r.id),
    kind,
    // 모두에게 삭제된 메시지는 내용을 보내지 않음
    text: deleted ? "" : r.text,
    deleted,
    sender: kind === "system" ? "" : mine ? "나" : r.nickname,
    isMine: mine,
    likeCount: likes?.count ?? 0,
    likedByMe: likes?.mine ?? false,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

/** 메시지 + 보낸 사람 닉네임을 함께 가져오는 SELECT 앞부분 */
export const MESSAGE_SELECT = `
  SELECT m."id", m."userId", u."nickname", m."text", m."kind", m."deletedAt", m."createdAt"
    FROM "chat_messages" m JOIN "chat_users" u ON u."id" = m."userId"`;

export const REPORT_REASONS = {
  abuse: "욕설·비방",
  spam: "광고·스팸",
  scam: "사기 의심",
  etc: "기타",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

/** 스티커로 보낼 수 있는 이모티콘 (앱의 스티커 목록과 같음) */
export const STICKERS = [
  "👍", "👏", "🙏", "😊", "😂", "🥰", "😢", "😮", "🎉", "💐", "☕", "🍚",
  "🌞", "🌧️", "❤️", "🙆", "🙅", "💪", "👋", "🌸",
] as const;

/**
 * 오늘의 이야깃거리 (대화를 시작하기 어려운 어르신을 위해 매일 바뀜, 방마다 다름)
 */
export const TOPICS = [
  "오늘 점심은 무엇을 드셨어요?",
  "요즘 즐겨 보시는 텔레비전 프로그램이 있으세요?",
  "젊었을 때 가장 좋아하던 노래는 무엇이었나요?",
  "우리 동네에서 산책하기 좋은 길을 알려 주세요.",
  "요즘 몸 건강을 위해 하시는 운동이 있으세요?",
  "어릴 적 살던 고향 이야기를 들려 주세요.",
  "손주나 가족에게 들은 재미있는 이야기가 있나요?",
  "제철 음식 중에 제일 좋아하시는 건 무엇인가요?",
  "오늘 날씨는 어떤가요? 창밖 풍경을 나눠 주세요.",
  "요즘 키우는 화분이나 텃밭이 있으세요?",
  "가장 기억에 남는 여행지는 어디였나요?",
  "자주 가는 시장이나 가게를 추천해 주세요.",
  "요즘 새로 배우고 싶은 것이 있으세요?",
  "잠이 잘 오는 나만의 방법이 있나요?",
  "명절에 꼭 만드시는 음식이 있나요?",
  "옛날 학교 다닐 때 이야기를 들려 주세요.",
  "이번 주에 기분 좋았던 일 하나를 나눠 주세요.",
  "즐겨 부르는 노래 제목을 알려 주세요.",
  "건강에 좋은 우리 동네 병원·약국 정보를 나눠 주세요.",
  "요즘 읽고 있는 책이나 신문 기사가 있으세요?",
  "젊은 사람들에게 꼭 해 주고 싶은 말이 있나요?",
] as const;

/** 날짜(서버 시간대 기준)와 방 id 로 정해지는 오늘의 이야깃거리 */
export function todayTopic(roomId: string, now = new Date()): string {
  const day = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
  let h = 0;
  for (const ch of roomId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TOPICS[(day + h) % TOPICS.length];
}
