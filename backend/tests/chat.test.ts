// [변경] 새 파일: 사이버 경로당 자동 테스트
// [변경] 4차: 방 이름 바꾸기, 모임 참석, 출석 도장 테스트
/**
 * 사이버 경로당 백엔드 자동 테스트 (DB 설치 없이 메모리 DB 로 실행)
 *   npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { Pool } from "pg";
import WebSocket from "ws";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createChat } from "../src/chat";
import { createSummary, unsafeSummary } from "../src/chat/summary";

process.env.CHAT_ADMIN_KEY = "test-admin-key-123";
process.env.CHAT_UPLOAD_DIR = mkdtempSync(path.join(tmpdir(), "damhwa-uploads-"));
delete process.env.OPENAI_API_KEY; // 요약은 규칙 기반으로 테스트

let base = "";
let wsBase = "";
let server: Server;
let dbServer: PGLiteSocketServer;
let db: PGlite;
let chat: ReturnType<typeof createChat>;

const A = "device-aaaaaaaaaaaaaaaa";
const B = "device-bbbbbbbbbbbbbbbb";
const C = "device-cccccccccccccccc";
const D = "device-dddddddddddddddd";

async function api(device: string | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(device ? { "X-Device-Id": device } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** WebSocket 으로 방에 들어가고, 받은 이벤트를 모아 둔다 */
/** 방 참여 (REST) */
async function join(device: string, roomId: string) {
  const r = await api(device, "POST", `/rooms/${roomId}/join`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}

async function joinWs(device: string, roomId: string) {
  await join(device, roomId);
  const ws = new WebSocket(`${wsBase}/ws?deviceId=${device}`);
  const events: any[] = [];
  ws.on("message", (raw) => events.push(JSON.parse(String(raw))));
  await new Promise<void>((ok, fail) => { ws.once("open", () => ok()); ws.once("error", fail); });
  ws.send(JSON.stringify({ type: "join", roomId }));
  await waitFor(() => events.some((e) => e.type === "joined"));
  return { ws, events };
}

async function waitFor(cond: () => boolean, ms = 2000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error("시간 초과");
    await new Promise((r) => setTimeout(r, 20));
  }
}

before(async () => {
  db = await PGlite.create();
  dbServer = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1", maxConnections: 20 });
  await dbServer.start();
  const port = Number(String(dbServer.getServerConn()).split(":").pop());
  chat = createChat(new Pool({ connectionString: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`, max: 10 }));
  await chat.ensureSchema();
  await chat.ensureSchema(); // 두 번 실행해도 안전한지
  const app = express();
  app.use(express.json());
  app.use("/rooms", chat.router);
  app.use("/uploads", chat.uploads);
  app.use("/admin/chat", chat.adminRouter);
  server = createServer(app);
  chat.attach(server);
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()));
  const { port: p } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${p}`;
  wsBase = `ws://127.0.0.1:${p}`;
});

after(async () => {
  await chat.close();
  await new Promise((ok) => server.close(ok));
  await dbServer.stop();
  await db.close();
});

test("1. 기기 ID 없으면 거절, 기본 공용 방 3개", async () => {
  assert.equal((await api(null, "GET", "/rooms")).status, 401);
  assert.equal((await api("short", "GET", "/rooms")).status, 401);
  const r = await api(A, "GET", "/rooms");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((x: any) => x.id), ["room-news", "room-town", "room-anyang"]);
});

test("2. 동네 방은 반경 2km 안에서만 보임", async () => {
  const anyang = { lat: 37.394, lng: 126.957 };
  const made = await api(A, "POST", "/rooms", { title: "산책 모임", meets: "", ...anyang });
  assert.equal(made.status, 201);
  assert.equal(made.body.meets, "언제든 편하게");
  const near = await api(B, "GET", `/rooms?lat=37.40&lng=126.96`); // 약 0.7km
  const far = await api(B, "GET", `/rooms?lat=37.5665&lng=126.978`); // 서울시청, 약 19km
  const none = await api(B, "GET", `/rooms`);
  assert.ok(near.body.some((x: any) => x.id === made.body.id));
  assert.ok(!far.body.some((x: any) => x.id === made.body.id));
  assert.ok(!none.body.some((x: any) => x.id === made.body.id));
  assert.equal((await api(A, "POST", "/rooms", { title: "" })).status, 400);
  assert.equal((await api(A, "POST", "/rooms", { title: "x", lat: 999, lng: 1 })).status, 400);
});

test("3. 메시지 저장·재시도 중복 방지·내 메시지 표시", async () => {
  // 참여하지 않으면 읽기·쓰기 불가
  assert.equal((await api(A, "GET", "/rooms/room-news/messages")).status, 403);
  assert.equal((await api(A, "POST", "/rooms/room-news/messages", { text: "x", clientId: "a-0" })).status, 403);
  await join(A, "room-news");
  await join(B, "room-news");
  const first = await api(A, "POST", "/rooms/room-news/messages", { text: "  안녕하세요  ", clientId: "a-1" });
  assert.equal(first.status, 201);
  assert.equal(first.body.text, "안녕하세요");
  assert.equal(first.body.isMine, true);
  assert.equal(first.body.sender, "나");
  const retry = await api(A, "POST", "/rooms/room-news/messages", { text: "안녕하세요", clientId: "a-1" });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.id, first.body.id);
  const list = await api(B, "GET", "/rooms/room-news/messages");
  const texts = list.body.filter((m: any) => m.kind === "text");
  assert.equal(texts.length, 1);
  assert.equal(texts[0].isMine, false);
  assert.match(texts[0].sender, /^이웃 \d+$/);
  // 들어온 안내 메시지
  assert.ok(list.body.some((m: any) => m.kind === "system" && /님이 들어왔어요/.test(m.text)));
  assert.equal((await api(A, "POST", "/rooms/room-news/messages", { text: "", clientId: "a-2" })).status, 400);
  assert.equal((await api(A, "POST", "/rooms/room-news/messages", { text: "x".repeat(1001), clientId: "a-3" })).status, 400);
  assert.equal((await api(A, "POST", "/rooms/nope/messages", { text: "x", clientId: "a-4" })).status, 404);
  const after = await api(B, "GET", `/rooms/room-news/messages?after=${first.body.id}`);
  assert.equal(after.body.filter((m: any) => m.kind === "text").length, 0);
});

test("4. WebSocket: 보내면 같은 방 사람에게 바로 도착, 다른 방엔 안 감", async () => {
  await join(A, "room-town");
  const b = await joinWs(B, "room-town");
  const c = await joinWs(C, "room-anyang");
  const sent = await api(A, "POST", "/rooms/room-town/messages", { text: "실시간 테스트", clientId: "a-ws1" });
  await waitFor(() => b.events.some((e) => e.type === "message" && e.message.kind === "text"));
  const got = b.events.find((e) => e.type === "message" && e.message.kind === "text");
  assert.equal(got.message.id, sent.body.id);
  assert.equal(got.message.isMine, false);
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(!c.events.some((e) => e.type === "message" && e.message.text === "실시간 테스트"));
  // 없는 방 join
  b.ws.send(JSON.stringify({ type: "join", roomId: "nope" }));
  await waitFor(() => b.events.some((e) => e.type === "error"));
  b.ws.close(); c.ws.close();
  // 기기 ID 없는 연결 거절
  const bad = new WebSocket(`${wsBase}/ws`);
  await new Promise<void>((ok) => { bad.once("error", () => ok()); bad.once("close", () => ok()); });
});

test("5. 신고: 사유 필수, 내 메시지 불가, 중복 1회, 3명이면 자동 숨김", async () => {
  await join(A, "room-anyang");
  for (const d of [B, C]) await join(d, "room-anyang");
  const msg = await api(A, "POST", "/rooms/room-anyang/messages", { text: "광고 문자입니다", clientId: "a-r1" });
  const id = msg.body.id;
  const watcher = await joinWs(D, "room-anyang");
  assert.equal((await api(B, "POST", "/rooms/room-anyang/report", { messageId: id })).status, 400);
  assert.equal((await api(B, "POST", "/rooms/room-anyang/report", { messageId: id, reason: "nope" })).status, 400);
  assert.equal((await api(A, "POST", "/rooms/room-anyang/report", { messageId: id, reason: "spam" })).status, 400);
  assert.equal((await api(B, "POST", "/rooms/room-anyang/report", { reason: "spam" })).status, 400);
  assert.equal((await api(B, "POST", "/rooms/room-town/report", { messageId: id, reason: "spam" })).status, 404);
  const r1 = await api(B, "POST", "/rooms/room-anyang/report", { messageId: id, reason: "spam" });
  assert.deepEqual(r1.body, { reported: true, alreadyReported: false, hidden: false });
  const r1b = await api(B, "POST", "/rooms/room-anyang/report", { messageId: id, reason: "abuse" });
  assert.equal(r1b.body.alreadyReported, true);
  assert.equal(r1b.body.hidden, false);
  await api(C, "POST", "/rooms/room-anyang/report", { messageId: id, reason: "scam", detail: "돈 요구" });
  const r3 = await api(D, "POST", "/rooms/room-anyang/report", { messageId: id, reason: "etc" });
  assert.equal(r3.body.hidden, true);
  await waitFor(() => watcher.events.some((e) => e.type === "hidden" && e.messageId === id));
  const list = await api(B, "GET", "/rooms/room-anyang/messages");
  assert.ok(!list.body.some((m: any) => m.id === id));
  // 안내(시스템) 메시지는 신고 불가
  const sys = list.body.find((m: any) => m.kind === "system");
  assert.equal((await api(B, "POST", "/rooms/room-anyang/report", { messageId: sys.id, reason: "spam" })).status, 400);
  watcher.ws.close();
});

test("6. 차단: 차단한 사람에게만 상대 메시지가 안 보이고 실시간도 안 옴", async () => {
  const m = await api(A, "POST", "/rooms/room-town/messages", { text: "차단 전 메시지", clientId: "a-b1" });
  assert.equal((await api(A, "POST", "/rooms/room-town/block", { messageId: m.body.id })).status, 400);
  const blk = await api(B, "POST", "/rooms/room-town/block", { messageId: m.body.id });
  assert.equal(blk.body.blocked, true);
  const forB = await api(B, "GET", "/rooms/room-town/messages");
  assert.ok(!forB.body.some((x: any) => x.text.startsWith("차단 전") || x.text === "실시간 테스트"));
  await join(C, "room-town");
  const forC = await api(C, "GET", "/rooms/room-town/messages");
  assert.ok(forC.body.some((x: any) => x.text === "차단 전 메시지"));
  const b = await joinWs(B, "room-town");
  const c = await joinWs(C, "room-town");
  await api(A, "POST", "/rooms/room-town/messages", { text: "차단 후 메시지", clientId: "a-b2" });
  await waitFor(() => c.events.some((e) => e.type === "message" && e.message.text === "차단 후 메시지"));
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(!b.events.some((e) => e.type === "message" && e.message.text === "차단 후 메시지"));
  // 다른 방에서도 안 보임
  await api(A, "POST", "/rooms/room-news/messages", { text: "다른 방", clientId: "a-b3" });
  const news = await api(B, "GET", "/rooms/room-news/messages");
  assert.ok(!news.body.some((x: any) => x.text === "다른 방"));
  b.ws.close(); c.ws.close();
});

test("7. 도배 방지: 10초에 10개 초과면 429", async () => {
  await join(C, "room-news");
  let last = 0;
  for (let i = 0; i < 11; i++) {
    last = (await api(C, "POST", "/rooms/room-news/messages", { text: `연속 ${i}`, clientId: `c-flood-${i}` })).status;
  }
  assert.equal(last, 429);
});

test("8. 운영자 API: 키 없으면 숨김(404), 키 있으면 신고 목록·숨김 해제", async () => {
  assert.equal((await api(null, "GET", "/admin/chat/reports")).status, 404);
  assert.equal((await api(null, "GET", "/admin/chat/reports", undefined, { "X-Admin-Key": "wrong-key-0000000" })).status, 404);
  const list = await api(null, "GET", "/admin/chat/reports", undefined, { "X-Admin-Key": "test-admin-key-123" });
  assert.equal(list.status, 200);
  assert.equal(list.body[0].reportCount, 3);
  assert.deepEqual(list.body[0].reasons, ["광고·스팸", "사기 의심", "기타"]);
  const id = list.body[0].id;
  const un = await api(null, "PATCH", `/admin/chat/messages/${id}`, { hidden: false }, { "X-Admin-Key": "test-admin-key-123" });
  assert.equal(un.body.hidden, false);
  const back = await api(D, "GET", "/rooms/room-anyang/messages"); // B 는 6번에서 A 를 차단해서 D 로 확인
  assert.ok(back.body.some((m: any) => m.id === id));
});

const E = "device-eeeeeeeeeeeeeeee";
const F = "device-ffffffffffffffff";
const G = "device-gggggggggggggggg";

test("9. 참여·인원 제한·나가기·다시 들어오기", async () => {
  // 인원 제한 검증
  assert.equal((await api(E, "POST", "/rooms", { title: "x", maxMembers: 1 })).status, 400);
  assert.equal((await api(E, "POST", "/rooms", { title: "x", maxMembers: 101 })).status, 400);
  const room = await api(E, "POST", "/rooms", { title: "2인 방", maxMembers: 2 });
  assert.equal(room.status, 201);
  assert.equal(room.body.maxMembers, 2);
  assert.equal(room.body.memberCount, 1); // 만든 사람 자동 참여
  assert.equal(room.body.joined, true);
  const id = room.body.id;
  const watch = await joinWs(E, id); // E 는 이미 참여 중 → 그대로 OK
  const f = await join(F, id);
  assert.equal(f.memberCount, 2);
  await waitFor(() => watch.events.some((e) => e.type === "members" && e.count === 2));
  const full = await api(G, "POST", `/rooms/${id}/join`);
  assert.equal(full.status, 409);
  assert.equal(full.body.code, "ROOM_FULL");
  // 목록에 인원·참여 여부 표시
  const list = await api(G, "GET", "/rooms");
  const row = list.body.find((r: any) => r.id === id);
  assert.deepEqual([row.memberCount, row.maxMembers, row.joined], [2, 2, false]);
  // 참여 안 한 사람은 실시간 입장도 불가
  const ws = new WebSocket(`${wsBase}/ws?deviceId=${G}`);
  const evs: any[] = [];
  ws.on("message", (raw) => evs.push(JSON.parse(String(raw))));
  await new Promise<void>((ok) => ws.once("open", () => ok()));
  ws.send(JSON.stringify({ type: "join", roomId: id }));
  await waitFor(() => evs.some((e) => e.type === "error"));
  // F 대화 후 나가기 → 인원 1, 나간 안내, 예약 취소
  await api(F, "POST", `/rooms/${id}/messages`, { text: "나가기 전 대화", clientId: "f-1" });
  await api(F, "POST", `/rooms/${id}/scheduled`, { text: "나중에", sendAt: new Date(Date.now() + 3600_000).toISOString() });
  const left = await api(F, "POST", `/rooms/${id}/leave`);
  assert.deepEqual(left.body, { left: true, memberCount: 1, closed: false });
  await waitFor(() => watch.events.some((e) => e.type === "members" && e.count === 1));
  await waitFor(() => watch.events.some((e) => e.type === "message" && /님이 나갔어요/.test(e.message.text)));
  assert.equal((await api(F, "GET", `/rooms/${id}/messages`)).status, 403);
  const forE = await api(E, "GET", `/rooms/${id}/messages`);
  assert.ok(forE.body.some((m: any) => m.text === "나가기 전 대화")); // 나간 사람 글은 남음
  // 이제 G 가 들어올 수 있음
  assert.equal((await join(G, id)).memberCount, 2);
  // F 다시 들어오려면 꽉 참 → G 나간 뒤 F 다시 들어오면 이전 대화는 안 보임
  assert.equal((await api(F, "POST", `/rooms/${id}/join`)).status, 409);
  await api(G, "POST", `/rooms/${id}/leave`);
  await join(F, id);
  const forF = await api(F, "GET", `/rooms/${id}/messages`);
  assert.ok(!forF.body.some((m: any) => m.text === "나가기 전 대화"));
  assert.equal((await api(F, "GET", `/rooms/${id}/scheduled`)).body.length, 0); // 예약 취소됨
  ws.close(); watch.ws.close();
});

test("10. 메시지 삭제: 모두에게 / 나에게만", async () => {
  const room = (await api(E, "POST", "/rooms", { title: "삭제 테스트" })).body.id;
  await join(F, room);
  await join(G, room);
  const watch = await joinWs(G, room);
  const m1 = (await api(E, "POST", `/rooms/${room}/messages`, { text: "잘못 보낸 글", clientId: "e-del1" })).body;
  const m2 = (await api(E, "POST", `/rooms/${room}/messages`, { text: "F 만 지울 글", clientId: "e-del2" })).body;
  assert.equal((await api(F, "POST", `/rooms/${room}/messages/${m1.id}/delete`, { scope: "x" })).status, 400);
  // 남의 글을 모두에게 삭제 불가
  assert.equal((await api(F, "POST", `/rooms/${room}/messages/${m1.id}/delete`, { scope: "all" })).status, 403);
  // 나에게만 삭제: F 에게서만 사라짐
  assert.equal((await api(F, "POST", `/rooms/${room}/messages/${m2.id}/delete`, { scope: "me" })).status, 200);
  assert.ok(!(await api(F, "GET", `/rooms/${room}/messages`)).body.some((m: any) => m.id === m2.id));
  assert.ok((await api(G, "GET", `/rooms/${room}/messages`)).body.some((m: any) => m.id === m2.id));
  // 모두에게 삭제: 모두에게 '삭제됨'(내용 없음) + 실시간 알림
  const del = await api(E, "POST", `/rooms/${room}/messages/${m1.id}/delete`, { scope: "all" });
  assert.equal(del.body.deleted, "all");
  await waitFor(() => watch.events.some((e) => e.type === "deleted" && e.messageId === m1.id));
  const forG = (await api(G, "GET", `/rooms/${room}/messages`)).body.find((m: any) => m.id === m1.id);
  assert.deepEqual([forG.deleted, forG.text], [true, ""]);
  // 삭제된 글은 신고 불가
  assert.equal((await api(G, "POST", `/rooms/${room}/report`, { messageId: m1.id, reason: "spam" })).status, 400);
  watch.ws.close();
});

// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("11. 스티커·사진 보내기", async () => {
  const room = (await api(E, "POST", "/rooms", { title: "사진 방" })).body.id;
  assert.equal((await api(E, "POST", `/rooms/${room}/messages`, { text: "👍", kind: "sticker", clientId: "st-1" })).body.kind, "sticker");
  assert.equal((await api(E, "POST", `/rooms/${room}/messages`, { text: "아무거나", kind: "sticker", clientId: "st-2" })).status, 400);
  const up = async (body: Buffer, clientId: string, type = "image/png") =>
    fetch(`${base}/rooms/${room}/images?clientId=${clientId}`, { method: "POST", headers: { "X-Device-Id": E, "Content-Type": type }, body: new Uint8Array(body) });
  const ok = await up(PNG, "img-1");
  assert.equal(ok.status, 201);
  const msg = await ok.json() as any;
  assert.equal(msg.kind, "image");
  assert.match(msg.text, /^\/uploads\/[0-9a-f-]{36}\.png$/);
  const file = await fetch(base + msg.text);
  assert.equal(file.status, 200);
  assert.equal((await up(PNG, "img-1")).status, 200); // 재시도는 같은 메시지
  assert.equal((await up(Buffer.from("<script>alert(1)</script>xxxx"), "img-2")).status, 400); // 사진이 아님
  assert.equal((await up(Buffer.alloc(6 * 1024 * 1024, 1), "img-3")).status, 413); // 5MB 초과
  // 모두에게 삭제하면 파일도 지움
  await api(E, "POST", `/rooms/${room}/messages/${msg.id}/delete`, { scope: "all" });
  assert.ok(!existsSync(path.join(process.env.CHAT_UPLOAD_DIR!, path.basename(msg.text))));
});

test("12. 예약 전송: 시간 검증, 시간이 되면 전송, 취소", async () => {
  // (E 는 방 만들기 제한 1분 3개를 이미 썼으므로 G 가 만들고 E 가 참여)
  const room = (await api(G, "POST", "/rooms", { title: "예약 방" })).body.id;
  await join(E, room);
  const watch = await joinWs(F, room);
  const soon = new Date(Date.now() + 10_000).toISOString();
  assert.equal((await api(E, "POST", `/rooms/${room}/scheduled`, { text: "x", sendAt: soon })).status, 400);
  assert.equal((await api(E, "POST", `/rooms/${room}/scheduled`, { text: "x", sendAt: new Date(Date.now() + 8 * 86400_000).toISOString() })).status, 400);
  const later = new Date(Date.now() + 120_000).toISOString();
  const s1 = (await api(E, "POST", `/rooms/${room}/scheduled`, { text: "내일 아침 9시 산책해요", sendAt: later })).body;
  const s2 = (await api(E, "POST", `/rooms/${room}/scheduled`, { text: "취소할 예약", sendAt: later })).body;
  assert.equal((await api(E, "GET", `/rooms/${room}/scheduled`)).body.length, 2);
  assert.equal((await api(F, "GET", `/rooms/${room}/scheduled`)).body.length, 0); // 남의 예약은 안 보임
  assert.equal((await api(F, "DELETE", `/rooms/${room}/scheduled/${s2.id}`)).status, 404); // 남의 예약 취소 불가
  assert.equal((await api(E, "DELETE", `/rooms/${room}/scheduled/${s2.id}`)).status, 200);
  // 시간이 된 것처럼 만들고 처리기 실행
  await chat.pool.query(`UPDATE "chat_scheduled" SET "sendAt" = $3 WHERE "id" IN ($1, $2)`, [s1.id, s2.id, new Date(Date.now() - 1000)]);
  assert.equal(await chat.scheduler.runDue(), 1);
  assert.equal(await chat.scheduler.runDue(), 0); // 두 번 보내지 않음
  await waitFor(() => watch.events.some((e) => e.type === "message" && e.message.text === "내일 아침 9시 산책해요"));
  const msgs = (await api(F, "GET", `/rooms/${room}/messages`)).body;
  assert.ok(!msgs.some((m: any) => m.text === "취소할 예약"));
  assert.equal((await api(E, "GET", `/rooms/${room}/scheduled`)).body.length, 0);
  watch.ws.close();
});

test("13. 안 읽은 글 수·알림 한 줄 요약·읽음 처리", async () => {
  const room = (await api(G, "POST", "/rooms", { title: "요약 방" })).body.id;
  await join(E, room);
  await join(F, room);
  const before = (await api(F, "GET", "/rooms/summary")).body;
  for (let i = 1; i <= 3; i++) await api(E, "POST", `/rooms/${room}/messages`, { text: `내일 경로당 윷놀이 ${i}`, clientId: `sum-${i}` });
  const rooms = (await api(F, "GET", "/rooms")).body;
  assert.equal(rooms.find((r: any) => r.id === room).unread, 3);
  const sum = (await api(F, "GET", "/rooms/summary")).body;
  assert.equal(sum.source, "rule");
  assert.equal(sum.totalUnread, before.totalUnread + 3);
  assert.match(sum.line, /요약 방에 새 글 3개|새 글/);
  assert.match(sum.line, /윷놀이 3/);
  // 다 읽으면 0
  const last = (await api(F, "GET", `/rooms/${room}/messages`)).body.at(-1).id;
  assert.equal((await api(F, "POST", `/rooms/${room}/read`, { lastId: last })).status, 204);
  assert.equal((await api(F, "GET", "/rooms")).body.find((r: any) => r.id === room).unread, 0);
  // 보낸 사람 자신에게는 새 글로 안 셈
  assert.equal((await api(E, "GET", "/rooms")).body.find((r: any) => r.id === room).unread, 0);
});

test("14. AI 요약이 실패해도(키 오류·네트워크 차단) 규칙 기반 요약으로 대체", async () => {
  process.env.OPENAI_API_KEY = "sk-test-invalid-key";
  try {
    const s = await createSummary(chat.pool).forUser((await chat.pool.query(`SELECT "id" FROM "chat_users" WHERE "deviceId" = $1`, [F])).rows[0].id);
    // F 는 13번에서 다 읽었으므로 새 글이 없거나, 있으면 규칙 요약으로 나와야 함
    assert.ok(s.source === "none" || s.source === "rule");
    const room = (await api(F, "POST", "/rooms", { title: "AI 대체 방" })).body.id;
    await join(G, room);
    await api(F, "POST", `/rooms/${room}/messages`, { text: "AI 테스트 글", clientId: "ai-1" });
    const gid = (await chat.pool.query(`SELECT "id" FROM "chat_users" WHERE "deviceId" = $1`, [G])).rows[0].id;
    const s2 = await createSummary(chat.pool).forUser(String(gid));
    assert.equal(s2.source, "rule");
    assert.match(s2.line, /새 글/);
  } finally {
    delete process.env.OPENAI_API_KEY;
  }
});

test("15. 보안 보강: 참여 안 한 사람 신고·차단 불가, 읽음 위치 상한, 위험한 AI 요약 거르기", async () => {
  const H = "device-hhhhhhhhhhhhhhhh";
  const room = (await api(G, "POST", "/rooms", { title: "보안 방" })).body.id;
  const m = (await api(G, "POST", `/rooms/${room}/messages`, { text: "평범한 글", clientId: "sec-1" })).body;
  assert.equal((await api(H, "POST", `/rooms/${room}/report`, { messageId: m.id, reason: "spam" })).status, 403);
  assert.equal((await api(H, "POST", `/rooms/${room}/block`, { messageId: m.id })).status, 403);
  await join(H, room);
  await api(H, "POST", `/rooms/${room}/read`, { lastId: "999999999999999999" });
  await api(G, "POST", `/rooms/${room}/messages`, { text: "새 글", clientId: "sec-2" });
  assert.equal((await api(H, "GET", "/rooms")).body.find((r: any) => r.id === room).unread, 1); // 상한 덕분에 새 글이 보임
  assert.equal(unsafeSummary("연금 환급 010-1234-5678 로 전화"), true);
  assert.equal(unsafeSummary("https://scam.example 접속"), true);
  assert.equal(unsafeSummary("우리 동네 이야기에서 내일 오후 3시 윷놀이 이야기가 오가요"), false);
});

test("16. 방장: 만든 사람이 방장, 나가면 먼저 들어온 사람에게 넘어감, 마지막 사람이 나가면 방이 닫힘", async () => {
  const O1 = "device-owner1aaaaaaaaaa";
  const O2 = "device-owner2bbbbbbbbbb";
  const O3 = "device-owner3cccccccccc";
  const created = await api(O1, "POST", "/rooms", { title: "방장 테스트 방" });
  assert.equal(created.body.isOwner, true);
  const id = created.body.id;
  const j2 = await join(O2, id);
  assert.equal(j2.isOwner, false);
  assert.ok(j2.topic.length > 0); // 오늘의 이야깃거리
  await join(O3, id);
  const watch = await joinWs(O3, id);
  // 방장만 공지
  assert.equal((await api(O2, "PUT", `/rooms/${id}/notice`, { notice: "몰래 공지" })).status, 403);
  const n = await api(O1, "PUT", `/rooms/${id}/notice`, { notice: "매주 금요일 산책해요" });
  assert.equal(n.status, 200);
  assert.equal(n.body.notice, "매주 금요일 산책해요");
  await waitFor(() => watch.events.some((e) => e.type === "room" && e.info.notice === "매주 금요일 산책해요" && e.info.isOwner === false));
  // 방장 O1 이 나가면 → 먼저 들어온 O2 가 방장
  await api(O1, "POST", `/rooms/${id}/leave`);
  await waitFor(() => watch.events.some((e) => e.type === "message" && /새 방장이 되었어요/.test(e.message.text)));
  assert.equal((await api(O2, "GET", `/rooms/${id}/info`)).body.isOwner, true);
  assert.equal((await api(O3, "GET", `/rooms/${id}/info`)).body.isOwner, false);
  assert.match((await api(O3, "GET", `/rooms/${id}/info`)).body.ownerName, /이웃/);
  // 나간 O1 의 목록에서는 사라지고, 남은 사람 목록에는 있음
  assert.ok(!(await api(O1, "GET", "/rooms")).body.some((r: any) => r.id === id));
  assert.ok((await api(O3, "GET", "/rooms")).body.some((r: any) => r.id === id));
  // 방장 아닌 O3 가 나가면 방장은 그대로
  await api(O3, "POST", `/rooms/${id}/leave`);
  assert.equal((await api(O2, "GET", `/rooms/${id}/info`)).body.isOwner, true);
  // 마지막 O2 가 나가면 방이 닫힘 → 아무 목록에도 없고, 들어올 수도 없음
  const last = await api(O2, "POST", `/rooms/${id}/leave`);
  assert.equal(last.body.closed, true);
  assert.ok(!(await api(D, "GET", "/rooms")).body.some((r: any) => r.id === id));
  const again = await api(O1, "POST", `/rooms/${id}/join`);
  assert.equal(again.status, 404);
  assert.equal(again.body.code, "ROOM_CLOSED");
  // 공용 방은 나가도 목록에 남음 (다시 참여 가능)
  await join(O1, "room-anyang");
  await api(O1, "POST", "/rooms/room-anyang/leave");
  assert.ok((await api(O1, "GET", "/rooms")).body.some((r: any) => r.id === "room-anyang"));
  watch.ws.close();
});

test("17. 공감(하트): 한 사람 한 번, 취소 가능, 실시간 반영, 안내·삭제 메시지는 불가", async () => {
  const L1 = "device-like1aaaaaaaaaaa";
  const L2 = "device-like2bbbbbbbbbbb";
  const id = (await api(L1, "POST", "/rooms", { title: "공감 방" })).body.id;
  const watch = await joinWs(L1, id);
  await join(L2, id);
  const m = (await api(L1, "POST", `/rooms/${id}/messages`, { text: "꽃이 폈어요", clientId: "like-1" })).body;
  assert.equal(m.likeCount, 0);
  assert.equal((await api(L2, "POST", `/rooms/${id}/messages/${m.id}/like`, { liked: "yes" })).status, 400);
  const l = await api(L2, "POST", `/rooms/${id}/messages/${m.id}/like`, { liked: true });
  assert.deepEqual([l.body.liked, l.body.count], [true, 1]);
  await api(L2, "POST", `/rooms/${id}/messages/${m.id}/like`, { liked: true }); // 두 번 눌러도 1
  await waitFor(() => watch.events.some((e) => e.type === "likes" && e.messageId === m.id && e.count === 1));
  const forL2 = (await api(L2, "GET", `/rooms/${id}/messages`)).body.find((x: any) => x.id === m.id);
  assert.deepEqual([forL2.likeCount, forL2.likedByMe], [1, true]);
  const forL1 = (await api(L1, "GET", `/rooms/${id}/messages`)).body.find((x: any) => x.id === m.id);
  assert.deepEqual([forL1.likeCount, forL1.likedByMe], [1, false]);
  assert.equal((await api(L2, "POST", `/rooms/${id}/messages/${m.id}/like`, { liked: false })).body.count, 0);
  const sys = (await api(L1, "GET", `/rooms/${id}/messages`)).body.find((x: any) => x.kind === "system");
  assert.equal((await api(L1, "POST", `/rooms/${id}/messages/${sys.id}/like`, { liked: true })).status, 400);
  // 참여 안 한 사람은 공감 불가
  assert.equal((await api(D, "POST", `/rooms/${id}/messages/${m.id}/like`, { liked: true })).status, 403);
  watch.ws.close();
});

test("18. 배경 사진: 참여자만 올림, 사진만 허용, 방에 메시지가 생기지 않음", async () => {
  const P1 = "device-bg1aaaaaaaaaaaaa";
  const id = (await api(P1, "POST", "/rooms", { title: "배경 방" })).body.id;
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
  const up = async (device: string, body: Buffer) => {
    const res = await fetch(`${base}/rooms/${id}/background`, { method: "POST", headers: { "Content-Type": "image/png", "X-Device-Id": device }, body: new Uint8Array(body) });
    return { status: res.status, body: await res.json() };
  };
  assert.equal((await up(D, png)).status, 403);
  assert.equal((await up(P1, Buffer.from("not an image at all"))).status, 400);
  const ok = await up(P1, png);
  assert.equal(ok.status, 201);
  assert.match(ok.body.url, /^\/uploads\/[0-9a-f-]{36}\.png$/);
  assert.equal((await fetch(base + ok.body.url)).status, 200);
  const msgs = (await api(P1, "GET", `/rooms/${id}/messages`)).body;
  assert.ok(!msgs.some((m: any) => m.kind === "image"));
});

test("19. 방 이름 바꾸기: 방장만, 공용 방은 불가, 실시간 반영", async () => {
  const R1 = "device-rename1aaaaaaaaa";
  const R2 = "device-rename2bbbbbbbbb";
  const id = (await api(R1, "POST", "/rooms", { title: "산책 모임" })).body.id;
  const watch = await joinWs(R2, id);
  assert.equal((await api(R2, "PUT", `/rooms/${id}/title`, { title: "내 맘대로" })).status, 403);
  assert.equal((await api(R1, "PUT", `/rooms/${id}/title`, { title: "   " })).status, 400);
  const ok = await api(R1, "PUT", `/rooms/${id}/title`, { title: "101동 아침 산책" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.title, "101동 아침 산책");
  await waitFor(() => watch.events.some((e) => e.type === "room" && e.info.title === "101동 아침 산책"));
  await waitFor(() => watch.events.some((e) => e.type === "message" && /방 이름을 '101동 아침 산책'/.test(e.message.text)));
  assert.equal((await api(R2, "GET", "/rooms")).body.find((r: any) => r.id === id).title, "101동 아침 산책");
  // 공용 방은 방장이 없어 누구도 못 바꿈
  await join(R1, "room-news");
  assert.equal((await api(R1, "PUT", "/rooms/room-news/title", { title: "바꿈" })).status, 403);
  watch.ws.close();
});

test("20. 모임 참석 체크: 공지가 있어야 답함, 갈게요/못 가요 수·이름, 공지가 바뀌면 초기화", async () => {
  const V1 = "device-rsvp1aaaaaaaaaaa";
  const V2 = "device-rsvp2bbbbbbbbbbb";
  const V3 = "device-rsvp3ccccccccccc";
  const id = (await api(V1, "POST", "/rooms", { title: "윷놀이 모임" })).body.id;
  await join(V2, id);
  const watch = await joinWs(V3, id);
  assert.equal((await api(V2, "PUT", `/rooms/${id}/rsvp`, { answer: "yes" })).status, 400); // 공지 없음
  await api(V1, "PUT", `/rooms/${id}/notice`, { notice: "내일 오후 3시 경로당 윷놀이" });
  assert.equal((await api(V2, "PUT", `/rooms/${id}/rsvp`, { answer: "maybe" })).status, 400);
  const a = await api(V2, "PUT", `/rooms/${id}/rsvp`, { answer: "yes" });
  assert.deepEqual([a.body.rsvpYes, a.body.rsvpNo, a.body.rsvpMine], [1, 0, "yes"]);
  await api(V3, "PUT", `/rooms/${id}/rsvp`, { answer: "no" });
  await api(V3, "PUT", `/rooms/${id}/rsvp`, { answer: "yes" }); // 마음을 바꿈
  const info = (await api(V1, "GET", `/rooms/${id}/info`)).body;
  assert.deepEqual([info.rsvpYes, info.rsvpNo, info.rsvpMine, info.rsvpYesNames.length], [2, 0, null, 2]);
  await waitFor(() => watch.events.some((e) => e.type === "room" && e.info.rsvpYes === 2));
  // 나간 사람의 답은 빠짐
  await api(V2, "POST", `/rooms/${id}/leave`);
  assert.equal((await api(V1, "GET", `/rooms/${id}/info`)).body.rsvpYes, 1);
  // 공지가 바뀌면 다시 받음
  await api(V1, "PUT", `/rooms/${id}/notice`, { notice: "모레로 미뤄요" });
  assert.equal((await api(V3, "GET", `/rooms/${id}/info`)).body.rsvpYes, 0);
  watch.ws.close();
});

test("21. 출석 도장: 하루 한 번 인사 메시지, 오늘 인사한 이웃 수, 연속 출석", async () => {
  const K1 = "device-check1aaaaaaaaaa";
  const K2 = "device-check2bbbbbbbbbb";
  const id = (await api(K1, "POST", "/rooms", { title: "출석 방" })).body.id;
  await join(K2, id);
  const before = (await api(K1, "GET", `/rooms/${id}/info`)).body;
  assert.deepEqual([before.checkedInToday, before.streak, before.checkinCount], [false, 0, 0]);
  const c1 = await api(K1, "POST", `/rooms/${id}/checkin`);
  assert.equal(c1.status, 201);
  assert.deepEqual([c1.body.checkedInToday, c1.body.streak, c1.body.checkinCount], [true, 1, 1]);
  assert.equal((await api(K1, "POST", `/rooms/${id}/checkin`)).status, 200); // 두 번째는 그냥 확인
  const greetings = (await api(K2, "GET", `/rooms/${id}/messages`)).body.filter((m: any) => /좋은 아침|안녕하세요!|좋은 저녁/.test(m.text));
  assert.equal(greetings.length, 1);
  // 어제·그제도 인사했다면 연속 3일
  const uid = (await chat.pool.query(`SELECT "id" FROM "chat_users" WHERE "deviceId" = $1`, [K1])).rows[0].id;
  for (const back of [1, 2, 4]) {
    const d = new Date(); d.setDate(d.getDate() - back);
    await chat.pool.query(`INSERT INTO "chat_checkins" ("roomId", "userId", "day") VALUES ($1, $2, $3::date)`, [id, uid, d.toLocaleDateString("sv-SE")]);
  }
  assert.equal((await api(K1, "GET", `/rooms/${id}/info`)).body.streak, 3);
  assert.equal((await api(K2, "GET", `/rooms/${id}/info`)).body.checkinCount, 1);
  // 참여 안 한 사람은 출석 불가
  assert.equal((await api(D, "POST", `/rooms/${id}/checkin`)).status, 403);
});
