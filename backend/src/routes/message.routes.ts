import { Router } from "express";

import {
  createMessage,
  getMessages,
} from "../controllers/message.controller";

import { ownConversation } from '../middleware/session';

const router = Router();
router.use('/:conversationId', ownConversation);

router.post("/:conversationId/messages", createMessage);

router.get("/:conversationId/messages", getMessages);

export default router;