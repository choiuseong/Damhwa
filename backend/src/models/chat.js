// src/models/chat.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Chat = sequelize.define(
    'Chat',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM('elder', 'ai'),
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      tableName: 'chats',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      underscored: true,
    }
  );

  return Chat;
};