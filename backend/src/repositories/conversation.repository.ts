import { prisma } from "../config/prisma";

export async function createConversation(data: {
  userId: bigint;
  title?: string;
}) {
  return prisma.conversation.create({
    data,
  });
}

export async function findConversationById(id: bigint) {
  return prisma.conversation.findUnique({
    where: {
      id,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}