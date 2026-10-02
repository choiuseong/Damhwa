import { Request, Response } from "express";
import * as scheduleService from "../services/schedule.service";

export async function createSchedule(req: Request, res: Response) {
  try {
    const schedule = await scheduleService.createSchedule({
      userId: BigInt(String(req.params.userId)),
      title: req.body.title,
      scheduleTime: new Date(req.body.scheduleTime),
      rawMessage: req.body.rawMessage,
    });

    res.status(201).json({
      id: schedule.id.toString(),
      userId: schedule.userId.toString(),
      title: schedule.title,
      scheduleTime: schedule.scheduleTime,
      rawMessage: schedule.rawMessage,
      notified: schedule.notified,
      createdAt: schedule.createdAt,
    });
  } catch (error) {
    console.error("일정 생성 오류:", error);

    res.status(500).json({
      message: "일정 생성에 실패했습니다.",
    });
  }
}

export async function getSchedules(req: Request, res: Response) {
  try {
    const schedules = await scheduleService.findSchedulesByUserId(
      BigInt(String(req.params.userId)),
    );

    res.json(
      schedules.map((schedule) => ({
        id: schedule.id.toString(),
        userId: schedule.userId.toString(),
        title: schedule.title,
        scheduleTime: schedule.scheduleTime,
        rawMessage: schedule.rawMessage,
        notified: schedule.notified,
        createdAt: schedule.createdAt,
      })),
    );
  } catch (error) {
    console.error("일정 조회 오류:", error);

    res.status(500).json({
      message: "일정 조회에 실패했습니다.",
    });
  }
}

export async function deleteSchedule(req: Request, res: Response) {
  try {
    const result = await scheduleService.deleteSchedule(
      BigInt(String(req.params.userId)),
      BigInt(String(req.params.scheduleId)),
    );

    if (result.count === 0) {
      res.status(404).json({
        message: "일정을 찾을 수 없습니다.",
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("일정 삭제 오류:", error);

    res.status(500).json({
      message: "일정 삭제에 실패했습니다.",
    });
  }
}