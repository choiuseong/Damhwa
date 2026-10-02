import { Request, Response } from "express";
import * as userService from "../services/user.service";

export async function createUser(req: Request, res: Response) {
  try {
    const user = await userService.createUser({
      name: req.body.name,
      phone: req.body.phone,
      pushToken: req.body.pushToken,
    });

    res.status(201).json({
      id: user.id.toString(),
      name: user.name,
      phone: user.phone,
      pushToken: user.pushToken,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("사용자 생성 오류:", error);

    res.status(500).json({
      message: "사용자 생성에 실패했습니다.",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}