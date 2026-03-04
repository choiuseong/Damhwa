const express = require('express');
const router = express.Router();
const speechService = require('./speechService');

router.post('/stt', speechService.stt);
router.post('/tts', speechService.tts);

module.exports = router;