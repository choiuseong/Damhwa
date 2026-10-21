import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
const router = Router();
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const roomShape = (r: any) => ({ id: r.id, title: r.title, meets: r.meets, icon: 'chatbubbles', featured: r.id === 'room-news' });
const messageShape = (r: any, userId: bigint) => ({ id: String(r.id), text: r.text, sender: String(r.userId) === String(userId) ? '나' : (r.name || '이웃'), isMine: String(r.userId) === String(userId), createdAt: new Date(r.createdAt).toISOString() });
function coords(lat: unknown, lng: unknown) {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
router.get('/', async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const located = req.query.lat !== undefined && req.query.lng !== undefined && coords(lat, lng);
  const { rows } = await db.query('SELECT * FROM chat_rooms ORDER BY "createdAt", id');
  const filtered = rows.filter((r) => {
    if (r.lat === null || r.lng === null) return true; // shared community rooms
    if (!located) return false;
    const rad = Math.PI / 180;
    const a = Math.sin((r.lat - lat) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(r.lat * rad) * Math.sin((r.lng - lng) * rad / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a))) <= 2;
  });
  res.json(filtered.map(roomShape));
});
router.post('/', async (req, res) => {
  const { title, meets, lat, lng } = req.body;
  if (typeof title !== 'string' || !title.trim() || title.length > 100 || typeof meets !== 'string' || meets.length > 100 || ((lat !== undefined || lng !== undefined) && !coords(lat, lng))) { res.status(400).json({ message: '채팅방 이름과 위치를 확인해주세요.' }); return; }
  const { rows } = await db.query('INSERT INTO chat_rooms (id, title, meets, lat, lng) VALUES ($1,$2,$3,$4,$5) RETURNING *', [randomUUID(), title.trim(), meets.trim() || '언제든 편하게', lat ?? null, lng ?? null]);
  res.status(201).json(roomShape(rows[0]));
});
router.use('/:roomId', async (req, res, next) => {
  const { rowCount } = await db.query('SELECT 1 FROM chat_rooms WHERE id=$1', [req.params.roomId]);
  if (!rowCount) { res.status(404).json({ message: '채팅방을 찾을 수 없습니다.' }); return; }
  next();
});
router.get('/:roomId/messages', async (req, res) => {
  const after = req.query.after === undefined ? '0' : String(req.query.after);
  if (!/^\d+$/.test(after)) { res.status(400).json({ message: '메시지 위치를 확인해주세요.' }); return; }
  const { rows } = await db.query(`SELECT m.*, u.name FROM chat_messages m JOIN users u ON u.id=m."userId"
    WHERE m."roomId"=$1 AND m.id > $2 AND NOT EXISTS
    (SELECT 1 FROM chat_blocks b WHERE b."userId"=$3 AND b."blockedId"=m."userId") ORDER BY m.id ASC LIMIT 200`, [req.params.roomId, after, String(req.userId)]);
  res.json(rows.map((r) => messageShape(r, req.userId)));
});
router.post('/:roomId/messages', async (req, res) => {
  const { text, clientId } = req.body;
  if (typeof text !== 'string' || !text.trim() || text.length > 4000 || typeof clientId !== 'string' || !clientId || clientId.length > 100) { res.status(400).json({ message: '메시지를 확인해주세요.' }); return; }
  const { rows } = await db.query(`INSERT INTO chat_messages ("roomId", "userId", text, "clientId") VALUES ($1,$2,$3,$4)
    ON CONFLICT ("roomId", "userId", "clientId") DO UPDATE SET "clientId"=EXCLUDED."clientId" RETURNING *`, [req.params.roomId, String(req.userId), text.trim(), clientId]);
  res.status(201).json(messageShape(rows[0], req.userId));
});
for (const kind of ['report', 'block'] as const) {
  router.post(`/:roomId/${kind}`, async (req, res) => {
    const id = String(req.body.messageId ?? '');
    if (!/^\d+$/.test(id)) { res.status(400).json({ message: '상대방의 메시지를 길게 눌러 선택해주세요.' }); return; }
    const { rows } = await db.query('SELECT * FROM chat_messages WHERE id=$1 AND "roomId"=$2 AND "userId"<>$3', [id, req.params.roomId, String(req.userId)]);
    if (!rows[0]) { res.status(404).json({ message: '대상 메시지를 찾을 수 없습니다.' }); return; }
    if (kind === 'report') await db.query('INSERT INTO chat_reports ("reporterId", "messageId") VALUES ($1,$2)', [String(req.userId), id]);
    else await db.query('INSERT INTO chat_blocks ("userId", "blockedId") VALUES ($1,$2) ON CONFLICT DO NOTHING', [String(req.userId), rows[0].userId]);
    res.status(204).send();
  });
}
export default router;
export async function closeChatPool() { await db.end(); }
