const express = require('express');
const router = express.Router();
const scheduleController = require('./scheduleController');

router.post('/', scheduleController.createSchedule);
router.get('/:userId', scheduleController.getSchedules);

module.exports = router;