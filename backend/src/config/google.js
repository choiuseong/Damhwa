// google.js
const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');

// 인증 JSON 경로 환경변수
const GOOGLE_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const speechClient = new speech.SpeechClient({ keyFilename: GOOGLE_CREDENTIALS });
const ttsClient = new textToSpeech.TextToSpeechClient({ keyFilename: GOOGLE_CREDENTIALS });

module.exports = { speechClient, ttsClient };