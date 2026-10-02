import * as messageRepository from "../repositories/message.repository";

export async function createMessage(data: {
  conversationId: bigint;
  role: "elder" | "ai";
  content: string;
}) {
  return messageRepository.createMessage(data);
}

export async function findMessagesByConversationId(
  conversationId: bigint,
) {
  return messageRepository.findMessagesByConversationId(
    conversationId,
  );
}