import * as scheduleRepository from "../repositories/schedule.repository";
import { eventBus } from "../events/eventBus";

export async function createSchedule(data: {
  userId: bigint;
  title: string;
  scheduleTime: Date;
  rawMessage?: string;
}) {
  const schedule = await scheduleRepository.createSchedule(data);

  await eventBus.emit("schedule.created", {
    scheduleId: schedule.id,
    userId: schedule.userId,
    title: schedule.title,
    scheduleTime: schedule.scheduleTime,
  });

  return schedule;
}

export async function findSchedulesByUserId(userId: bigint) {
  return scheduleRepository.findSchedulesByUserId(userId);
}

export async function deleteSchedule(
  userId: bigint,
  scheduleId: bigint,
) {
  return scheduleRepository.deleteSchedule(
    userId,
    scheduleId,
  );
}