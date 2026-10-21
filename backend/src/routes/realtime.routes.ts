import { logError } from "../lib/logError";
import { Router } from "express";
import OpenAI from "openai";
import {realtimeConfig} from "../config/realtime.config";

const router = Router();



// 같은 사용자가 짧은 시간에 음성 세션을 너무 많이 만들지 않도록 제한 (OpenAI 요금 남용 방지, 메모리 기준)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_SESSIONS = 10;
const recent = new Map<string, number[]>();

router.post("/session", async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ message: "음성 대화 서버 설정이 아직 안 됐어요." });
    return;
  }
  if (!req.body || typeof req.body !== "string") {
    res.status(400).json({ message: "SDP is required" });
    return;
  }
  const key = String(req.userId);
  const now = Date.now();
  // 기간이 지난 기록 정리 (Map 이 계속 커지지 않게)
  if (recent.size > 1000) for (const [k, v] of recent) if (!v.some((t) => now - t < WINDOW_MS)) recent.delete(k);
  const list = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_SESSIONS) {
    res.status(429).json({ message: "잠시 후 다시 시도해 주세요." });
    return;
  }
  list.push(now);
  recent.set(key, list);
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20000, maxRetries: 0 });
    const sdp = req.body;

    if (!sdp) {
      res.status(400).json({
        message: "SDP is required",
      });
      return;
    }

    const response = await openai.realtime.calls.create({
      sdp,
      session: {
        type: "realtime",
        model: realtimeConfig.model,
        instructions: realtimeConfig.instructions,
      },
    });

    const answerSdp = await response.text();

    res.type("application/sdp").send(answerSdp);
  } catch (error) {
    logError("Realtime 세션 오류", error);

    res.status(500).json({
      message: "Realtime session creation failed",
    });
  }
});

export default router;