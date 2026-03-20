// src/modules/speech/speechService.js
const fs = require('fs');
const { exec } = require('child_process');
const { stt, tts } = require('../../config/google');
const { processMessage } = require('../chat/chatService');
const path = require('path');

/**
 * m4a → WAV 변환 (16kHz mono)
 */
async function convertToWav(inputPath) {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath + '.wav';
    exec(
      `ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 "${outputPath}"`,
      (error, stdout, stderr) => {
        if (error) {
          console.error('ffmpeg 변환 실패:', error, stderr);
          return reject(error);
        }
        resolve(outputPath);
      }
    );
  });
}

exports.stt = async (req, res) => {
  let wavPath;
  try {
    if (!req.file) return res.status(400).json({ message: '오디오 파일 필요' });

    const filePath = req.file.path;
    console.log('🔹 업로드 파일 경로:', filePath);
    console.log('🔹 파일 존재 여부:', fs.existsSync(filePath));

    // 1️⃣ m4a → wav 변환
    wavPath = await convertToWav(filePath);
    console.log('🔹 변환된 WAV 파일 경로:', wavPath);

    // 2️⃣ STT 변환
    let userMessage;
    try {
      userMessage = await stt(wavPath, {
        encoding: 'LINEAR16',
        languageCode: 'ko-KR',
        // sampleRateHertz 제거 → WAV 헤더 자동 감지
      });
    } catch (sttErr) {
      console.warn('⚠️ STT 변환 실패:', sttErr.message);
      userMessage = '';
    }

    console.log('🔹 STT raw 결과:', userMessage);

    // STT 실패 시 fallback 처리
    if (!userMessage || userMessage.trim() === '') {
      console.warn('⚠️ STT 결과 없음, 기본 텍스트로 대체');
      const fallbackText = '[음성 인식 실패]';
      const aiReply = await processMessage(req.body.userId, fallbackText);
      const audioBuffer = await tts(aiReply);

      return res.json({
        text: fallbackText,
        reply: aiReply,
        ttsUrl: `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`,
      });
    }

    // 3️⃣ userId 확인
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ message: 'userId 필요' });

    // 4️⃣ GPT 처리 + DB 저장
    const aiReply = await processMessage(userId, userMessage);

    // 5️⃣ TTS 변환
    const audioBuffer = await tts(aiReply);

    // 6️⃣ RN에 전달
    res.json({
      text: userMessage,
      reply: aiReply,
      ttsUrl: `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`,
    });

  } catch (err) {
    console.error('STT 처리 에러:', err);
    res.status(500).json({ message: 'STT 처리 실패' });
  } finally {
    // 업로드 파일 + 변환 WAV 삭제
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (wavPath && fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
  }
};

exports.tts = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'text 필요' });

    const audioBuffer = await tts(text);
    res.json({ audio: audioBuffer.toString('base64') });

  } catch (err) {
    console.error('TTS 처리 에러:', err);
    res.status(500).json({ message: 'TTS 처리 실패' });
  }
};