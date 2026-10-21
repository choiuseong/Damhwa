import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

declare global { namespace Express { interface Request { userId: bigint } } }
export async function requireSession(req: Request, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer /, '');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) { res.status(401).json({ message: '앱 사용자 등록이 필요합니다.' }); return; }
  const user = await prisma.user.findUnique({ where: { sessionToken: token } });
  if (!user) { res.status(401).json({ message: '사용자 등록 정보를 확인해주세요.' }); return; }
  req.userId = user.id;
  next();
}
export async function ownConversation(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.conversationId);
  if (!/^\d+$/.test(id)) { res.status(400).json({ message: '올바른 대화 ID가 필요합니다.' }); return; }
  const row = await prisma.conversation.findFirst({ where: { id: BigInt(id), userId: req.userId } });
  if (!row) { res.status(404).json({ message: '대화를 찾을 수 없습니다.' }); return; }
  next();
}
export function ownUser(req: Request, res: Response, next: NextFunction) {
  if (String(req.params.userId) !== req.userId.toString()) { res.status(403).json({ message: '다른 사용자의 정보에는 접근할 수 없습니다.' }); return; }
  next();
}
