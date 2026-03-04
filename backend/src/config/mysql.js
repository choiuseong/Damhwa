// mysql.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false, // console.log SQL 제거
    timezone: '+09:00', // 한국 시간
  }
);

module.exports = sequelize;