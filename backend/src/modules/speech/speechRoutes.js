// src/modules/speech/speechRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const speechService = require('./speechService');

const upload = multer({ dest: 'uploads/' });

router.post('/stt', upload.single('audio'), speechService.stt);
router.post('/tts', speechService.tts);

module.exports = router;