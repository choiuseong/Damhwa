-- [변경] 새 파일: 모임 참석(chat_rsvps)·출석 도장(chat_checkins) 테이블
-- 사이버 경로당 4차: 모임 참석 체크(공지)·출석 도장(하루 한 번 인사)

-- 공지에 대한 참석 답 (yes = 갈게요, no = 못 가요). 공지가 바뀌면 지움
CREATE TABLE IF NOT EXISTS "chat_rsvps" (
    "roomId" VARCHAR(64) NOT NULL,
    "userId" BIGINT NOT NULL,
    "answer" VARCHAR(5) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_rsvps_pkey" PRIMARY KEY ("roomId", "userId"),
    CONSTRAINT "chat_rsvps_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "chat_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 출석 도장 (방마다 하루 한 번)
CREATE TABLE IF NOT EXISTS "chat_checkins" (
    "roomId" VARCHAR(64) NOT NULL,
    "userId" BIGINT NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_checkins_pkey" PRIMARY KEY ("roomId", "userId", "day"),
    CONSTRAINT "chat_checkins_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "chat_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "chat_checkins_roomId_day_idx" ON "chat_checkins"("roomId", "day");
