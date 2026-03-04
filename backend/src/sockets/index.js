// src/sockets/index.js
const { Server } = require('socket.io');
const registerChatSocket = require('./chatSocket');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  io.on('connection', (socket) => {
    console.log('소켓 연결:', socket.id);

    registerChatSocket(io, socket);

    socket.on('disconnect', () => {
      console.log('소켓 종료:', socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

module.exports = {
  initSocket,
  getIO,
};