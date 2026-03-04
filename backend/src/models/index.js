// src/models/index.js
const sequelize = require('../config/mysql');

const UserModel = require('./user');
const ChatModel = require('./chat');
const ScheduleModel = require('./schedule');

const User = UserModel(sequelize);
const Chat = ChatModel(sequelize);
const Schedule = ScheduleModel(sequelize);

// ===== 관계 =====

// User 1 : N Chat
User.hasMany(Chat, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Chat.belongsTo(User, { foreignKey: 'user_id' });

// User 1 : N Schedule
User.hasMany(Schedule, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Schedule.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
  sequelize,
  User,
  Chat,
  Schedule,
};