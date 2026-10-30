// [변경] 새 파일: 채팅 모듈 묶음 (라우터·업로드·운영자·WebSocket·예약)
import express, { type ErrorRequestHandler } from "express";
import type { Server } from "node:http";
import type { Pool } from "pg";
import { createChatAdminRouter } from "./admin.routes";
import { createChatRouter } from "./chat.routes";
import { createChatPool, ensureChatSchema } from "./db";
import { createHub } from "./hub";
import { createIdentity } from "./identity";
import { uploadDir } from "./images";
import { createScheduler } from "./scheduler";
import { createChatService } from "./service";

/**
 * 사이버 경로당 모듈 묶음.
 *   app.use("/rooms", chat.router)            방·참여·메시지·사진·삭제·예약·요약·신고·차단 REST
 *   app.use("/uploads", chat.uploads)         보낸 사진 파일
 *   app.use("/admin/chat", chat.adminRouter)  운영자 신고 관리
 *   chat.attach(server)                       /ws 실시간 연결
 *   chat.startScheduler()                     예약 전송 (10초마다)
 */
export function createChat(pool: Pool = createChatPool()) {
  const identity = createIdentity(pool);
  const hub = createHub(pool, identity);
  const service = createChatService(pool, hub);
  const scheduler = createScheduler(pool, service);
  const router = express.Router();
  router.use(createChatRouter(pool, identity, hub, service));
  const adminRouter = createChatAdminRouter(pool, hub);

  // 사진은 무작위 파일명이라 오래 캐시해도 됨. 사진 외 파일은 열지 않음
  const uploads = express.static(uploadDir(), {
    maxAge: "30d",
    immutable: true,
    index: false,
    dotfiles: "deny",
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  });

  // 채팅 API 오류는 내용(메시지 본문 등)을 로그에 남기지 않고 코드만 남김
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const e = err as { name?: string; code?: string; type?: string; status?: number };
    if (e?.type === "entity.parse.failed") { res.status(400).json({ message: "요청 형식이 올바르지 않아요." }); return; }
    if (e?.type === "entity.too.large") { res.status(413).json({ message: "사진이 너무 커요. 5MB 이하로 보내 주세요." }); return; }
    console.error("[chat]", e?.name ?? "Error", e?.code ?? "");
    res.status(500).json({ message: "잠시 문제가 생겼어요. 다시 시도해 주세요." });
  };
  router.use(onError);
  adminRouter.use(onError);

  return {
    pool,
    hub,
    service,
    scheduler,
    router,
    uploads,
    adminRouter,
    ensureSchema: () => ensureChatSchema(pool),
    attach: (server: Server) => hub.attach(server),
    startScheduler: () => scheduler.start(),
    async close() { scheduler.stop(); hub.close(); await pool.end(); },
  };
}
