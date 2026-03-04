const express = require('express');
const router = express.Router();

router.use('/user', require('../modules/user/userRoutes'));
router.use('/chat', require('../modules/chat/chatRoutes'));
router.use('/schedule', require('../modules/schedule/scheduleRoutes'));
router.use('/speech', require('../modules/speech/speechRoutes'));

module.exports = router;