-- [변경] 새 파일: 방장·공지·닫힌 방, 공감 테이블
-- 사이버 경로당 3차: 방장(위임)·방 공지·빈 방 닫기·공감(하트)
-- 모두 IF NOT EXISTS / 조건부 UPDATE 라 서버 시작 때 다시 실행돼도 안전

-- 방장 (만든 사람이 처음 방장, 방장이 나가면 먼저 들어온 사람에게 넘어감. 기본 공용 방은 NULL = 운영팀)
ALTER TABLE "chat_rooms" ADD COLUMN IF NOT EXISTS "ownerId" BIGINT;
-- 방장이 쓰는 공지 (방 위쪽에 고정)
ALTER TABLE "chat_rooms" ADD COLUMN IF NOT EXISTS "notice" VARCHAR(200);
-- 이웃이 만든 방에 아무도 남지 않으면 닫힘 (목록에서 사라짐)
ALTER TABLE "chat_rooms" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_rooms_ownerId_fkey') THEN
    ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "chat_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 이전 버전에서 만든 방: 아무도 없으면 닫고, 방장이 비어 있으면 (만든 사람 → 먼저 들어온 사람) 순으로 채움
UPDATE "chat_rooms" r SET "closedAt" = CURRENT_TIMESTAMP
 WHERE r."createdBy" IS NOT NULL AND r."closedAt" IS NULL
   AND NOT EXISTS (SELECT 1 FROM "chat_members" m WHERE m."roomId" = r."id" AND m."leftAt" IS NULL);
UPDATE "chat_rooms" r SET "ownerId" = (
         SELECT m."userId" FROM "chat_members" m
          WHERE m."roomId" = r."id" AND m."leftAt" IS NULL
          ORDER BY (m."userId" = r."createdBy") DESC, m."joinedAt", m."userId" LIMIT 1)
 WHERE r."createdBy" IS NOT NULL AND r."ownerId" IS NULL AND r."closedAt" IS NULL;

-- 공감(하트): 한 사람이 한 메시지에 한 번
CREATE TABLE IF NOT EXISTS "chat_likes" (
    "messageId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_likes_pkey" PRIMARY KEY ("messageId", "userId"),
    CONSTRAINT "chat_likes_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "chat_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
