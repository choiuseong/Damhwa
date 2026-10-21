import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSchedules, extractTime, extractDay } from '../../frontend/src/lib/scheduleParser';

test('오전/오후 12시와 유효하지 않은 시각', () => {
  assert.deepEqual(extractTime('오전 12시'), { h: 0, m: 0 });
  assert.deepEqual(extractTime('오후 12시'), { h: 12, m: 0 });
  assert.equal(extractTime('오후 3시 70분'), null);
  assert.equal(extractTime('25시'), null);
  assert.equal(extractTime('오후 13시'), null);
});
test('존재하지 않는 날짜 거부', () => {
  assert.equal(extractDay('2월 31일', new Date(2026, 0, 1)), null);
  assert.equal(extractDay('4월 31일', new Date(2026, 0, 1)), null);
});
test('취소·부정·과거 언급 제외, 불명확한 시간은 확인 요구', () => {
  const now = new Date(2026, 9, 20, 9);
  assert.equal(parseSchedules('내일 병원 안 가', now).length, 0);
  assert.equal(parseSchedules('어제 병원 갔어요', now).length, 0);
  assert.equal(parseSchedules('내일 치과 취소', now).length, 0);
  assert.equal(parseSchedules('내일 오후 3시 70분 병원', now).length, 0);
  assert.equal(parseSchedules('내일 병원', now)[0].needsConfirmation, true);
  assert.equal(parseSchedules('내일 오후 3시 병원', now)[0].needsConfirmation, false);
});

test('격리 DB: 사용자·대화·일정·채팅·신고·차단 API', { timeout: 60000 }, async (t) => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const db = await PGlite.create();
  for (const path of ['prisma/migrations/20260923060835_init/migration.sql', 'prisma/migrations/20261020020000_demo_fixes/migration.sql']) {
    await db.exec(readFileSync(path, 'utf8'));
  }
  const socket = new PGLiteSocketServer({ db, port: 0, maxConnections: 20 });
  await socket.start();
  const conn = socket.getServerConn();
  process.env.DATABASE_URL = `postgresql://postgres:postgres@${conn}/postgres`;
  const { default: app } = await import('../src/app');
  const { prisma } = await import('../src/config/prisma');
  const { closeChatPool } = await import('../src/routes/chat.routes');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const call = async (path: string, token?: string, method = 'GET', body?: unknown) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };
  try {
    const a = (await call('/users', undefined, 'POST', {})).body;
    const b = (await call('/users', undefined, 'POST', {})).body;
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.sessionToken, b.sessionToken);
    await t.test('인증 및 사용자 소유권', async () => {
      assert.equal((await call('/rooms')).status, 401);
      assert.equal((await call(`/users/${b.id}/schedules`, a.sessionToken)).status, 403);
    });
    const c = await call('/conversations', a.sessionToken, 'POST', { userId: b.id });
    assert.equal(c.status, 201);
    assert.equal(c.body.userId, a.id);
    await t.test('대화 접근 및 메시지 중복 방지', async () => {
      assert.equal((await call(`/conversations/${c.body.id}`, b.sessionToken)).status, 404);
      const path = `/conversations/${c.body.id}/messages`;
      const item = { role: 'elder', content: '내일 오후 3시 병원 가요', clientId: 'turn-0' };
      const one = await call(path, a.sessionToken, 'POST', item);
      const two = await call(path, a.sessionToken, 'POST', item);
      assert.equal(one.status, 201);
      assert.equal(one.body.id, two.body.id);
      assert.equal((await call(path, a.sessionToken)).body.length, 1);
      assert.equal((await call(path, a.sessionToken, 'POST', { role: 'wrong' })).status, 400);
    });
    await t.test('일정 저장·조회·삭제와 재시도', async () => {
      const path = `/users/${a.id}/schedules`;
      const item = { id: 'local-1', title: '치과', category: '병원', place: '치과', date: '2030-10-20T06:00:00.000Z' };
      const first = await call(path + '/confirm', a.sessionToken, 'POST', { items: [item] });
      assert.equal(first.status, 200);
      assert.match(first.body[0].id, /^\d+$/);
      const again = await call(path + '/confirm', a.sessionToken, 'POST', { items: [item] });
      assert.equal(first.body[0].id, again.body[0].id);
      assert.equal((await call(path, a.sessionToken)).body.length, 1);
      assert.equal((await call(path + '/confirm', a.sessionToken, 'POST', { items: [{ ...item, date: 'wrong' }] })).status, 400);
      assert.equal((await call(path + '/' + first.body[0].id, a.sessionToken, 'DELETE')).status, 204);
      assert.equal((await call(path, a.sessionToken)).body.length, 0);
    });
    const rooms = await call('/rooms', a.sessionToken);
    assert.equal(rooms.status, 200);
    assert.equal(rooms.body.length, 3);
    const created = await call('/rooms', a.sessionToken, 'POST', { title: '테스트 방', meets: '언제든' });
    assert.equal(created.status, 201);
    const roomId = created.body.id;
    await t.test('다른 사용자의 방 조회와 양방향 메시지', async () => {
      assert.ok((await call('/rooms', b.sessionToken)).body.some((r: any) => r.id === roomId));
      const path = `/rooms/${roomId}/messages`;
      const sent = await call(path, a.sessionToken, 'POST', { text: '안녕하세요', clientId: 'message-1' });
      assert.equal(sent.status, 201);
      const repeat = await call(path, a.sessionToken, 'POST', { text: '안녕하세요', clientId: 'message-1' });
      assert.equal(repeat.body.id, sent.body.id);
      const received = await call(path, b.sessionToken);
      assert.equal(received.body.length, 1);
      assert.equal(received.body[0].isMine, false);
      assert.equal((await call(path, a.sessionToken)).body[0].isMine, true);
      assert.equal((await call(path + '?after=' + sent.body.id, b.sessionToken)).body.length, 0);
      const reply = await call(path, b.sessionToken, 'POST', { text: '반가워요', clientId: 'message-2' });
      assert.equal((await call(path + '?after=' + sent.body.id, a.sessionToken)).body[0].id, reply.body.id);
      assert.equal((await call(`/rooms/${roomId}/report`, a.sessionToken, 'POST', { messageId: reply.body.id })).status, 204);
      assert.equal((await call(`/rooms/${roomId}/block`, a.sessionToken, 'POST', { messageId: reply.body.id })).status, 204);
      assert.equal((await call(path, a.sessionToken)).body.length, 1);
      assert.equal((await db.query('SELECT * FROM chat_reports')).rows.length, 1);
    });
    await t.test('위치 반경 필터 및 푸시 토큰 등록', async () => {
      await call('/rooms', a.sessionToken, 'POST', { title: '서울 방', meets: '', lat: 37.5665, lng: 126.978 });
      const near = await call('/rooms?lat=37.5665&lng=126.978', b.sessionToken);
      assert.ok(near.body.some((r: any) => r.title === '서울 방'));
      const far = await call('/rooms?lat=35&lng=129', b.sessionToken);
      assert.ok(!far.body.some((r: any) => r.title === '서울 방'));
      assert.equal((await call('/devices', a.sessionToken, 'POST', { expoPushToken: 'test-token' })).status, 204);
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
    await closeChatPool();
    await socket.stop();
    await db.close();
  }
});
