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

    const messages = history.reverse().map((c) => ({
      role: c.role === 'elder' ? 'user' : 'assistant',
      content: c.content,
    }));

    // 3. GPT 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
    });

    const aiReply = completion.choices[0].message.content;

    // 4. AI 저장
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