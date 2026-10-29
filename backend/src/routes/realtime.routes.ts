
import { Router } from "express";
import OpenAI from "openai";
import {
  buildInstructions,
  realtimeConfig,
} from "../config/realtime.config";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/session", async (req, res) => {
  try {
    const sdp = req.body;

    if (!sdp || typeof sdp !== "string") {
      res.status(400).json({ message: "SDP is required" });
      return;
    }

    const response = await openai.realtime.calls.create({
      sdp,
      session: {
        type: "realtime",
        model: realtimeConfig.model,
        instructions: buildInstructions(),
        audio: {
          output: { voice: realtimeConfig.voice },
        },
        tools: [
          {
            type: "function",
            name: "create_schedule",
            description:
              "사용자가 일정을 등록해 달라고 명확하게 요청했을 때만 호출합니다. 단순히 약속이나 날짜를 언급한 경우에는 호출하지 않습니다. 일정 날짜나 시각이 불명확하면 먼저 사용자에게 질문합니다.",
            parameters: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "등록할 일정의 간결한 제목",
                },
                scheduleTime: {
                  type: "string",
                  description:
                    "일정 시작 시각. 한국 시간대가 포함된 ISO 8601 형식. 예: 2026-11-03T14:00:00+09:00",
                },
                rawMessage: {
                  type: "string",
                  description: "일정 등록의 근거가 된 사용자의 실제 발화",
                },
                reminderMessage: {
                  type: "string",
                  description:
                    "일정 시각이 되면 다마가 어르신께 건넬 한두 문장. 다정한 해요체.",
                },
              },
              required: [
                "title",
                "scheduleTime",
                "rawMessage",
                "reminderMessage",
              ],
              additionalProperties: false,
            },
          },
          {
            type: "function",
            name: "get_schedules",
            description:
              "사용자가 이미 등록한 일정이나 앞으로의 약속을 물어볼 때 호출합니다. 일정을 등록하거나 삭제하는 도구가 아닙니다.",
            parameters: {
              type: "object",
              properties: {},
              required: [],
              additionalProperties: false,
            },
          },
          {
            type: "function",
            name: "get_conversation_history",
            description:
            "사용자가 과거에 나눈 대화나 이전에 했던 말을 물어볼 때 호출합니다. 일정 조회와는 별개이며, 과거 대화에 실제로 기록된 내용만 확인합니다.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "사용자가 회상하려는 과거 대화의 주제나 내용. 전체적인 최근 대화를 물으면 빈 문자열을 사용합니다.",
          },
        },
    required: ["query"],
    additionalProperties: false,
  },
},
        ],
        tool_choice: "auto",
      },
    });

    const answerSdp = await response.text();

    res.type("application/sdp").send(answerSdp);
  } catch (error) {
    console.error("Realtime 세션 생성 오류:", error);
    res.status(500).json({
      message: "Realtime session creation failed",
    });
  }
});

export default router;
