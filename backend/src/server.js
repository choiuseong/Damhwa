// src/server.js
require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./sockets');
const { sequelize } = require('./models');
const { startNotifyWorker } = require(__dirname + '/workers/notifyWorker');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// 소켓 초기화
initSocket(server);

// DB 연결 후 서버 실행
sequelize.authenticate()
  .then(() => {
    console.log('DB 연결 성공');
    return sequelize.sync(); // 필요하면 { alter: true }
  })
  .then(() => {
    // 워커 시작 (DB 연결 후 실행해야 안전)
    startNotifyWorker();
    console.log('Notify Worker 시작');

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('서버 시작 실패:', err);
  });