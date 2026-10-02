import { Router } from "express";

import {
  createMessage,
  getMessages,
} from "../controllers/message.controller";

const router = Router();

router.post("/:conversationId/messages", createMessage);

router.get("/:conversationId/messages", getMessages);

export default router;