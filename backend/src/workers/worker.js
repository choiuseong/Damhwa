const { startNotifyWorker } = require(__dirname + '/workers/notifyWorker');

// 워커 실행
startNotifyWorker();

console.log('Worker started - schedule queue processing');