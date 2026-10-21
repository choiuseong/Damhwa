import { prisma } from "../config/prisma";

export async function createMessage(data: {
  conversationId: bigint;
  role: "elder" | "ai";
  content: string;
  clientId: string;
}) {
  return prisma.message.upsert({
    where: { conversationId_clientId: { conversationId: data.conversationId, clientId: data.clientId } },
    create: data, update: {},
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