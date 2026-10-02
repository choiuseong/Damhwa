import { prisma } from "../config/prisma";

export async function createMessage(data: {
  conversationId: bigint;
  role: "elder" | "ai";
  content: string;
}) {
  return prisma.message.create({
    data,
  });
}

export async function findMessagesByConversationId(
  conversationId: bigint,
) {
  return prisma.message.findMany({
    where: {
      conversationId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}