const { processJobs } = require('./scheduleQueue');
const { Schedule } = require('../models');

function startScheduleWorker() {

  processJobs(async (job) => {

    if (job.type !== 'schedule') return;

    const { scheduleData, userId } = job.payload;

    const schedule = await Schedule.create({
      ...scheduleData,
      user_id: userId
    });

    console.log(`Schedule saved: ${schedule.id}`);

  });

}

module.exports = { startScheduleWorker };