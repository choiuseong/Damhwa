// src/sockets/chatSocket.js
const chatService = require('../modules/chat/chatService');

module.exports = (io, socket) => {
  /**
   * 클라이언트가 보낼 이벤트
   * socket.emit('chat:send', { userId, message })
   */
  socket.on('chat:send', async (data) => {
    try {
      const { userId, message } = data;

      if (!userId || !message) {
        return socket.emit('chat:error', {
          message: 'userId와 message는 필수입니다.',
        });
      }

      // GPT 처리
      const aiReply = await chatService.processMessage(userId, message);

      // 보낸 사람에게 응답
      socket.emit('chat:reply', {
        reply: aiReply,
      });

      // 필요하면 해당 유저 room에 브로드캐스트 가능
      // io.to(`user:${userId}`).emit('chat:reply', { reply: aiReply });

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
    console.log(`👤 user:${userId} room 입장`);
  });
};