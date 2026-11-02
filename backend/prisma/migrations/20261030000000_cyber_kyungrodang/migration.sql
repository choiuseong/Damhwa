-- [변경] 새 파일: 채팅 사용자·방·메시지·신고·차단 테이블, 기본 공용 방 3개
-- 사이버 경로당(동네 채팅) 테이블
-- IF NOT EXISTS: 서버가 시작할 때 같은 SQL 로 테이블을 만들어 두었더라도 마이그레이션이 실패하지 않게 함

-- 채팅 사용자 (기기별 익명 사용자)
CREATE TABLE IF NOT EXISTS "chat_users" (
    "id" BIGSERIAL NOT NULL,
    "deviceId" VARCHAR(64) NOT NULL,
    "nickname" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "chat_users_deviceId_key" ON "chat_users"("deviceId");

-- 채팅방 (lat/lng 가 없으면 모두에게 보이는 공용 방)
CREATE TABLE IF NOT EXISTS "chat_rooms" (
    "id" VARCHAR(64) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "meets" VARCHAR(100) NOT NULL DEFAULT '언제든 편하게',
    "icon" VARCHAR(40) NOT NULL DEFAULT 'chatbubbles',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdBy" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_rooms_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "chat_users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 채팅 메시지 (hidden = 신고 누적으로 숨김)
CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" BIGSERIAL NOT NULL,
    "roomId" VARCHAR(64) NOT NULL,
    "userId" BIGINT NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "clientId" VARCHAR(64) NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "chat_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_roomId_userId_clientId_key" ON "chat_messages"("roomId", "userId", "clientId");
CREATE INDEX IF NOT EXISTS "chat_messages_roomId_id_idx" ON "chat_messages"("roomId", "id");

-- 신고 (한 사람이 같은 메시지를 한 번만 신고)
CREATE TABLE IF NOT EXISTS "chat_reports" (
    "id" BIGSERIAL NOT NULL,
    "messageId" BIGINT NOT NULL,
    "reporterId" BIGINT NOT NULL,
    "reason" VARCHAR(20) NOT NULL,
    "detail" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_reports_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "chat_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "chat_reports_messageId_reporterId_key" ON "chat_reports"("messageId", "reporterId");

-- 차단 (blocker 에게 blocked 의 메시지가 보이지 않음)
CREATE TABLE IF NOT EXISTS "chat_blocks" (
    "blockerId" BIGINT NOT NULL,
    "blockedId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_blocks_pkey" PRIMARY KEY ("blockerId", "blockedId"),
    CONSTRAINT "chat_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "chat_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "chat_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 기본 공용 방 (앱의 DEFAULT_ROOMS 와 같은 id)
INSERT INTO "chat_rooms" ("id", "title", "meets", "icon", "featured") VALUES
    ('room-news', '오늘 아침 신문 이야기', '매일 오전 10:00', 'newspaper', true),
    ('room-town', '우리 동네 이야기', '매주 화요일 오후 2:00', 'cafe', false),
    ('room-anyang', '안양 소통방', '언제든 편하게', 'chatbubbles', false)
ON CONFLICT ("id") DO NOTHING;
