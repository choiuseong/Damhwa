ALTER TABLE "users" ADD COLUMN "sessionToken" TEXT;
CREATE UNIQUE INDEX "users_sessionToken_key" ON "users"("sessionToken");
ALTER TABLE "schedules" ADD COLUMN "clientId" TEXT;
ALTER TABLE "schedules" ADD COLUMN "category" TEXT NOT NULL DEFAULT '일정';
ALTER TABLE "schedules" ADD COLUMN "place" TEXT;
CREATE UNIQUE INDEX "schedules_userId_clientId_key" ON "schedules"("userId", "clientId");
ALTER TABLE "messages" ADD COLUMN "clientId" TEXT;
CREATE UNIQUE INDEX "messages_conversationId_clientId_key" ON "messages"("conversationId", "clientId");
CREATE TABLE "chat_rooms" (
 "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "meets" TEXT NOT NULL,
 "lat" DOUBLE PRECISION, "lng" DOUBLE PRECISION,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "chat_messages" (
 "id" BIGSERIAL PRIMARY KEY, "roomId" TEXT NOT NULL REFERENCES "chat_rooms"("id") ON DELETE CASCADE,
 "userId" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "text" TEXT NOT NULL, "clientId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "chat_messages_roomId_id_idx" ON "chat_messages"("roomId", "id");
CREATE UNIQUE INDEX "chat_messages_roomId_userId_clientId_key" ON "chat_messages"("roomId", "userId", "clientId");
CREATE TABLE "chat_reports" (
 "id" BIGSERIAL PRIMARY KEY, "reporterId" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "messageId" BIGINT NOT NULL REFERENCES "chat_messages"("id") ON DELETE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "chat_blocks" (
 "userId" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "blockedId" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 PRIMARY KEY ("userId", "blockedId")
);
INSERT INTO "chat_rooms" ("id", "title", "meets") VALUES
 ('room-news', '오늘 아침 신문 이야기', '매일 오전 10:00'),
 ('room-town', '우리 동네 이야기', '매주 화요일 오후 2:00'),
 ('room-anyang', '안양 소통방', '언제든 편하게');
