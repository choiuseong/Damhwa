// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const routes = require('./routes');

const app = express();

// 기본 미들웨어
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 로그
app.use(morgan('dev'));

// 헬스체크
app.get('/', (req, res) => {
  res.json({ message: 'ElderTalk Server Running 🚀' });
});

// 라우터 연결
app.use('/api', routes);

// 404 처리
app.use((req, res, next) => {
  res.status(404).json({ message: 'Not Found' });
});

// 에러 핸들러 (중앙 집중식)
app.use((err, req, res, next) => {
  console.error('서버 에러:', err);
  res.status(500).json({
    message: 'Internal Server Error',
  });
});

module.exports = app;