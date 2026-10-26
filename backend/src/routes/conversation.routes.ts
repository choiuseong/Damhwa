import { Router } from "express";

import {
  createConversation,
  getConversation,
  getConversations
} from "../controllers/conversation.controller";

const router = Router();

router.get("/", getConversations);
router.post("/", createConversation);
router.get("/:conversationId", getConversation);

export default router;