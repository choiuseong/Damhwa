const { Chat, sequelize } = require('../../models');
const openai = require('../../config/openai');

exports.processMessage = async (userId, message) => {
  const t = await sequelize.transaction();

  try {
    // 1. 유저 메시지 저장
    await Chat.create(
      { user_id: userId, role: 'elder', content: message },
      { transaction: t }
    );

    // 2. 최근 대화 가져오기
    const history = await Chat.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: 10,
      transaction: t,
    });

    // 3. 시스템 프롬프트 + 대화 기록 구성
    const messages = [
      {
        role: "system",
        content: `
당신은 노인을 위한 따뜻한 AI 대화 친구입니다.

대화 규칙:
- 항상 공손하고 친근하게 대화하세요.
- 어려운 단어 대신 쉬운 말을 사용하세요.
- 너무 길게 말하지 마세요.
- 노인의 감정을 공감해 주세요.
- 질문을 통해 자연스럽게 대화를 이어가세요.
- 존댓말을 사용하세요.
- 한국어로 답하세요.

예시 톤:
"오늘 하루는 어떠셨어요?"
"날씨가 참 좋네요. 산책은 하셨나요?"
"그런 일이 있으셨군요. 많이 놀라셨겠어요."
        `
      },
      ...history.reverse().map((c) => ({
        role: c.role === 'elder' ? 'user' : 'assistant',
        content: c.content,
      }))
    ];

    // 현재 메시지 보장
    messages.push({
      role: "user",
      content: message
    });

    // 4. GPT 호출
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 200
    });

    const aiReply = completion.choices[0].message.content;

    // 5. AI 답변 저장
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