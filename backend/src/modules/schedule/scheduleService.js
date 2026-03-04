const { Schedule } = require('../../models');
const { addJob } = require('../../workers/scheduleQueue');

/**
 * 일정 생성
 * DB 직접 저장 대신 큐에 작업 등록
 * @param {Object} data - 일정 정보 (title, schedule_time 등)
 * @param {number} userId - 사용자 ID
 */
exports.createSchedule = async (data, userId) => {
  addJob({
    type: 'schedule',
    payload: { scheduleData: data, userId },
  });
};

/**
 * 특정 사용자 일정 조회
 * @param {number} userId
 * @returns {Promise<Array<Schedule>>}
 */
exports.getByUser = async (userId) => {
  return await Schedule.findAll({
    where: { user_id: userId },
    order: [['schedule_time', 'ASC']],
  });
};