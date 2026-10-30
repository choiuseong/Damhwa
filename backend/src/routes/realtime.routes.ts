// [변경] OpenAI 키가 없어도 서버가 켜지도록 클라이언트를 필요할 때 만들고, 키가 없으면 503
import { Router } from "express";
import OpenAI from "openai";
import { realtimeConfig } from "../config/realtime.config";

const router = Router();

// 키가 없을 때 서버 전체가 시작조차 못 하던 문제 수정:
// OpenAI 클라이언트를 처음 음성 요청이 올 때 만든다. (키 없이도 채팅·일정 등 다른 기능은 동작)
let openai: OpenAI | null = null;

router.post("/session", async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ message: "음성 대화용 OPENAI_API_KEY 가 backend/.env 에 없어요." });
    return;
  }
  openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
        instructions: realtimeConfig.instructions,
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
              },
              required: ["title", "scheduleTime", "rawMessage"],
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