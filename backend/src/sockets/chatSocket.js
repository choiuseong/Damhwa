// src/sockets/chatSocket.js
const chatService = require('../modules/chat/chatService');

module.exports = (io, socket) => {
  /**
   * 클라이언트가 보낼 이벤트
   * socket.emit('chat:send', { userId, message })
   */
  socket.on('chat:send', (data) => {
    try {
      const { userId, message } = data;

      if (!userId || !message) {
        return socket.emit('chat:error', {
          message: 'userId와 message는 필수입니다.',
        });
      }

      // 1️⃣ 사용자 메시지 먼저 전달 (UI 즉시 반응)
      socket.emit('chat:user', {
        message,
      });

      // 2️⃣ AI typing 상태 전달
      socket.emit('chat:typing', {
        status: true,
      });

      // 3️⃣ GPT 비동기 처리
      chatService
        .processMessage(userId, message)
        .then((aiReply) => {

          // AI 응답 전송
          socket.emit('chat:reply', {
            reply: aiReply,
          });

          // typing 종료
          socket.emit('chat:typing', {
            status: false,
          });

        })
        .catch((err) => {
          console.error(err);

          socket.emit('chat:error', {
            message: '채팅 처리 중 오류 발생',
          });
        });

    } catch (err) {
      console.error(err);
      socket.emit('chat:error', {
        message: '채팅 처리 중 오류 발생',
      });
    }
  });

  /**
   * 유저별 room 입장
   */
  socket.on('chat:join', ({ userId }) => {
    socket.join(`user:${userId}`);
    console.log(`user:${userId} room 입장`);
  });
};