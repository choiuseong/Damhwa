import { Request, Response } from "express";
import * as messageService from "../services/message.service";

export async function createMessage(req: Request, res: Response) {
  try {
    const message = await messageService.createMessage({
      conversationId: BigInt(String(req.params.conversationId)),
      role: req.body.role,
      content: req.body.content,
    });

    res.status(201).json({
      id: message.id.toString(),
      conversationId: message.conversationId.toString(),
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    });
  } catch (error) {
    console.error("메시지 생성 오류:", error);

    res.status(500).json({
      message: "메시지 생성에 실패했습니다.",
    });
  }
}

export async function getMessages(req: Request, res: Response) {
  try {
    const messages =
      await messageService.findMessagesByConversationId(
        BigInt(String(req.params.conversationId)),
      );

    res.json(
      messages.map((message) => ({
        id: message.id.toString(),
        conversationId: message.conversationId.toString(),
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    );
  } catch (error) {
    console.error("메시지 조회 오류:", error);

    res.status(500).json({
      message: "메시지 조회에 실패했습니다.",
    });
  }
}