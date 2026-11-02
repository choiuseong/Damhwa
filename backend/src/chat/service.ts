// [변경] 새 파일: 메시지 저장, 들어오기(인원 제한)·나가기
// [변경] 3차: 나가기 때 방장 위임·빈 방 닫기, 방 정보
// [변경] 4차: 방 정보에 방 이름·참석·출석 수, 내 참석 답·연속 출석, 출석 저장
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { ChatHub } from "./hub";
import { MESSAGE_SELECT, todayTopic, type MessageKind, type MessageRow } from "./shapes";

export interface Membership {
  roomId: string;
  userId: string;
  lastReadId: string;
  historyFrom: string;
}

/**
 * 메시지 저장·참여자 관리처럼 여러 곳(REST, 예약 전송)에서 같이 쓰는 기능
 */
export function createChatService(pool: Pool, hub: ChatHub) {
  /** 지금 참여 중인지 (나간 사람은 null) */
  async function activeMember(roomId: string, userId: string): Promise<Membership | null> {
    const { rows } = await pool.query(
      `SELECT "roomId", "userId", "lastReadId", "historyFrom" FROM "chat_members"
        WHERE "roomId" = $1 AND "userId" = $2 AND "leftAt" IS NULL`,
      [roomId, userId],
    );
    if (!rows[0]) return null;
    return {
      roomId: rows[0].roomId,
      userId: String(rows[0].userId),
      lastReadId: String(rows[0].lastReadId),
      historyFrom: String(rows[0].historyFrom),
    };
  }

  async function memberCount(roomId: string, db: Pool | PoolClient = pool): Promise<number> {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS "n" FROM "chat_members" WHERE "roomId" = $1 AND "leftAt" IS NULL`, [roomId]);
    return rows[0].n;
  }

  /**
   * 메시지 저장 → 같은 방에 실시간 전달.
   * 같은 (방, 사람, clientId) 는 한 번만 저장(재시도 중복 방지).
   */
  async function insertMessage(
    roomId: string, userId: string, text: string, kind: MessageKind, clientId: string,
    opts: { onlyIfMember?: boolean } = {},
  ): Promise<{ row: MessageRow; isNew: boolean } | null> {
    // onlyIfMember 가 없으면 항상 저장되므로 null 이 아님
    const memberCheck = opts.onlyIfMember
      ? `WHERE EXISTS (SELECT 1 FROM "chat_members" WHERE "roomId" = $1::varchar AND "userId" = $2::bigint AND "leftAt" IS NULL)`
      : "";
    const inserted = await pool.query(
      `INSERT INTO "chat_messages" ("roomId", "userId", "text", "kind", "clientId")
       SELECT $1::varchar, $2::bigint, $3::varchar, $4::varchar, $5::varchar ${memberCheck}
       ON CONFLICT ("roomId", "userId", "clientId") DO NOTHING RETURNING "id"`,
      [roomId, userId, text, kind, clientId],
    );
    const isNew = inserted.rowCount === 1;
    const { rows } = await pool.query(
      `${MESSAGE_SELECT} WHERE m."roomId" = $1 AND m."userId" = $2 AND m."clientId" = $3`,
      [roomId, userId, clientId],
    );
    if (!rows[0]) return null; // 참여 중이 아니라 저장하지 않음
    if (isNew) await hub.broadcastMessage(roomId, rows[0]).catch(() => {});
    return { row: rows[0], isNew };
  }

  /** "이웃 3님이 들어왔어요" 같은 안내 메시지 */
  async function systemMessage(roomId: string, userId: string, text: string) {
    await insertMessage(roomId, userId, text, "system", `sys-${randomUUID()}`);
  }

  async function nickname(userId: string): Promise<string> {
    const { rows } = await pool.query(`SELECT "nickname" FROM "chat_users" WHERE "id" = $1`, [userId]);
    return rows[0]?.nickname ?? "이웃";
  }

  type JoinResult =
    | { ok: true; memberCount: number; maxMembers: number | null; isNewJoin: boolean; becameOwner: boolean }
    | { ok: false; reason: "full"; memberCount: number; maxMembers: number }
    | { ok: false; reason: "closed" };

  /**
   * 방 들어가기. 인원 제한을 넘으면 거절.
   * 한 번 나갔다가 다시 들어오면, 다시 들어온 뒤의 대화만 보임(historyFrom).
   */
  async function join(roomId: string, userId: string): Promise<JoinResult> {
    const client = await pool.connect();
    let result: JoinResult;
    try {
      await client.query("BEGIN");
      // 같은 방에 동시에 들어올 때 인원 계산이 꼬이지 않게 방을 잠금
      const room = (await client.query(
        `SELECT "maxMembers", "closedAt", "createdBy", "ownerId" FROM "chat_rooms" WHERE "id" = $1 FOR UPDATE`, [roomId])).rows[0];
      if (!room || room.closedAt) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "closed" };
      }
      const max: number | null = room?.maxMembers ?? null;
      const existing = (await client.query(
        `SELECT "leftAt" FROM "chat_members" WHERE "roomId" = $1 AND "userId" = $2`, [roomId, userId])).rows[0];
      if (existing && existing.leftAt === null) {
        result = { ok: true, memberCount: await memberCount(roomId, client), maxMembers: max, isNewJoin: false, becameOwner: false };
        await client.query("COMMIT");
        return result;
      }
      const count = await memberCount(roomId, client);
      if (max !== null && count >= max) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "full", memberCount: count, maxMembers: max };
      }
      const lastId = (await client.query(
        `SELECT COALESCE(MAX("id"), 0) AS "id" FROM "chat_messages" WHERE "roomId" = $1`, [roomId])).rows[0].id;
      if (existing) {
        await client.query(
          `UPDATE "chat_members" SET "leftAt" = NULL, "joinedAt" = CURRENT_TIMESTAMP, "historyFrom" = $3, "lastReadId" = $3
            WHERE "roomId" = $1 AND "userId" = $2`, [roomId, userId, lastId]);
      } else {
        // 처음 들어오면 지난 대화도 보이되, 그 대화는 '새 글'로 세지 않음
        await client.query(
          `INSERT INTO "chat_members" ("roomId", "userId", "historyFrom", "lastReadId") VALUES ($1, $2, 0, $3)`,
          [roomId, userId, lastId]);
      }
      // 이웃이 만든 방인데 방장이 비어 있으면(예: 예전 데이터) 들어온 사람이 방장
      let becameOwner = false;
      if (room.createdBy !== null && room.ownerId === null) {
        await client.query(`UPDATE "chat_rooms" SET "ownerId" = $2 WHERE "id" = $1`, [roomId, userId]);
        becameOwner = true;
      }
      await client.query("COMMIT");
      result = { ok: true, memberCount: count + 1, maxMembers: max, isNewJoin: true, becameOwner };
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    return result;
  }

  type LeaveResult = {
    wasMember: boolean;
    memberCount: number;
    /** 방장이 나가서 새로 방장이 된 사람 (없으면 null) */
    newOwnerId: string | null;
    /** 마지막 사람이 나가서 방이 닫힘 */
    closed: boolean;
  };

  /**
   * 방 나가기.
   * - 방장이 나가면 남은 사람 중 먼저 들어온 사람에게 방장을 넘김
   * - 이웃이 만든 방에 아무도 남지 않으면 방을 닫음(모두의 목록에서 사라짐)
   */
  async function leave(roomId: string, userId: string): Promise<LeaveResult> {
    const client = await pool.connect();
    let result: LeaveResult;
    try {
      await client.query("BEGIN");
      // 들어오기와 동시에 일어나도 인원·방장 계산이 꼬이지 않게 방을 잠금
      const room = (await client.query(
        `SELECT "createdBy", "ownerId" FROM "chat_rooms" WHERE "id" = $1 FOR UPDATE`, [roomId])).rows[0];
      const res = await client.query(
        `UPDATE "chat_members" SET "leftAt" = CURRENT_TIMESTAMP WHERE "roomId" = $1 AND "userId" = $2 AND "leftAt" IS NULL`,
        [roomId, userId]);
      let newOwnerId: string | null = null;
      let closed = false;
      if (res.rowCount) {
        // 나간 방의 예약 메시지는 취소
        await client.query(
          `UPDATE "chat_scheduled" SET "status" = 'canceled'
            WHERE "roomId" = $1 AND "userId" = $2 AND "status" IN ('pending', 'sending')`,
          [roomId, userId]);
        const remaining = await memberCount(roomId, client);
        if (room && room.createdBy !== null && remaining === 0) {
          await client.query(
            `UPDATE "chat_rooms" SET "closedAt" = CURRENT_TIMESTAMP, "ownerId" = NULL WHERE "id" = $1`, [roomId]);
          closed = true;
        } else if (room && room.ownerId !== null && String(room.ownerId) === userId) {
          const next = (await client.query(
            `SELECT "userId" FROM "chat_members" WHERE "roomId" = $1 AND "leftAt" IS NULL
              ORDER BY "joinedAt", "userId" LIMIT 1`, [roomId])).rows[0];
          newOwnerId = next ? String(next.userId) : null;
          await client.query(`UPDATE "chat_rooms" SET "ownerId" = $2 WHERE "id" = $1`, [roomId, newOwnerId]);
        }
        result = { wasMember: true, memberCount: remaining, newOwnerId, closed };
      } else {
        result = { wasMember: false, memberCount: await memberCount(roomId, client), newOwnerId: null, closed: false };
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    return result;
  }

  /** 오늘 날짜 (서버 시간대 기준 YYYY-MM-DD) */
  function today(now = new Date()): string {
    return now.toLocaleDateString("sv-SE");
  }

  /**
   * 방 위쪽에 보여 줄 정보 (모두에게 같은 부분):
   * 방 이름, 방장, 공지와 참석 답, 오늘의 이야깃거리, 오늘 인사한 이웃 수
   */
  async function roomInfo(roomId: string) {
    const { rows } = await pool.query(
      `SELECT r."title", r."ownerId", r."notice", u."nickname" AS "ownerName"
         FROM "chat_rooms" r LEFT JOIN "chat_users" u ON u."id" = r."ownerId" WHERE r."id" = $1`, [roomId]);
    const r = rows[0];
    // 지금 참여 중인 사람의 답만 셈
    const rsvp = await pool.query(
      `SELECT v."answer", u."nickname" FROM "chat_rsvps" v
         JOIN "chat_members" m ON m."roomId" = v."roomId" AND m."userId" = v."userId" AND m."leftAt" IS NULL
         JOIN "chat_users" u ON u."id" = v."userId"
        WHERE v."roomId" = $1 ORDER BY v."createdAt"`, [roomId]);
    const yes = rsvp.rows.filter((x) => x.answer === "yes");
    const checked = await pool.query(
      `SELECT COUNT(*)::int AS "n" FROM "chat_checkins" WHERE "roomId" = $1 AND "day" = $2::date`, [roomId, today()]);
    return {
      title: (r?.title as string) ?? "",
      ownerId: r?.ownerId === null || r?.ownerId === undefined ? null : String(r.ownerId),
      ownerName: (r?.ownerName as string | null) ?? null,
      notice: (r?.notice as string | null) ?? null,
      topic: todayTopic(roomId),
      rsvpYes: yes.length,
      rsvpNo: rsvp.rows.length - yes.length,
      /** 갈게요 한 이웃 (최대 20명) */
      rsvpYesNames: yes.slice(0, 20).map((x) => x.nickname as string),
      checkinCount: checked.rows[0].n as number,
    };
  }

  /** 사람마다 다른 부분: 내 참석 답, 오늘 인사했는지, 연속 출석 일수 */
  async function myRoomState(roomId: string, userId: string) {
    const mine = await pool.query(`SELECT "answer" FROM "chat_rsvps" WHERE "roomId" = $1 AND "userId" = $2`, [roomId, userId]);
    const days = (await pool.query(
      `SELECT to_char("day", 'YYYY-MM-DD') AS "d" FROM "chat_checkins"
        WHERE "roomId" = $1 AND "userId" = $2 ORDER BY "day" DESC LIMIT 400`, [roomId, userId])).rows.map((x) => x.d as string);
    const now = new Date();
    const doneToday = days[0] === today(now);
    // 오늘(안 했으면 어제)부터 하루씩 거슬러 올라가며 연속으로 인사한 날 수
    let streak = 0;
    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (doneToday ? 0 : 1));
    for (const d of days) {
      if (d === today(now)) { if (!doneToday) continue; }
      if (d !== today(cursor)) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { rsvpMine: (mine.rows[0]?.answer as "yes" | "no" | undefined) ?? null, checkedInToday: doneToday, streak };
  }

  /** 출석 도장. 오늘 처음이면 true */
  async function checkIn(roomId: string, userId: string): Promise<boolean> {
    const r = await pool.query(
      `INSERT INTO "chat_checkins" ("roomId", "userId", "day") VALUES ($1, $2, $3::date) ON CONFLICT DO NOTHING`,
      [roomId, userId, today()]);
    return r.rowCount === 1;
  }

  return { activeMember, memberCount, insertMessage, systemMessage, nickname, join, leave, roomInfo, myRoomState, checkIn };
}

export type ChatService = ReturnType<typeof createChatService>;
