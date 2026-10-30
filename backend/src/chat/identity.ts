// [변경] 새 파일: 기기 ID(X-Device-Id)로 사용자 구분, 닉네임 "이웃 N"
import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";

export interface ChatUser {
  id: string;
  nickname: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      chatUser?: ChatUser;
    }
  }
}

/** 앱이 설치될 때 만든 무작위 기기 ID (영문·숫자·-_ 16~64자) */
const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/;

export function isValidDeviceId(value: unknown): value is string {
  return typeof value === "string" && DEVICE_ID.test(value);
}

/**
 * 기기 ID 로 채팅 사용자를 찾고, 없으면 만든다. 닉네임은 "이웃 12" 처럼 자동으로 붙인다.
 * 로그인 기능이 없는 과제 범위라 기기 ID 를 그대로 신원으로 쓴다(설계 문서의 보안 한계 참고).
 */
export function createIdentity(pool: Pool) {
  const cache = new Map<string, ChatUser>();

  async function resolve(deviceId: string): Promise<ChatUser> {
    const hit = cache.get(deviceId);
    if (hit) return hit;
    await pool.query(
      `INSERT INTO "chat_users" ("deviceId", "nickname") VALUES ($1, '이웃') ON CONFLICT ("deviceId") DO NOTHING`,
      [deviceId],
    );
    const { rows } = await pool.query(
      `UPDATE "chat_users" SET "nickname" = '이웃 ' || "id"
         WHERE "deviceId" = $1 AND "nickname" = '이웃'
       RETURNING "id", "nickname"`,
      [deviceId],
    );
    const row =
      rows[0] ??
      (await pool.query(`SELECT "id", "nickname" FROM "chat_users" WHERE "deviceId" = $1`, [deviceId])).rows[0];
    const user = { id: String(row.id), nickname: row.nickname as string };
    if (cache.size > 5000) cache.clear();
    cache.set(deviceId, user);
    return user;
  }

  /** REST 요청용: X-Device-Id 헤더 필수 */
  async function middleware(req: Request, res: Response, next: NextFunction) {
    const deviceId = req.header("x-device-id");
    if (!isValidDeviceId(deviceId)) {
      res.status(401).json({ message: "앱을 다시 실행해 주세요. (기기 정보가 없어요)" });
      return;
    }
    req.chatUser = await resolve(deviceId);
    next();
  }

  return { resolve, middleware };
}
