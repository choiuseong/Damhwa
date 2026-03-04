// scheduleQueue.js (메모리 큐 기반)
const queue = [];

/**
 * 큐에 작업 등록
 * @param {Object} job - { type: 'schedule', payload: {...} }
 */
function addJob(job) {
  queue.push(job);
}

/**
 * 큐에서 작업 처리
 * @param {Function} handler - async(job) 처리 함수
 */
function processJobs(handler) {
  setInterval(async () => {
    if (queue.length === 0) return;
    const job = queue.shift();
    try {
      await handler(job);
    } catch (err) {
      console.error('큐 작업 실패:', err);
    }
  }, 1000); // 1초마다 큐 체크
}

module.exports = { addJob, processJobs };