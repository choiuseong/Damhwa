import { eventBus } from "./eventBus";
import type { ScheduleCreatedEvent } from "./schedule.events";

eventBus.on<ScheduleCreatedEvent>(
  "schedule.created",
  async (schedule) => {
    console.log(
      `[Event] schedule.created: ${schedule.scheduleId.toString()}`,
    );
  },
);