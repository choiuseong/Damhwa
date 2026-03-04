const google = require('../../config/google');

exports.stt = async (req, res) => {
  try {
    const { audioBuffer } = req.body;

    const result = await google.stt(audioBuffer);

    res.json({ text: result });
  } catch {
    res.status(500).json({ message: 'STT 실패' });
  }
};

exports.tts = async (req, res) => {
  try {
    const { text } = req.body;

    const audio = await google.tts(text);

    res.json({ audio });
  } catch {
    res.status(500).json({ message: 'TTS 실패' });
  }
};