const { DataTypes } = require("sequelize");
const logger = require("../utils/logger");

module.exports = (sequelize) => {
  const Cash = sequelize.define(
    "Cash",
    {
      amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
    },
    {
      hooks: {
        beforeCreate: (cash) => {
          logger.info(`Creating cash entry: Amount ${cash.amount}`);
        },
      },
    },
  );

  return Cash;
};
