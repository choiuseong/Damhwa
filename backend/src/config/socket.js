// socket.js
const { Server } = require('socket.io');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('새 소켓 연결:', socket.id);

    socket.on('disconnect', () => {
      console.log('소켓 종료:', socket.id);
    });
  });
}

function getIo() {
  if (!io) throw new Error('Socket.io가 초기화되지 않았습니다.');
  return io;
}

module.exports = { initSocket, getIo };