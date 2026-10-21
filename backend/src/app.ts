import { logError } from "./lib/logError";
import express, { type ErrorRequestHandler } from "express";
import { requireSession } from "./middleware/session";
import chatRoutes from "./routes/chat.routes";
import { prisma } from "./config/prisma";
import cors from "cors";

import "./events/schedule.handler";

import userRoutes from "./routes/user.routes";
import conversationRoutes from "./routes/conversation.routes";
import messageRoutes from "./routes/message.routes";
import scheduleRoutes from "./routes/schedule.routes";
import realtimeRoutes from "./routes/realtime.routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.text({ type: "application/sdp" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

app.use("/users", userRoutes);
app.use(["/conversations", "/realtime", "/rooms", "/devices"], requireSession);
app.use("/users/:userId", requireSession);
app.use("/rooms", chatRoutes);
app.post("/devices", async (req, res) => {
  if (typeof req.body.expoPushToken !== "string" || req.body.expoPushToken.length > 500) { res.status(400).json({ message: "푸시 토큰을 확인해주세요." }); return; }
  await prisma.user.update({ where: { id: req.userId }, data: { pushToken: req.body.expoPushToken } });
  res.status(204).send();
});
app.use("/conversations", conversationRoutes);
app.use("/conversations", messageRoutes);
app.use("/users", scheduleRoutes);
app.use("/realtime", realtimeRoutes);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  logError("요청 처리 오류", error);
  res.status(500).json({ message: '요청 처리에 실패했습니다. 잠시 후 다시 시도해주세요.' });
};
app.use(errorHandler);
export default app;
