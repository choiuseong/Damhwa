// src/sockets/chatSocket.js
const { stt, tts } = require('../config/google');
const { processMessage } = require('../modules/chat/chatService');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

async function convertToWav(inputPath) {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath + '.wav';
    exec(
      `ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 "${outputPath}"`,
      (error) => {
        if (error) return reject(error);
        resolve(outputPath);
      }
    );
  });
}

module.exports = (io, socket) => {
  // 기존 채팅 이벤트 유지
  socket.on('chat:send', (data) => {
    try {
      const { userId, message } = data;
      if (!userId || !message)
        return socket.emit('chat:error', { message: 'userId와 message 필요' });

      socket.emit('chat:user', { message });
      socket.emit('chat:typing', { status: true });

      processMessage(userId, message)
        .then((aiReply) => {
          socket.emit('chat:reply', { reply: aiReply });
          socket.emit('chat:typing', { status: false });
        })
        .catch((err) => {
          console.error(err);
          socket.emit('chat:error', { message: '채팅 처리 중 오류 발생' });
        });
    } catch (err) {
      console.error(err);
      socket.emit('chat:error', { message: '채팅 처리 중 오류 발생' });
    }
  });

  socket.on('chat:join', ({ userId }) => {
    socket.join(`user:${userId}`);
    console.log(`user:${userId} room 입장`);
  });

  // 🎤 음성 이벤트
  socket.on('speech:send', async ({ userId, audioBase64 }) => {
    if (!userId || !audioBase64)
      return socket.emit('speech:error', { message: 'userId와 audioBase64 필요' });

    socket.emit('speech:status', { status: 'processing' });

    const startTotal = Date.now(); // 총 소요 시간 측정 시작

    try {
      const fileName = `${Date.now()}_${userId}.m4a`;
      const filePath = path.join(__dirname, '../../uploads/', fileName);
      fs.writeFileSync(filePath, Buffer.from(audioBase64, 'base64'));

      const wavPath = await convertToWav(filePath);
      console.log(`[변환] WAV 변환 완료: ${Date.now() - startTotal}ms, 경로: ${wavPath}`);

      // ----------------------
      // STT
      // ----------------------
      console.time(`[STT] ${socket.id}`);
      let userMessage;
      try {
        userMessage = await stt(wavPath, { encoding: 'LINEAR16', languageCode: 'ko-KR' });
      } catch (err) {
        console.warn('STT 실패:', err.message);
        userMessage = '[음성 인식 실패]';
      }
      console.timeEnd(`[STT] ${socket.id}`);
      socket.emit('speech:text', { text: userMessage });

      // ----------------------
      // AI 처리
      // ----------------------
      console.time(`[AI] ${socket.id}`);
      const aiReply = await processMessage(userId, userMessage);
      console.timeEnd(`[AI] ${socket.id}`);
      socket.emit('speech:reply', { reply: aiReply });

      // ----------------------
      // TTS
      // ----------------------
      console.time(`[TTS] ${socket.id}`);
      const audioBuffer = await tts(aiReply);
      console.timeEnd(`[TTS] ${socket.id}`);
      socket.emit('speech:tts', { ttsBase64: audioBuffer.toString('base64') });

      socket.emit('speech:status', { status: 'idle' });

      fs.unlinkSync(filePath);
      fs.unlinkSync(wavPath);

      const totalTime = Date.now() - startTotal;
      console.log(`[총 소요 시간] ${totalTime}ms`);

    } catch (err) {
      console.error(err);
      socket.emit('speech:error', { message: '음성 처리 실패' });
    }
  });
};