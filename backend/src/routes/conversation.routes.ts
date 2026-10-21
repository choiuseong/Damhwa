import { Router } from "express";

import {
  createConversation,
  getConversation,
} from "../controllers/conversation.controller";

import { ownConversation } from '../middleware/session';

const router = Router();
router.use('/:conversationId', ownConversation);

router.post("/", createConversation);
router.get("/:conversationId", getConversation);

export default router;