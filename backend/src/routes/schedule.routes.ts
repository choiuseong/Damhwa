import { Router } from 'express';
import { prisma } from '../config/prisma';
import { ownUser } from '../middleware/session';

const router = Router();
const categories = ['외출/쇼핑', '경로당 방문', '병원', '일정'];
const shape = (s: { id: bigint; title: string; scheduleTime: Date; category: string; place: string | null }) => ({
  id: s.id.toString(), title: s.title, date: s.scheduleTime.toISOString(), category: s.category, place: s.place ?? undefined,
});
router.use('/:userId/schedules', ownUser);
router.get('/:userId/schedules', async (req, res) => {
  const rows = await prisma.schedule.findMany({ where: { userId: req.userId }, orderBy: { scheduleTime: 'asc' } });
  res.json(rows.map(shape));
});
router.post('/:userId/schedules/confirm', async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items) || items.length > 100 || items.some((x) => !x || typeof x.id !== 'string' || !x.id || x.id.length > 100 || typeof x.title !== 'string' || !x.title.trim() || x.title.length > 100 || typeof x.date !== 'string' || !Number.isFinite(Date.parse(x.date)) || !categories.includes(x.category) || (x.place !== undefined && (typeof x.place !== 'string' || x.place.length > 200)))) {
    res.status(400).json({ message: '일정 제목, 날짜, 분류를 확인해주세요.' }); return;
  }
  const rows = await prisma.$transaction(items.map((x) => prisma.schedule.upsert({
    where: { userId_clientId: { userId: req.userId, clientId: x.id } },
    create: { userId: req.userId, clientId: x.id, title: x.title.trim(), scheduleTime: new Date(x.date), category: x.category, place: x.place },
    update: { title: x.title.trim(), scheduleTime: new Date(x.date), category: x.category, place: x.place ?? null },
  })));
  res.json(rows.map(shape));
});
router.delete('/:userId/schedules/:scheduleId', async (req, res) => {
  const id = String(req.params.scheduleId);
  if (!/^\d+$/.test(id)) { res.status(400).json({ message: '서버에 저장된 일정 ID가 필요합니다.' }); return; }
  const result = await prisma.schedule.deleteMany({ where: { id: BigInt(id), userId: req.userId } });
  if (!result.count) { res.status(404).json({ message: '일정을 찾을 수 없습니다.' }); return; }
  res.status(204).send();
});
export default router;
