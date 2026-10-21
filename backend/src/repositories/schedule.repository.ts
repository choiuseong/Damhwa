import { prisma } from "../config/prisma";

export async function createSchedule(data: {
  userId: bigint;
  title: string;
  scheduleTime: Date;
  rawMessage?: string;
}) {
  return prisma.schedule.create({
    data,
  });
}

export async function findSchedulesByUserId(userId: bigint) {
  return prisma.schedule.findMany({
    where: {
      userId,
    },
    orderBy: {
      scheduleTime: "asc",
    },
  });
}

export async function deleteSchedule(
  userId: bigint,
  scheduleId: bigint,
) {
  return prisma.schedule.deleteMany({
    where: {
      id: scheduleId,
      userId,
    },
  });
}