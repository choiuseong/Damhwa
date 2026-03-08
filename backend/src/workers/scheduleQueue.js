const queue = [];

/**
 * 큐 등록
 */
function addJob(job) {
  queue.push(job);
}

/**
 * 큐 처리
 */
function processJobs(handler) {

  setInterval(async () => {

    if (queue.length === 0) return;

    const job = queue.shift();

    try {
      await handler(job);
    } catch (err) {
      console.error('Queue error:', err);
    }

  }, 1000);
}

module.exports = { addJob, processJobs };