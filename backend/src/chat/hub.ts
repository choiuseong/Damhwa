// [변경] 새 파일: WebSocket 실시간 전달 (메시지·숨김·삭제·인원·나감)
// [변경] 3차: 공감 수(likes), 방장·공지(room) 이벤트
// [변경] 4차: room 이벤트에 방 이름·참석·출석 수
import type { IncomingMessage, Server } from "node:http";
import type { Pool } from "pg";
import { WebSocket, WebSocketServer } from "ws";
import { isValidDeviceId, type createIdentity } from "./identity";
import { messageShape, type MessageRow } from "./shapes";

/**
 * 실시간 채팅 (WebSocket)
 *
 * 연결: ws://<서버>/ws?deviceId=<기기ID>
 * 앱 → 서버: {"type":"join","roomId":"room-town"} / {"type":"leave"} / {"type":"ping"}
 * 서버 → 앱: {"type":"joined","roomId"} / {"type":"message","roomId","message"} /
 *            {"type":"hidden","roomId","messageId"}   신고 누적으로 숨김
 *            {"type":"deleted","roomId","messageId"}  보낸 사람이 '모두에게 삭제'
 *            {"type":"members","roomId","count"}      참여 인원 변경
 *            {"type":"kicked","roomId"}               (다른 창에서) 방을 나감
 *            {"type":"likes","roomId","messageId","count"}  공감(하트) 수 변경
 *            {"type":"room","roomId","info"}          방 이름·방장·공지·참석 답·출석 수 변경 (info.isOwner 는 받는 사람 기준)
 *            {"type":"pong"} / {"type":"error","message"}
 * 방에 참여(REST POST /rooms/:id/join)한 사람만 join 할 수 있음
 *
 * 메시지 보내기는 REST(POST /rooms/:id/messages)로 하고, 저장이 끝나면 여기서 같은 방 사람들에게 즉시 전달한다.
 * (저장·검증·중복 방지를 한 곳에서 처리하고, WebSocket 이 끊겨도 REST 로 계속 동작하게 하기 위함)
 */

interface Client {
  ws: WebSocket;
  userId: string;
  roomId: string | null;
  alive: boolean;
}

export type ChatHub = ReturnType<typeof createHub>;

export function createHub(pool: Pool, identity: ReturnType<typeof createIdentity>) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });
  const clients = new Set<Client>();

  /** 방에 참여 중인 사람인지 (방이 없으면 false) */
  async function isActiveMember(roomId: unknown, userId: string): Promise<boolean> {
    if (typeof roomId !== "string" || roomId.length > 64) return false;
    const { rowCount } = await pool.query(
      `SELECT 1 FROM "chat_members" WHERE "roomId" = $1 AND "userId" = $2 AND "leftAt" IS NULL`, [roomId, userId]);
    return !!rowCount;
  }

  function send(ws: WebSocket, data: unknown) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  }

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, userId: string) => {
    const client: Client = { ws, userId, roomId: null, alive: true };
    clients.add(client);
    ws.on("pong", () => { client.alive = true; });
    ws.on("close", () => clients.delete(client));
    ws.on("error", () => clients.delete(client));
    ws.on("message", async (raw) => {
      let msg: { type?: string; roomId?: unknown };
      try { msg = JSON.parse(String(raw)); } catch { send(ws, { type: "error", message: "잘못된 요청" }); return; }
      if (msg.type === "ping") { send(ws, { type: "pong" }); return; }
      if (msg.type === "leave") { client.roomId = null; return; }
      if (msg.type === "join") {
        try {
          if (!(await isActiveMember(msg.roomId, client.userId))) {
            send(ws, { type: "error", message: "채팅방에 먼저 들어와 주세요." });
            ws.close(4403, "not member");
            return;
          }
          client.roomId = msg.roomId as string;
          send(ws, { type: "joined", roomId: client.roomId });
        } catch {
          // 방에 못 들어간 채 열려 있지 않도록 닫음 → 앱이 다시 연결하고 그동안 3초 확인으로 동작
          send(ws, { type: "error", message: "잠시 후 다시 시도해 주세요." });
          ws.close(1011, "retry");
        }
      }
    });
  });

  // 30초마다 응답 없는 연결 정리 (휴대폰이 잠들거나 네트워크가 끊긴 경우)
  const heartbeat = setInterval(() => {
    for (const c of clients) {
      if (!c.alive) { c.ws.terminate(); clients.delete(c); continue; }
      c.alive = false;
      try { c.ws.ping(); } catch { /* ignore */ }
    }
  }, 30_000);
  heartbeat.unref();

  /** http 서버에 /ws 경로 연결 */
  function attach(server: Server) {
    server.on("upgrade", async (req, socket, head) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== "/ws") { socket.destroy(); return; }
      const deviceId = url.searchParams.get("deviceId");
      if (!isValidDeviceId(deviceId)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      try {
        const user = await identity.resolve(deviceId);
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req, user.id));
      } catch {
        socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
        socket.destroy();
      }
    });
  }

  /** 새 메시지를 같은 방 사람들에게 전달. 보낸 사람을 차단한 사람에게는 보내지 않음 */
  async function broadcastMessage(roomId: string, row: MessageRow) {
    const targets = [...clients].filter((c) => c.roomId === roomId);
    if (!targets.length) return;
    const { rows } = await pool.query(`SELECT "blockerId" FROM "chat_blocks" WHERE "blockedId" = $1`, [row.userId]);
    const blockers = new Set(rows.map((r) => String(r.blockerId)));
    for (const c of targets) {
      if (blockers.has(c.userId)) continue;
      send(c.ws, { type: "message", roomId, message: messageShape(row, c.userId) });
    }
  }

  /** 신고 누적으로 숨겨진 메시지를 화면에서 지우도록 알림 */
  function broadcastHidden(roomId: string, messageId: string) {
    for (const c of clients) if (c.roomId === roomId) send(c.ws, { type: "hidden", roomId, messageId });
  }

  /** '모두에게 삭제' → 화면에서 '삭제된 메시지예요'로 바꾸도록 알림 */
  function broadcastDeleted(roomId: string, messageId: string) {
    for (const c of clients) if (c.roomId === roomId) send(c.ws, { type: "deleted", roomId, messageId });
  }

  /** 참여 인원 변경 알림 */
  function broadcastMembers(roomId: string, count: number) {
    for (const c of clients) if (c.roomId === roomId) send(c.ws, { type: "members", roomId, count });
  }

  /** 공감(하트) 수 변경 */
  function broadcastLikes(roomId: string, messageId: string, count: number) {
    for (const c of clients) if (c.roomId === roomId) send(c.ws, { type: "likes", roomId, messageId, count });
  }

  /** 방장·공지가 바뀜 → 방 위쪽 안내를 새로 그리도록 (방장 여부는 사람마다 다름) */
  function broadcastRoom(roomId: string, info: { ownerId: string | null } & Record<string, unknown>) {
    const { ownerId, ...rest } = info;
    for (const c of clients) {
      if (c.roomId === roomId) send(c.ws, { type: "room", roomId, info: { ...rest, isOwner: ownerId !== null && ownerId === c.userId } });
    }
  }

  /** 방을 나간 사람의 실시간 연결을 그 방에서 뺌 (나간 뒤 메시지를 받지 않게) */
  function kick(roomId: string, userId: string) {
    for (const c of clients) {
      if (c.roomId === roomId && c.userId === userId) {
        c.roomId = null;
        send(c.ws, { type: "kicked", roomId }); // 같은 사람이 다른 창에서 보고 있었다면 알림
      }
    }
  }

  function close() {
    clearInterval(heartbeat);
    for (const c of clients) c.ws.terminate();
    wss.close();
  }

  return { attach, broadcastMessage, broadcastHidden, broadcastDeleted, broadcastMembers, broadcastLikes, broadcastRoom, kick, close, clientCount: () => clients.size };
}
