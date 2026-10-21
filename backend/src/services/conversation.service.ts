import * as conversationRepository from "../repositories/conversation.repository";

export async function createConversation(data: {
  userId: bigint;
  title?: string;
}) {
  return conversationRepository.createConversation(data);
}

export async function findConversationById(id: bigint) {
  return conversationRepository.findConversationById(id);
}