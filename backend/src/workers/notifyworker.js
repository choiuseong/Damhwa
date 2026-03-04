const axios = require('axios');
const { Schedule, User } = require('../models');
const { processJobs } = require('./scheduleQueue');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * 큐에서 일정 작업 가져와 처리
 */
function startNotifyWorker() {
  processJobs(async (job) => {
    if (job.type !== 'schedule') return;

    const { scheduleData, userId } = job.payload;

    // 1) DB 저장
    const schedule = await Schedule.create({ ...scheduleData, userId });

    // 2) 푸시 알림 발송
    const user = await User.findByPk(userId);
    if (user && user.expo_push_token) {
      try {
        await axios.post(EXPO_PUSH_URL, {
          to: user.expo_push_token,
          sound: 'default',
          title: '엘더톡 일정 알림',
          body: `${schedule.title} 일정이 있어요.`,
        });
      } catch (err) {
        console.error('푸시 발송 실패:', err.message);
      }
    }

    console.log(`큐 작업 완료 (scheduleId: ${schedule.id})`);
  });
}

module.exports = { startNotifyWorker };