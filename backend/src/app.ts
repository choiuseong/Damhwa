import express from "express";
import { createChat } from "./chat";
import cors from "cors";

import "./events/schedule.handler";

import userRoutes from "./routes/user.routes";
import conversationRoutes from "./routes/conversation.routes";
import messageRoutes from "./routes/message.routes";
import scheduleRoutes from "./routes/schedule.routes";
import realtimeRoutes from "./routes/realtime.routes";

const app = express();
export const chat = createChat();

app.use(cors());
app.use(express.json());
app.use(express.text({ type: "application/sdp" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

app.use("/users", userRoutes);
app.use("/conversations", conversationRoutes);
app.use("/conversations", messageRoutes);
app.use("/users", scheduleRoutes);
app.use("/realtime", realtimeRoutes);

app.use("/rooms", chat.router);
app.use("/uploads", chat.uploads);
app.use("/admin/chat", chat.adminRouter);

export default app;
