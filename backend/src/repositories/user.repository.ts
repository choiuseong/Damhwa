import { prisma } from "../config/prisma";

export async function createUser(data: {
  name?: string;
  phone?: string;
  pushToken?: string;
}) {
  return prisma.user.create({
    data,
  });
}