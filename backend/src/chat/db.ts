// [변경] 새 파일: 채팅 DB 연결, 시간대 맞춤, 마이그레이션 자동 적용
// [변경] 4차: 마이그레이션 20261102000000_chat_activity 추가
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * 사이버 경로당 전용 DB 연결.
 * Prisma 와 같은 DATABASE_URL 을 쓰지만, 채팅 기능은 pg 로 직접 쿼리합니다.
 * (Prisma 클라이언트 생성 없이도 채팅 서버와 테스트가 돌 수 있게 하기 위함)
 */
export function createChatPool(connectionString = process.env.DATABASE_URL): Pool {
  if (!connectionString) {
    throw new Error("DATABASE_URL 이 설정되지 않았어요. backend/.env 를 확인해 주세요.");
  }
  const pool = new Pool({ connectionString, max: 10 });
  // DB 가 잠깐 끊겨도 서버가 죽지 않게 (쉬고 있던 연결의 오류를 받아 줌). 다음 요청 때 새로 연결됨
  pool.on("error", (e: Error & { code?: string }) => console.error("[chat-db] 연결 끊김", e.code ?? e.message));
  // DB 의 '지금 시각'(CURRENT_TIMESTAMP)을 서버(Node)와 같은 시간대로 맞춤.
  // (예: 한국 시간 PC + UTC Docker DB 에서 메시지 시각이 9시간 어긋나는 문제 방지)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz && /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(tz)) {
    pool.on("connect", (client) => { client.query(`SET TIME ZONE '${tz}'`).catch(() => {}); });
  }
  return pool;
}

/** 채팅 관련 마이그레이션 (순서대로) */
const MIGRATIONS = [
  "20261030000000_cyber_kyungrodang",
  "20261031000000_chat_features",
  "20261101000000_chat_owner_likes",
  "20261102000000_chat_activity",
].map((name) => path.join(__dirname, "../../prisma/migrations", name, "migration.sql"));

/**
 * 채팅 테이블이 없으면 만든다. (마이그레이션과 같은 SQL, 모두 IF NOT EXISTS 라 여러 번 실행해도 안전)
 * Docker PostgreSQL 에서 prisma migrate 를 깜빡해도, 내장 DB 에서도 채팅이 바로 동작하게 하기 위함.
 */
export async function ensureChatSchema(pool: Pool): Promise<void> {
  for (const file of MIGRATIONS) await pool.query(readFileSync(file, "utf8"));
}
