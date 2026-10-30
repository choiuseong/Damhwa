// [변경] 새 파일: 방 목록·만들기(최대 인원)·들어오기·나가기, 메시지·스티커·사진, 삭제(모두에게/나에게만), 읽음, 예약 전송, 한 줄 요약, 신고(자동 숨김)·차단
// [변경] 3차: 닫힌 방·나간 이웃 방은 목록에서 제외, 방장 지정·위임 안내, 방 정보, 공지(방장), 공감, 배경 사진
// [변경] 4차: 방 이름 바꾸기(방장), 모임 참석 체크, 출석 도장, 공지가 바뀌면 참석 답 초기화
import { randomUUID } from "node:crypto";
import express, { Router, type NextFunction, type Request, type Response } from "express";
import type { Pool } from "pg";
import type { ChatHub } from "./hub";
import type { createIdentity } from "./identity";
import { MAX_IMAGE_BYTES, detectImage, removeImage, saveImage } from "./images";
import type { ChatService, Membership } from "./service";
import { MESSAGE_SELECT, REPORT_REASONS, STICKERS, messageShape, roomShape, type Likes, type ReportReason } from "./shapes";
import { createSummary } from "./summary";

/** 서로 다른 사람 몇 명이 신고하면 메시지를 자동으로 숨길지 (기본 3명) */
const HIDE_THRESHOLD = Math.max(1, Number(process.env.CHAT_HIDE_THRESHOLD) || 3);
/** 반경 (km) */
const RADIUS_KM = 2;
/** 도배 방지: 10초에 10개까지 */
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 10;
/** 방 최대 인원으로 고를 수 있는 범위 */
const MIN_MEMBERS = 2;
const MAX_MEMBERS = 100;
/** 예약 전송: 최소 30초 뒤 ~ 최대 7일 뒤, 한 사람당 대기 중 20개까지 */
const SCHEDULE_MIN_MS = 60_000;
const SCHEDULE_MAX_MS = 7 * 24 * 60 * 60 * 1000;
const SCHEDULE_MAX_PENDING = 20;

const ID = /^\d{1,18}$/;
const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

function validCoords(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      membership?: Membership;
    }
  }
}

export function createChatRouter(
  pool: Pool, identity: ReturnType<typeof createIdentity>, hub: ChatHub, service: ChatService,
) {
  const router = Router();
  const summary = createSummary(pool);
  const recentSends = new Map<string, number[]>();
  const recentRooms = new Map<string, number[]>();
  const recentJoins = new Map<string, number[]>();
  const recentImages = new Map<string, number[]>();
  /** 사용자별 최근 기록이 한도를 넘었는지 확인하고, 넘지 않았으면 지금 시각을 기록 */
  function hitLimit(map: Map<string, number[]>, userId: string, windowMs: number, max: number): boolean {
    const now = Date.now();
    const list = (map.get(userId) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= max) { map.set(userId, list); return true; }
    list.push(now);
    map.set(userId, list);
    if (map.size > 10000) for (const [k, v] of map) if (!v.some((t) => now - t < windowMs)) map.delete(k);
    return false;
  }

  /** 여러 메시지의 공감 수와 내가 눌렀는지 한 번에 */
  async function likesFor(ids: string[], me: string): Promise<Map<string, Likes>> {
    const map = new Map<string, Likes>();
    if (!ids.length) return map;
    const { rows } = await pool.query(
      `SELECT "messageId", COUNT(*)::int AS "n", BOOL_OR("userId" = $2) AS "mine"
         FROM "chat_likes" WHERE "messageId" = ANY($1::bigint[]) GROUP BY "messageId"`, [ids, me]);
    for (const r of rows) map.set(String(r.messageId), { count: r.n, mine: !!r.mine });
    return map;
  }

  /** 방 정보에서 방장 id 대신 '내가 방장인지'만 보냄 + 내 참석 답·출석 */
  async function publicInfo(info: Awaited<ReturnType<ChatService["roomInfo"]>>, me: string, roomId: string) {
    const { ownerId, ...rest } = info;
    return { ...rest, isOwner: ownerId !== null && ownerId === me, ...(await service.myRoomState(roomId, me)) };
  }

  const recentLikes = new Map<string, number[]>();
  const recentBackgrounds = new Map<string, number[]>();
  const recentRenames = new Map<string, number[]>();

  router.use(identity.middleware);

  // ── 방 목록: 공용 방(위치 없음) + 내 위치 반경 2km 안의 방
  //    참여 인원, 최대 인원, 내가 참여 중인지, 안 읽은 새 글 수를 함께 보냄
  router.get("/", async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const located = req.query.lat !== undefined && req.query.lng !== undefined && validCoords(lat, lng);
    const me = req.chatUser!.id;
    const { rows } = await pool.query(
      `SELECT r.*,
              (SELECT COUNT(*) FROM "chat_members" cm WHERE cm."roomId" = r."id" AND cm."leftAt" IS NULL) AS "memberCount",
              (mine."userId" IS NOT NULL AND mine."leftAt" IS NULL) AS "joined",
              CASE WHEN mine."userId" IS NOT NULL AND mine."leftAt" IS NULL THEN (
                SELECT COUNT(*) FROM "chat_messages" m
                 WHERE m."roomId" = r."id" AND m."id" > GREATEST(mine."lastReadId", mine."historyFrom")
                   AND m."userId" <> $1 AND m."kind" <> 'system' AND m."hidden" = false AND m."deletedAt" IS NULL
                   AND NOT EXISTS (SELECT 1 FROM "chat_blocks" b WHERE b."blockerId" = $1 AND b."blockedId" = m."userId")
                   AND NOT EXISTS (SELECT 1 FROM "chat_message_hides" h WHERE h."userId" = $1 AND h."messageId" = m."id")
              ) ELSE 0 END AS "unread"
         FROM "chat_rooms" r
         LEFT JOIN "chat_members" mine ON mine."roomId" = r."id" AND mine."userId" = $1
        -- 닫힌 방, 그리고 이웃이 만든 방 중 내가 나간 방은 내 목록에서 뺌 (공용 방은 언제든 다시 참여 가능)
        WHERE r."closedAt" IS NULL
          AND NOT (r."createdBy" IS NOT NULL AND mine."userId" IS NOT NULL AND mine."leftAt" IS NOT NULL)
        ORDER BY r."featured" DESC, r."createdAt",
                 CASE r."id" WHEN 'room-town' THEN 0 WHEN 'room-anyang' THEN 1 ELSE 2 END, r."id"`,
      [me],
    );
    const visible = rows.filter((r) => {
      if (r.lat === null || r.lng === null) return true;
      if (r.joined) return true; // 참여 중인 방은 위치와 상관없이 보임
      if (!located) return false;
      return distanceKm(lat, lng, r.lat, r.lng) <= RADIUS_KM;
    });
    res.json(visible.map((r) => roomShape(r, me)));
  });

  // ── 알림 한 줄 요약 (참여 중인 방의 안 읽은 글). OpenAI 키가 있으면 AI 요약, 없으면 규칙 기반
  router.get("/summary", async (req, res) => {
    res.json(await summary.forUser(req.chatUser!.id));
  });

  // ── 방 만들기 (위치를 보내면 그 위치 반경 2km 사람에게만 보이는 동네 방, maxMembers 로 인원 제한)
  router.post("/", async (req, res) => {
    const { title, meets, lat, lng, maxMembers } = req.body ?? {};
    const hasCoords = lat !== undefined || lng !== undefined;
    const hasMax = maxMembers !== undefined && maxMembers !== null;
    if (typeof title !== "string" || !title.trim() || title.trim().length > 100
      || (meets !== undefined && (typeof meets !== "string" || meets.length > 100))
      || (hasCoords && !validCoords(lat, lng))) {
      res.status(400).json({ message: "채팅방 이름(100자 이내)을 확인해 주세요." });
      return;
    }
    if (hasMax && (!Number.isInteger(maxMembers) || maxMembers < MIN_MEMBERS || maxMembers > MAX_MEMBERS)) {
      res.status(400).json({ message: `최대 인원은 ${MIN_MEMBERS}~${MAX_MEMBERS}명 사이로 정해 주세요.` });
      return;
    }
    // 방 도배 방지: 1분에 3개까지
    if (hitLimit(recentRooms, req.chatUser!.id, 60_000, 3)) {
      res.status(429).json({ message: "채팅방을 너무 많이 만들고 있어요. 잠시 후 다시 해 주세요." });
      return;
    }
    // 위치는 약 100m 단위로만 저장 (개인정보 보호)
    const round = (v: number) => Math.round(v * 1000) / 1000;
    const { rows } = await pool.query(
      `INSERT INTO "chat_rooms" ("id", "title", "meets", "lat", "lng", "createdBy", "maxMembers", "ownerId")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $6) RETURNING *`,
      [`r-${randomUUID()}`, title.trim(), (meets ?? "").trim() || "언제든 편하게",
        hasCoords ? round(lat) : null, hasCoords ? round(lng) : null, req.chatUser!.id, hasMax ? maxMembers : null],
    );
    // 만든 사람은 자동으로 참여
    await service.join(rows[0].id, req.chatUser!.id);
    res.status(201).json(roomShape({ ...rows[0], memberCount: 1, joined: true, unread: 0 }, req.chatUser!.id));
  });

  // ── 아래 경로는 방이 있어야 함
  async function requireRoom(req: Request, res: Response, next: NextFunction) {
    const roomId = String(req.params.roomId);
    if (roomId.length > 64) { res.status(404).json({ message: "채팅방을 찾을 수 없어요." }); return; }
    const { rows } = await pool.query(`SELECT "closedAt" FROM "chat_rooms" WHERE "id" = $1`, [roomId]);
    if (!rows[0]) { res.status(404).json({ message: "채팅방을 찾을 수 없어요." }); return; }
    if (rows[0].closedAt) { res.status(404).json({ code: "ROOM_CLOSED", message: "모두 나가서 닫힌 채팅방이에요." }); return; }
    next();
  }

  // ── 아래 경로는 방에 참여 중이어야 함 (나간 사람·안 들어온 사람은 403)
  async function requireMember(req: Request, res: Response, next: NextFunction) {
    const m = await service.activeMember(String(req.params.roomId), req.chatUser!.id);
    if (!m) { res.status(403).json({ code: "NOT_MEMBER", message: "채팅방에 먼저 들어와 주세요." }); return; }
    req.membership = m;
    next();
  }

  // ── 방 들어가기 (인원이 꽉 차면 409). 처음 들어오면 "OO님이 들어왔어요" 안내
  router.post("/:roomId/join", requireRoom, async (req, res) => {
    const roomId = String(req.params.roomId);
    const me = req.chatUser!.id;
    // 이미 참여 중이면 그냥 통과, 새로 들어오기·나가기 반복은 1분에 6번까지 (안내 메시지 도배 방지)
    if (!(await service.activeMember(roomId, me)) && hitLimit(recentJoins, me, 60_000, 6)) {
      res.status(429).json({ message: "잠시 후 다시 들어와 주세요." });
      return;
    }
    const r = await service.join(roomId, me);
    if (!r.ok) {
      if (r.reason === "closed") { res.status(404).json({ code: "ROOM_CLOSED", message: "모두 나가서 닫힌 채팅방이에요." }); return; }
      res.status(409).json({ code: "ROOM_FULL", message: `인원이 가득 찼어요. (${r.memberCount}/${r.maxMembers}명)`, memberCount: r.memberCount, maxMembers: r.maxMembers });
      return;
    }
    if (r.isNewJoin) {
      await service.systemMessage(roomId, me, `${req.chatUser!.nickname}님이 들어왔어요.`);
      hub.broadcastMembers(roomId, r.memberCount);
    }
    const info = await service.roomInfo(roomId);
    if (r.becameOwner) {
      await service.systemMessage(roomId, me, `${req.chatUser!.nickname}님이 방장이 되었어요.`);
      hub.broadcastRoom(roomId, info);
    }
    res.json({ joined: true, memberCount: r.memberCount, maxMembers: r.maxMembers, ...(await publicInfo(info, me, roomId)) });
  });

  // ── 방 나가기: 인원 줄이기, "OO님이 나갔어요" 안내, 예약 메시지 취소.
  //    내가 보낸 글은 방에 남고, 다시 들어오면 그 뒤의 대화부터 보임
  router.post("/:roomId/leave", requireRoom, async (req, res) => {
    const roomId = String(req.params.roomId);
    const me = req.chatUser!.id;
    const r = await service.leave(roomId, me);
    if (r.wasMember) {
      hub.kick(roomId, me);
      if (!r.closed) {
        await service.systemMessage(roomId, me, `${req.chatUser!.nickname}님이 나갔어요.`);
        hub.broadcastMembers(roomId, r.memberCount);
      }
      if (r.newOwnerId) {
        // 방장이 나가면 먼저 들어온 사람이 새 방장
        await service.systemMessage(roomId, r.newOwnerId, `${await service.nickname(r.newOwnerId)}님이 새 방장이 되었어요.`);
        hub.broadcastRoom(roomId, await service.roomInfo(roomId));
      }
    }
    res.json({ left: true, memberCount: r.memberCount, closed: r.closed });
  });

  // ── 메시지 목록 (after = 마지막으로 받은 메시지 id)
  //    숨김(신고)·차단한 사람·나에게만 삭제한 메시지는 빼고, 다시 들어온 경우 그 뒤의 대화만
  router.get("/:roomId/messages", requireRoom, requireMember, async (req, res) => {
    const after = req.query.after === undefined ? "0" : String(req.query.after);
    if (!ID.test(after)) { res.status(400).json({ message: "메시지 위치를 확인해 주세요." }); return; }
    const me = req.chatUser!.id;
    const from = BigInt(after) > BigInt(req.membership!.historyFrom) ? after : req.membership!.historyFrom;
    const filter = `WHERE m."roomId" = $1 AND m."id" > $2 AND m."hidden" = false
           AND NOT EXISTS (SELECT 1 FROM "chat_blocks" b WHERE b."blockerId" = $3 AND b."blockedId" = m."userId")
           AND NOT EXISTS (SELECT 1 FROM "chat_message_hides" h WHERE h."userId" = $3 AND h."messageId" = m."id")`;
    // 처음 들어올 때(after 없음)는 최근 100개, 이어 받을 때는 오래된 것부터 200개씩
    const { rows } = await pool.query(
      after === "0"
        ? `SELECT * FROM (${MESSAGE_SELECT} ${filter} ORDER BY m."id" DESC LIMIT 100) t ORDER BY t."id" ASC`
        : `${MESSAGE_SELECT} ${filter} ORDER BY m."id" ASC LIMIT 200`,
      [req.params.roomId, from, me],
    );
    const likes = await likesFor(rows.map((r) => String(r.id)), me);
    res.json(rows.map((r) => messageShape(r, me, likes.get(String(r.id)))));
  });

  /** 도배 제한 확인 (같은 clientId 재시도는 세지 않음) */
  async function rateLimited(roomId: string, me: string, clientId: string): Promise<boolean> {
    const dup = await pool.query(
      `SELECT 1 FROM "chat_messages" WHERE "roomId" = $1 AND "userId" = $2 AND "clientId" = $3`, [roomId, me, clientId]);
    return !dup.rowCount && hitLimit(recentSends, me, RATE_WINDOW_MS, RATE_MAX);
  }

  // ── 메시지·스티커 보내기 { text, clientId, kind?: "text" | "sticker" }
  router.post("/:roomId/messages", requireRoom, requireMember, async (req, res) => {
    const { text, clientId } = req.body ?? {};
    const kind = req.body?.kind ?? "text";
    if (kind !== "text" && kind !== "sticker") { res.status(400).json({ message: "보낼 수 없는 종류예요." }); return; }
    if (typeof text !== "string" || !text.trim() || text.trim().length > 1000) {
      res.status(400).json({ message: "메시지는 1000자까지 보낼 수 있어요." });
      return;
    }
    if (kind === "sticker" && !(STICKERS as readonly string[]).includes(text)) {
      res.status(400).json({ message: "없는 스티커예요." });
      return;
    }
    if (typeof clientId !== "string" || !CLIENT_ID.test(clientId)) {
      res.status(400).json({ message: "앱을 최신으로 업데이트해 주세요." });
      return;
    }
    const roomId = String(req.params.roomId);
    const me = req.chatUser!.id;
    if (await rateLimited(roomId, me, clientId)) {
      res.status(429).json({ message: "메시지를 너무 빨리 보내고 있어요. 잠시 후 다시 보내 주세요." });
      return;
    }
    const { row, isNew } = (await service.insertMessage(roomId, me, kind === "text" ? text.trim() : text, kind, clientId))!;
    res.status(isNew ? 201 : 200).json(messageShape(row, me));
  });

  // ── 사진 보내기: 본문에 사진 파일 그대로(Content-Type: image/*), ?clientId=
  router.post(
    "/:roomId/images",
    // 참여 여부를 먼저 확인한 뒤에 사진 본문을 읽음
    requireRoom, requireMember,
    (req, res, next) => {
      if (hitLimit(recentImages, req.chatUser!.id, 10 * 60_000, 20)) {
        res.status(429).json({ message: "사진은 10분에 20장까지 보낼 수 있어요." });
        return;
      }
      next();
    },
    express.raw({ type: ["image/*", "application/octet-stream"], limit: MAX_IMAGE_BYTES }),
    async (req, res) => {
      const clientId = String(req.query.clientId ?? "");
      if (!CLIENT_ID.test(clientId)) { res.status(400).json({ message: "앱을 최신으로 업데이트해 주세요." }); return; }
      const buf = Buffer.isBuffer(req.body) ? req.body : null;
      const ext = buf ? detectImage(buf) : null;
      if (!buf || !ext) { res.status(400).json({ message: "사진(JPG·PNG·WEBP·GIF)만 보낼 수 있어요." }); return; }
      const roomId = String(req.params.roomId);
      const me = req.chatUser!.id;
      if (await rateLimited(roomId, me, clientId)) {
        res.status(429).json({ message: "너무 빨리 보내고 있어요. 잠시 후 다시 보내 주세요." });
        return;
      }
      const existing = await pool.query(
        `${MESSAGE_SELECT} WHERE m."roomId" = $1 AND m."userId" = $2 AND m."clientId" = $3`, [roomId, me, clientId]);
      if (existing.rows[0]) { res.json(messageShape(existing.rows[0], me)); return; }
      const url = await saveImage(buf, ext);
      const saved = await service.insertMessage(roomId, me, url, "image", clientId).catch(async (e) => {
        await removeImage(url); // DB 저장이 실패하면 파일도 지움
        throw e;
      });
      const { row, isNew } = saved!;
      if (!isNew) await removeImage(url);
      res.status(isNew ? 201 : 200).json(messageShape(row, me));
    },
  );

  // ── 메시지 삭제 { scope: "all" | "me" }
  //    all = 모두에게 삭제(내가 보낸 메시지만, 모든 화면에서 '삭제된 메시지예요')
  //    me  = 나에게만 삭제(내 화면에서만 사라짐, 다른 사람은 그대로)
  router.post("/:roomId/messages/:messageId/delete", requireRoom, requireMember, async (req, res) => {
    const messageId = String(req.params.messageId);
    const scope = req.body?.scope;
    if (!ID.test(messageId) || (scope !== "all" && scope !== "me")) {
      res.status(400).json({ message: "삭제 방법(모두에게/나에게만)을 골라 주세요." });
      return;
    }
    const roomId = String(req.params.roomId);
    const me = req.chatUser!.id;
    const { rows } = await pool.query(
      `SELECT "id", "userId", "kind", "text", "deletedAt" FROM "chat_messages" WHERE "id" = $1 AND "roomId" = $2`,
      [messageId, roomId]);
    const msg = rows[0];
    if (!msg) { res.status(404).json({ message: "메시지를 찾을 수 없어요." }); return; }
    if (scope === "me") {
      await pool.query(
        `INSERT INTO "chat_message_hides" ("userId", "messageId") VALUES ($1, $2) ON CONFLICT DO NOTHING`, [me, messageId]);
      res.json({ deleted: "me", messageId });
      return;
    }
    if (String(msg.userId) !== me || msg.kind === "system") {
      res.status(403).json({ message: "내가 보낸 메시지만 모두에게서 삭제할 수 있어요." });
      return;
    }
    if (!msg.deletedAt) {
      await pool.query(`UPDATE "chat_messages" SET "deletedAt" = CURRENT_TIMESTAMP, "text" = '' WHERE "id" = $1`, [messageId]);
      if (msg.kind === "image") await removeImage(msg.text);
      hub.broadcastDeleted(roomId, messageId);
    }
    res.json({ deleted: "all", messageId });
  });

  // ── 어디까지 읽었는지 { lastId } → 방 목록의 '새 글' 수와 한 줄 요약에 반영
  router.post("/:roomId/read", requireRoom, requireMember, async (req, res) => {
    const lastId = String(req.body?.lastId ?? "");
    if (!ID.test(lastId)) { res.status(400).json({ message: "메시지 위치를 확인해 주세요." }); return; }
    // 실제 있는 마지막 메시지보다 앞으로는 못 가게 (새 글 수가 영원히 0 이 되는 것 방지)
    await pool.query(
      `UPDATE "chat_members" SET "lastReadId" = GREATEST("lastReadId",
              LEAST($3::bigint, (SELECT COALESCE(MAX("id"), 0) FROM "chat_messages" WHERE "roomId" = $1)))
        WHERE "roomId" = $1 AND "userId" = $2 AND "leftAt" IS NULL`,
      [req.params.roomId, req.chatUser!.id, lastId]);
    res.status(204).send();
  });

  // ── 예약 전송: 만들기 { text, sendAt(ISO) } / 내 예약 목록 / 취소
  router.post("/:roomId/scheduled", requireRoom, requireMember, async (req, res) => {
    const { text, sendAt } = req.body ?? {};
    const when = typeof sendAt === "string" ? Date.parse(sendAt) : NaN;
    if (typeof text !== "string" || !text.trim() || text.trim().length > 1000) {
      res.status(400).json({ message: "예약할 메시지를 1000자 이내로 써 주세요." });
      return;
    }
    if (!Number.isFinite(when) || when < Date.now() + SCHEDULE_MIN_MS || when > Date.now() + SCHEDULE_MAX_MS) {
      res.status(400).json({ message: "예약 시간은 1분 뒤부터 7일 안으로 정해 주세요." });
      return;
    }
    const me = req.chatUser!.id;
    const pending = await pool.query(
      `SELECT COUNT(*)::int AS "n" FROM "chat_scheduled" WHERE "userId" = $1 AND "status" = 'pending'`, [me]);
    if (pending.rows[0].n >= SCHEDULE_MAX_PENDING) {
      res.status(429).json({ message: `예약은 ${SCHEDULE_MAX_PENDING}개까지 할 수 있어요.` });
      return;
    }
    const { rows } = await pool.query(
      `INSERT INTO "chat_scheduled" ("roomId", "userId", "text", "sendAt") VALUES ($1, $2, $3, $4)
       RETURNING "id", "text", "sendAt"`,
      [req.params.roomId, me, text.trim(), new Date(when)]);
    res.status(201).json(scheduledShape(rows[0]));
  });

  router.get("/:roomId/scheduled", requireRoom, requireMember, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT "id", "text", "sendAt" FROM "chat_scheduled"
        WHERE "roomId" = $1 AND "userId" = $2 AND "status" = 'pending' ORDER BY "sendAt"`,
      [req.params.roomId, req.chatUser!.id]);
    res.json(rows.map(scheduledShape));
  });

  router.delete("/:roomId/scheduled/:scheduleId", requireRoom, async (req, res) => {
    const sid = String(req.params.scheduleId);
    if (!ID.test(sid)) { res.status(400).json({ message: "예약을 찾을 수 없어요." }); return; }
    const r = await pool.query(
      `UPDATE "chat_scheduled" SET "status" = 'canceled'
        WHERE "id" = $1 AND "roomId" = $2 AND "userId" = $3 AND "status" = 'pending'`,
      [sid, req.params.roomId, req.chatUser!.id]);
    if (!r.rowCount) { res.status(404).json({ message: "이미 보냈거나 취소된 예약이에요." }); return; }
    res.json({ canceled: true, id: sid });
  });

  // ── 방 위쪽 정보 다시 받기: 방장 이름, 내가 방장인지, 공지, 오늘의 이야깃거리
  router.get("/:roomId/info", requireRoom, requireMember, async (req, res) => {
    res.json(await publicInfo(await service.roomInfo(String(req.params.roomId)), req.chatUser!.id, String(req.params.roomId)));
  });

  // ── 방 공지 (방장만) { notice } — 빈 글이면 공지 내리기
  router.put("/:roomId/notice", requireRoom, requireMember, async (req, res) => {
    const notice = req.body?.notice;
    if (typeof notice !== "string" || notice.trim().length > 200) {
      res.status(400).json({ message: "공지는 200자까지 쓸 수 있어요." });
      return;
    }
    const roomId = String(req.params.roomId);
    const me = req.chatUser!.id;
    const r = await pool.query(
      `UPDATE "chat_rooms" SET "notice" = $3 WHERE "id" = $1 AND "ownerId" = $2`, [roomId, me, notice.trim() || null]);
    if (!r.rowCount) { res.status(403).json({ message: "방장만 공지를 쓸 수 있어요." }); return; }
    // 공지가 바뀌면 참석 답은 새로 받음
    await pool.query(`DELETE FROM "chat_rsvps" WHERE "roomId" = $1`, [roomId]);
    await service.systemMessage(roomId, me, notice.trim() ? "방장이 공지를 새로 올렸어요." : "방장이 공지를 내렸어요.");
    const info = await service.roomInfo(roomId);
    hub.broadcastRoom(roomId, info);
    res.json(await publicInfo(info, me, roomId));
  });

  // ── 방 이름 바꾸기 (방장만, 이웃이 만든 방만) { title }
  router.put("/:roomId/title", requireRoom, requireMember, async (req, res) => {
    const title = req.body?.title;
    if (typeof title !== "string" || !title.trim() || title.trim().length > 100) {
      res.status(400).json({ message: "방 이름은 1~100자로 써 주세요." });
      return;
    }
    const roomId = String(req.params.roomId);
    const me = req.chatUser!.id;
    if (hitLimit(recentRenames, me, 60_000, 5)) { res.status(429).json({ message: "잠시 후 다시 바꿔 주세요." }); return; }
    const r = await pool.query(
      `UPDATE "chat_rooms" SET "title" = $3 WHERE "id" = $1 AND "ownerId" = $2 AND "createdBy" IS NOT NULL
       RETURNING (SELECT "title" FROM "chat_rooms" WHERE "id" = $1) AS "before"`, [roomId, me, title.trim()]);
    if (!r.rowCount) { res.status(403).json({ message: "방장만 방 이름을 바꿀 수 있어요." }); return; }
    if (r.rows[0].before !== title.trim()) {
      await service.systemMessage(roomId, me, `방장이 방 이름을 '${title.trim()}'(으)로 바꿨어요.`);
    }
    const info = await service.roomInfo(roomId);
    hub.broadcastRoom(roomId, info);
    res.json(await publicInfo(info, me, roomId));
  });

  // ── 모임 참석 체크 (공지에 대한 답) { answer: "yes" | "no" | null }
  router.put("/:roomId/rsvp", requireRoom, requireMember, async (req, res) => {
    const answer = req.body?.answer;
    if (answer !== "yes" && answer !== "no" && answer !== null) { res.status(400).json({ message: "갈게요 / 못 가요 중에 골라 주세요." }); return; }
    const roomId = String(req.params.roomId);
    const me = req.chatUser!.id;
    const has = await pool.query(`SELECT 1 FROM "chat_rooms" WHERE "id" = $1 AND "notice" IS NOT NULL`, [roomId]);
    if (!has.rowCount) { res.status(400).json({ message: "공지가 있을 때만 답할 수 있어요." }); return; }
    if (answer === null) await pool.query(`DELETE FROM "chat_rsvps" WHERE "roomId" = $1 AND "userId" = $2`, [roomId, me]);
    else {
      await pool.query(
        `INSERT INTO "chat_rsvps" ("roomId", "userId", "answer") VALUES ($1, $2, $3)
         ON CONFLICT ("roomId", "userId") DO UPDATE SET "answer" = EXCLUDED."answer", "createdAt" = CURRENT_TIMESTAMP`,
        [roomId, me, answer]);
    }
    const info = await service.roomInfo(roomId);
    hub.broadcastRoom(roomId, info);
    res.json(await publicInfo(info, me, roomId));
  });

  // ── 출석 도장: 하루 한 번 인사 (시간에 맞는 인사말을 방에 보냄)
  router.post("/:roomId/checkin", requireRoom, requireMember, async (req, res) => {
    const roomId = String(req.params.roomId);
    const me = req.chatUser!.id;
    if (await service.checkIn(roomId, me)) {
      const h = new Date().getHours();
      const greeting = h < 11 ? "좋은 아침이에요! ☀️ 오늘도 건강한 하루 보내세요."
        : h < 17 ? "안녕하세요! 😊 점심은 맛있게 드셨어요?"
        : "좋은 저녁이에요! 🌙 오늘 하루도 수고 많으셨어요.";
      await service.insertMessage(roomId, me, greeting, "text", `checkin-${new Date().toLocaleDateString("sv-SE")}`);
      const info = await service.roomInfo(roomId);
      hub.broadcastRoom(roomId, info);
      res.status(201).json(await publicInfo(info, me, roomId));
      return;
    }
    res.json(await publicInfo(await service.roomInfo(roomId), me, roomId));
  });

  // ── 공감(하트) { liked: true | false } — 같은 요청을 여러 번 보내도 결과는 같음
  router.post("/:roomId/messages/:messageId/like", requireRoom, requireMember, async (req, res) => {
    const messageId = String(req.params.messageId);
    const liked = req.body?.liked;
    if (!ID.test(messageId) || typeof liked !== "boolean") { res.status(400).json({ message: "공감할 메시지를 확인해 주세요." }); return; }
    const me = req.chatUser!.id;
    if (hitLimit(recentLikes, me, 60_000, 40)) { res.status(429).json({ message: "잠시 후 다시 눌러 주세요." }); return; }
    const roomId = String(req.params.roomId);
    const { rows } = await pool.query(
      `SELECT "id", "kind", "hidden", "deletedAt" FROM "chat_messages" WHERE "id" = $1 AND "roomId" = $2`, [messageId, roomId]);
    const msg = rows[0];
    if (!msg || msg.hidden || BigInt(msg.id) <= BigInt(req.membership!.historyFrom)) {
      res.status(404).json({ message: "메시지를 찾을 수 없어요." });
      return;
    }
    if (msg.kind === "system" || msg.deletedAt) { res.status(400).json({ message: "안내·삭제된 메시지에는 공감할 수 없어요." }); return; }
    const changed = liked
      ? await pool.query(`INSERT INTO "chat_likes" ("messageId", "userId") VALUES ($1, $2) ON CONFLICT DO NOTHING`, [messageId, me])
      : await pool.query(`DELETE FROM "chat_likes" WHERE "messageId" = $1 AND "userId" = $2`, [messageId, me]);
    const count = (await pool.query(`SELECT COUNT(*)::int AS "n" FROM "chat_likes" WHERE "messageId" = $1`, [messageId])).rows[0].n;
    if (changed.rowCount) hub.broadcastLikes(roomId, messageId, count);
    res.json({ messageId, liked, count });
  });

  // ── 채팅방 꾸미기: 내 사진을 배경으로 (사진만 올리고 주소를 돌려줌, 방에 메시지로 보내지 않음)
  router.post(
    "/:roomId/background",
    requireRoom, requireMember,
    (req, res, next) => {
      if (hitLimit(recentBackgrounds, req.chatUser!.id, 10 * 60_000, 10)) {
        res.status(429).json({ message: "배경 사진은 10분에 10번까지 바꿀 수 있어요." });
        return;
      }
      next();
    },
    express.raw({ type: ["image/*", "application/octet-stream"], limit: MAX_IMAGE_BYTES }),
    async (req, res) => {
      const buf = Buffer.isBuffer(req.body) ? req.body : null;
      const ext = buf ? detectImage(buf) : null;
      if (!buf || !ext) { res.status(400).json({ message: "사진(JPG·PNG·WEBP·GIF)만 쓸 수 있어요." }); return; }
      res.status(201).json({ url: await saveImage(buf, ext) });
    },
  );

  // ── 공통: 신고·차단 대상 메시지 (같은 방, 다른 사람의 일반 메시지)
  async function targetMessage(req: Request, res: Response) {
    const id = String(req.body?.messageId ?? "");
    if (!ID.test(id)) { res.status(400).json({ message: "신고할 메시지를 길게 눌러 선택해 주세요." }); return null; }
    const { rows } = await pool.query(
      `SELECT "id", "userId", "hidden", "kind", "deletedAt" FROM "chat_messages" WHERE "id" = $1 AND "roomId" = $2`,
      [id, req.params.roomId],
    );
    // 참여 중인 방에서, 내가 볼 수 있는(다시 들어온 뒤의) 메시지만
    if (!rows[0] || BigInt(rows[0].id) <= BigInt(req.membership!.historyFrom)) { res.status(404).json({ message: "메시지를 찾을 수 없어요." }); return null; }
    if (rows[0].kind === "system" || rows[0].deletedAt) { res.status(400).json({ message: "안내·삭제된 메시지는 신고하거나 차단할 수 없어요." }); return null; }
    if (String(rows[0].userId) === req.chatUser!.id) { res.status(400).json({ message: "내 메시지는 신고하거나 차단할 수 없어요." }); return null; }
    return rows[0] as { id: string; userId: string; hidden: boolean };
  }

  // ── 신고: 사유 저장, 서로 다른 사람 HIDE_THRESHOLD 명 이상이면 자동 숨김
  router.post("/:roomId/report", requireRoom, requireMember, async (req, res) => {
    const reason = req.body?.reason as ReportReason;
    const detail = req.body?.detail;
    if (!Object.prototype.hasOwnProperty.call(REPORT_REASONS, reason)
      || (detail !== undefined && (typeof detail !== "string" || detail.length > 200))) {
      res.status(400).json({ message: "신고 이유를 골라 주세요." });
      return;
    }
    const msg = await targetMessage(req, res);
    if (!msg) return;
    const ins = await pool.query(
      `INSERT INTO "chat_reports" ("messageId", "reporterId", "reason", "detail") VALUES ($1, $2, $3, $4)
       ON CONFLICT ("messageId", "reporterId") DO NOTHING`,
      [msg.id, req.chatUser!.id, reason, detail?.trim() || null],
    );
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS "n" FROM "chat_reports" WHERE "messageId" = $1`, [msg.id]);
    let hidden = msg.hidden;
    if (!hidden && rows[0].n >= HIDE_THRESHOLD) {
      await pool.query(`UPDATE "chat_messages" SET "hidden" = true WHERE "id" = $1`, [msg.id]);
      hidden = true;
      hub.broadcastHidden(String(req.params.roomId), String(msg.id));
    }
    res.json({ reported: true, alreadyReported: ins.rowCount === 0, hidden });
  });

  // ── 차단: 이 메시지를 쓴 사람의 메시지가 나에게 더 이상 보이지 않음 (모든 방)
  router.post("/:roomId/block", requireRoom, requireMember, async (req, res) => {
    const msg = await targetMessage(req, res);
    if (!msg) return;
    await pool.query(
      `INSERT INTO "chat_blocks" ("blockerId", "blockedId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.chatUser!.id, msg.userId],
    );
    res.json({ blocked: true, blockedUserId: String(msg.userId) });
  });

  return router;
}

function scheduledShape(r: { id: string | number; text: string; sendAt: Date | string }) {
  return { id: String(r.id), text: r.text, sendAt: new Date(r.sendAt).toISOString() };
}
