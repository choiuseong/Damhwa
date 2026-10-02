export type ScheduleCreatedEvent = {
  scheduleId: bigint;
  userId: bigint;
  title: string;
  scheduleTime: Date;
};