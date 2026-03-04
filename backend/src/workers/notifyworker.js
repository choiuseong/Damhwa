// src/workers/notifyWorker.js
const axios = require('axios');
const { Schedule, User } = require('../models');
const { Op } = require('sequelize');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// 1분마다 실행
function startNotifyWorker() {
  setInterval(async () => {
    try {
      console.log('일정 체크 중...');

      const now = new Date();

      // 알림 안 보낸 일정 조회
      const schedules = await Schedule.findAll({
        where: {
          schedule_time: {
            [Op.lte]: now,
          },
          notified: false,
        },
        include: [{ model: User }],
      });

      for (const schedule of schedules) {
        const user = schedule.User;

        if (!user || !user.expo_push_token) continue;

        // Expo 푸시 발송
        await axios.post(EXPO_PUSH_URL, {
          to: user.expo_push_token,
          sound: 'default',
          title: '📅 엘더톡 일정 알림',
          body: `${schedule.title} 일정이 있어요.`,
        });

        // notified true 처리
        schedule.notified = true;
        await schedule.save();

        console.log(`알림 발송 완료 (scheduleId: ${schedule.id})`);
      }
    } catch (err) {
      console.error('notifyWorker 오류:', err.message);
    }
  }, 60 * 1000); // 1분
}

module.exports = {
  startNotifyWorker,
};