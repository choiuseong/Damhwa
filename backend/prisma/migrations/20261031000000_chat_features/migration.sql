-- [변경] 새 파일: 최대 인원, 메시지 종류·삭제, 참여자, 나에게만 삭제, 예약 전송 테이블
-- 사이버 경로당 추가 기능: 나가기·인원 제한·메시지 종류(사진/스티커/안내)·삭제·예약 전송
-- 모두 IF NOT EXISTS 라 서버 시작 때 다시 실행돼도 안전

-- 방 최대 인원 (NULL = 제한 없음)
ALTER TABLE "chat_rooms" ADD COLUMN IF NOT EXISTS "maxMembers" INTEGER;

-- 메시지 종류: text | image | sticker | system, 모두에게 삭제한 시각
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "kind" VARCHAR(10) NOT NULL DEFAULT 'text';
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- 방 참여자 (leftAt 이 있으면 나간 사람. historyFrom 보다 큰 id 의 메시지만 보임)
CREATE TABLE IF NOT EXISTS "chat_members" (
    "roomId" VARCHAR(64) NOT NULL,
    "userId" BIGINT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadId" BIGINT NOT NULL DEFAULT 0,
    "historyFrom" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "chat_members_pkey" PRIMARY KEY ("roomId", "userId"),
    CONSTRAINT "chat_members_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "chat_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "chat_members_userId_idx" ON "chat_members"("userId");

-- 나에게만 삭제
CREATE TABLE IF NOT EXISTS "chat_message_hides" (
    "userId" BIGINT NOT NULL,
    "messageId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_message_hides_pkey" PRIMARY KEY ("userId", "messageId"),
    CONSTRAINT "chat_message_hides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "chat_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_message_hides_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 예약 전송 (status: pending | sending | sent | canceled)
CREATE TABLE IF NOT EXISTS "chat_scheduled" (
    "id" BIGSERIAL NOT NULL,
    "roomId" VARCHAR(64) NOT NULL,
    "userId" BIGINT NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'pending',
    "messageId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_scheduled_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_scheduled_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_scheduled_userId_fkey" FOREIGN KEY ("userId") REFERENCES "chat_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "chat_scheduled_status_sendAt_idx" ON "chat_scheduled"("status", "sendAt");
CREATE INDEX IF NOT EXISTS "chat_scheduled_userId_roomId_idx" ON "chat_scheduled"("userId", "roomId");
