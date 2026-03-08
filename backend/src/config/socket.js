const { Server } = require('socket.io');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  return io;
}

function getIo() {
  if (!io) throw new Error('Socket.io가 초기화되지 않았습니다.');
  return io;
}

module.exports = { initSocket, getIo };