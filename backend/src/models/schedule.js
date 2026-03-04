// src/models/schedule.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Schedule = sequelize.define(
    'Schedule',
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
      title: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      schedule_time: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      raw_message: {
        type: DataTypes.TEXT,
      },
      notified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: 'schedules',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      underscored: true,
    }
  );

  return Schedule;
};