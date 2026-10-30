// [변경] 새 파일: 운영자 신고 목록·숨김 해제 (CHAT_ADMIN_KEY)
import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { Pool } from "pg";
import type { ChatHub } from "./hub";
import { MESSAGE_SELECT, REPORT_REASONS } from "./shapes";

/**
 * 운영자용 신고 관리 API (화면 없음, Postman/curl 로 사용)
 * 헤더 X-Admin-Key 가 backend/.env 의 CHAT_ADMIN_KEY 와 같아야 함. 키를 비워 두면 이 API 는 꺼짐.
 */
export function createChatAdminRouter(pool: Pool, hub: ChatHub) {
  const router = Router();

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const key = process.env.CHAT_ADMIN_KEY ?? "";
    const given = req.header("x-admin-key") ?? "";
    const ok = key.length >= 8 && given.length === key.length && timingSafeEqual(Buffer.from(given), Buffer.from(key));
    if (!ok) { res.status(404).json({ message: "Not found" }); return; }
    next();
  }
  router.use(requireAdmin);

  // 신고된 메시지 목록 (신고 많은 순)
  router.get("/reports", async (_req, res) => {
    const { rows } = await pool.query(`
      SELECT m."id", m."roomId", m."text", m."hidden", u."nickname" AS "author",
             COUNT(r."id")::int AS "reportCount",
             ARRAY_AGG(r."reason" ORDER BY r."createdAt") AS "reasons",
             MAX(r."createdAt") AS "lastReportedAt"
        FROM "chat_reports" r
        JOIN "chat_messages" m ON m."id" = r."messageId"
        JOIN "chat_users" u ON u."id" = m."userId"
       GROUP BY m."id", u."nickname"
       ORDER BY "reportCount" DESC, "lastReportedAt" DESC
       LIMIT 200`);
    res.json(rows.map((r) => ({
      ...r,
      id: String(r.id),
      reasons: (r.reasons as string[]).map((k) => REPORT_REASONS[k as keyof typeof REPORT_REASONS] ?? k),
    })));
  });

  // 메시지 숨김/복구 { "hidden": true | false }
  router.patch("/messages/:id", async (req, res) => {
    const id = String(req.params.id);
    if (!/^\d{1,18}$/.test(id) || typeof req.body?.hidden !== "boolean") {
      res.status(400).json({ message: "id 와 hidden(true/false)을 확인해 주세요." });
      return;
    }
    const { rows } = await pool.query(
      `UPDATE "chat_messages" SET "hidden" = $2 WHERE "id" = $1 RETURNING "roomId"`, [id, req.body.hidden]);
    if (!rows[0]) { res.status(404).json({ message: "메시지를 찾을 수 없어요." }); return; }
    if (req.body.hidden) hub.broadcastHidden(rows[0].roomId, id);
    else {
      const msg = await pool.query(`${MESSAGE_SELECT} WHERE m."id" = $1`, [id]);
      await hub.broadcastMessage(rows[0].roomId, msg.rows[0]).catch(() => {});
    }
    res.json({ id, hidden: req.body.hidden });
  });

  return router;
}
