import { Router } from "express";

import {
  createConversation,
  getConversation,
} from "../controllers/conversation.controller";

const router = Router();

router.post("/", createConversation);
router.get("/:conversationId", getConversation);

export default router;