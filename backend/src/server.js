require('dotenv').config();

const http = require('http');
const app = require('./app');
const { initSocket } = require('./sockets');
const { sequelize } = require('./models');

const { startScheduleWorker } = require('./workers/scheduleWorker');
const { startNotifyWorker } = require(__dirname + '/workers/notifyWorker');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

initSocket(server);

async function startServer() {

  try {

    await sequelize.authenticate();
    console.log("DB 연결 성공");

    await sequelize.sync();
    console.log("DB Sync 완료");

    // Worker 시작
    startScheduleWorker();
    console.log("Schedule Worker 시작");

    startNotifyWorker();
    console.log("Notify Worker 시작");

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {

    console.error("서버 시작 실패:", err);
    process.exit(1);

  }

}

startServer();