import { Router } from "express";
import OpenAI from "openai";
import {realtimeConfig} from "../config/realtime.config";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/session", async (req, res) => {
  try {
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
    console.error(error);

    res.status(500).json({
      message: "Realtime session creation failed",
    });
  }
});

export default router;