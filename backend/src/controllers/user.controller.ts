import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { prisma } from '../config/prisma';

export async function createUser(req: Request, res: Response) {
  const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 50) : '이웃';
  const sessionToken = randomBytes(32).toString('hex');
  const user = await prisma.user.create({ data: { name, sessionToken } });
  res.status(201).json({ id: user.id.toString(), sessionToken });
}
