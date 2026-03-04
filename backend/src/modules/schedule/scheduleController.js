const scheduleService = require('./scheduleService');

exports.createSchedule = async (req, res) => {
  try {
    const schedule = await scheduleService.createSchedule(req.body);
    res.json(schedule);
  } catch {
    res.status(500).json({ message: '일정 생성 실패' });
  }
};

exports.getSchedules = async (req, res) => {
  try {
    const schedules = await scheduleService.getByUser(req.params.userId);
    res.json(schedules);
  } catch {
    res.status(500).json({ message: '일정 조회 실패' });
  }
};