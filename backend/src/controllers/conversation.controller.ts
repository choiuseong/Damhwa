import { Request, Response } from "express";
import * as conversationService from "../services/conversation.service";

export async function createConversation(req: Request, res: Response) {
  try {
    const conversation =
      await conversationService.createConversation({
        userId: BigInt(req.body.userId),
        title: req.body.title,
      });

    res.status(201).json({
      id: conversation.id.toString(),
      userId: conversation.userId.toString(),
      title: conversation.title,
      startedAt: conversation.startedAt,
      endedAt: conversation.endedAt,
    });
  } catch (error) {
    console.error("대화 생성 오류:", error);

    res.status(500).json({
      message: "대화 생성에 실패했습니다.",
    });
  }
}

export async function getConversation(req: Request, res: Response) {
  try {
    const conversation =
      await conversationService.findConversationById(
        BigInt(String(req.params.conversationId)),
      );

    if (!conversation) {
      res.status(404).json({
        message: "대화를 찾을 수 없습니다.",
      });
      return;
    }

    res.json({
      id: conversation.id.toString(),
      userId: conversation.userId.toString(),
      title: conversation.title,
      startedAt: conversation.startedAt,
      endedAt: conversation.endedAt,
      messages: conversation.messages.map((message) => ({
        id: message.id.toString(),
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    });
  } catch (error) {
    console.error("대화 조회 오류:", error);

    res.status(500).json({
      message: "대화 조회에 실패했습니다.",
    });
  }
}