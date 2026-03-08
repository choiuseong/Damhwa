const axios = require('axios');
const { Schedule, User } = require('../models');
const { Op } = require('sequelize');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function startNotifyWorker() {

  setInterval(async () => {

    const now = new Date();

    const schedules = await Schedule.findAll({
      where: {
        schedule_time: {
          [Op.lte]: now
        },
        notified: false
      }
    });

    for (const s of schedules) {

      const user = await User.findByPk(s.user_id);

      if (user?.expo_push_token) {

        try {

          await axios.post(EXPO_PUSH_URL, {
            to: user.expo_push_token,
            sound: 'default',
            title: '엘더톡 일정 알림',
            body: `${s.title} 일정이 있어요.`,
          });

        } catch (err) {
          console.error('Push error:', err.message);
        }

      }

      s.notified = true;
      await s.save();
    }

  }, 60000); // 1분마다 체크
}

module.exports = { startNotifyWorker };