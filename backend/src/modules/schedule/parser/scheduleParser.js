const chrono = require('chrono-node');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function refineWithLLM(message) {
  try {

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
사용자 메시지에서 일정 제목만 추출해라.
JSON만 반환.

형식:
{ "title": "일정 제목", "isSchedule": true/false }

예시
입력: 내일 3시에 엄마랑 통화
출력: { "title": "엄마랑 통화", "isSchedule": true }

입력: 오늘 날씨 좋다
출력: { "title": null, "isSchedule": false }
`
        },
        { role: "user", content: message }
      ]
    });

    return JSON.parse(res.choices[0].message.content);

  } catch (err) {

    console.error("LLM refine error:", err);
    return null;

  }
}

async function parseSchedule(message) {

  // 1️⃣ chrono 날짜 파싱
  const date = chrono.parseDate(message);

  if (!date) return null;

  // 2️⃣ LLM 보정
  const llm = await refineWithLLM(message);

  if (!llm || !llm.isSchedule) return null;

  return {
    title: llm.title || message,
    schedule_time: date,
    raw_message: message
  };

}

module.exports = { parseSchedule };