import { Router } from "express";
import {
  createSchedule,
  getSchedules,
  deleteSchedule,
} from "../controllers/schedule.controller";

const router = Router();

router.post("/:userId/schedules", createSchedule);
router.get("/:userId/schedules", getSchedules);
router.delete("/:userId/schedules/:scheduleId", deleteSchedule);

export default router;