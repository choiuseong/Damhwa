const { Chat, sequelize } = require('../../models');
const openai = require('../../config/openai');

const { parseSchedule } = require('../schedule/parser/scheduleParser');
const scheduleService = require('../schedule/scheduleService');

exports.processMessage = async (userId, message) => {

  const t = await sequelize.transaction();

  try {

    // 1️⃣ 사용자 메시지 저장
    await Chat.create(
      { user_id: userId, role: 'elder', content: message },
      { transaction: t }
    );

    // 2️⃣ 일정 파싱
    const schedule = parseSchedule(message);

    if (schedule) {
      await scheduleService.createSchedule(schedule, userId);
    }

    // 3️⃣ 최근 대화 가져오기
    const history = await Chat.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: 10,
      transaction: t,
    });

    // 4️⃣ GPT 메시지 구성
    const messages = [
      {
        role: "system",
        content: `
당신은 노인을 위한 따뜻한 AI 대화 친구입니다.

대화 규칙
- 항상 공손하게 말하세요
- 쉬운 단어를 사용하세요
- 너무 길게 말하지 마세요
- 노인의 감정을 공감하세요
- 존댓말 사용
- 한국어로 답변
        `
      },
      ...history.reverse().map((c) => ({
        role: c.role === 'elder' ? 'user' : 'assistant',
        content: c.content,
      })),
      { role: "user", content: message }
    ];

    // 5️⃣ GPT 호출
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 200
    });

    const aiReply = completion.choices[0].message.content;

    // 6️⃣ AI 답변 저장
    await Chat.create(
      { user_id: userId, role: 'ai', content: aiReply },
      { transaction: t }
    );

    await t.commit();

    return aiReply;

  } catch (err) {
    await t.rollback();
    throw err;
  }
};