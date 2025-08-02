const { DataTypes } = require("sequelize");
const logger = require("../utils/logger");

module.exports = (sequelize) => {
  const Chat = sequelize.define(
    "Chat",
    {
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      hooks: {
        beforeCreate: (chat) => {
          logger.info(`Creating chat message from user ${chat.UserId}`);
        },
      },
    },
  );

  return Chat;
};
