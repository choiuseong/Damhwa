const { Schedule } = require('../../models');
const { addJob } = require('../../workers/scheduleQueue');

/**
 * 일정 생성 (큐 등록)
 */
exports.createSchedule = async (data, userId) => {
  addJob({
    type: 'schedule',
    payload: {
      scheduleData: data,
      userId,
    },
  });
};

/**
 * 사용자 일정 조회
 */
exports.getByUser = async (userId) => {
  return await Schedule.findAll({
    where: { user_id: userId },
    order: [['schedule_time', 'ASC']],
  });
};