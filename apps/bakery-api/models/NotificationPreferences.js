module.exports = (sequelize, DataTypes) => {
  const NotificationPreferences = sequelize.define(
    "NotificationPreferences",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "Users",
          key: "id",
        },
      },
      emailEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      browserEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      soundEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      categoryPreferences: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
          staff: true,
          order: true,
          system: true,
          inventory: true,
          general: true,
        },
        validate: {
          isValidCategories(value) {
            const validCategories = ["staff", "order", "system", "inventory", "general"];
            const keys = Object.keys(value);
            for (const key of keys) {
              if (!validCategories.includes(key)) {
                throw new Error(`Invalid category: ${key}`);
              }
              if (typeof value[key] !== "boolean") {
                throw new Error(`Category preference must be boolean: ${key}`);
              }
            }
          },
        },
      },
      priorityThreshold: {
        type: DataTypes.ENUM("low", "medium", "high", "urgent"),
        allowNull: false,
        defaultValue: "low",
      },
      quietHours: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
          enabled: false,
          start: "22:00",
          end: "07:00",
        },
        validate: {
          isValidQuietHours(value) {
            if (typeof value.enabled !== "boolean") {
              throw new Error("Quiet hours enabled must be boolean");
            }
            if (value.start && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value.start)) {
              throw new Error("Invalid start time format. Use HH:MM");
            }
            if (value.end && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value.end)) {
              throw new Error("Invalid end time format. Use HH:MM");
            }
          },
        },
      },
    },
    {
      tableName: "notification_preferences",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["userId"],
        },
      ],
    },
  );

  return NotificationPreferences;
};