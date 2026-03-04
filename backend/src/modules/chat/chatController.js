const chatService = require('./chatService');

exports.sendMessage = async (req, res) => {
  try {
    const { userId, message } = req.body;
    const reply = await chatService.processMessage(userId, message);

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ message: '채팅 오류' });
  }
};