// google.js
const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');

const GOOGLE_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const speechClient = new speech.SpeechClient({ keyFilename: GOOGLE_CREDENTIALS });
const ttsClient = new textToSpeech.TextToSpeechClient({ keyFilename: GOOGLE_CREDENTIALS });

// STT 함수
async function stt(filePath) {
  const fs = require('fs');
  const file = fs.readFileSync(filePath);
  const audioBytes = file.toString('base64');

  const audio = { content: audioBytes };

  const config = {
    encoding: 'LINEAR16',
    languageCode: 'ko-KR',
  };

  const request = { audio, config };
  const [response] = await speechClient.recognize(request);
  const transcription = response.results
    .map(r => r.alternatives[0].transcript)
    .join('\n');

  return transcription;
}

// TTS 함수
async function tts(text) {
  const request = {
    input: { text },
    voice: { languageCode: 'ko-KR', ssmlGender: 'NEUTRAL' },
    audioConfig: { audioEncoding: 'MP3' },
  };

  const [response] = await ttsClient.synthesizeSpeech(request);
  return response.audioContent; // Buffer 형태
}

module.exports = { stt, tts };