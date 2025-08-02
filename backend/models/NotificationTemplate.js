module.exports = (sequelize, DataTypes) => {
  const NotificationTemplate = sequelize.define(
    "NotificationTemplate",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
          is: /^[a-z]+\.[a-z_]+$/, // Format: category.event_name
        },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      category: {
        type: DataTypes.ENUM(
          "production",
          "inventory",
          "order",
          "staff",
          "financial",
          "system",
          "customer"
        ),
        allowNull: false,
      },
      defaultTitle: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
          de: "",
          en: "",
        },
        validate: {
          hasRequiredLanguages(value) {
            if (!value.de || !value.en) {
              throw new Error("Template must have both German and English titles");
            }
          },
        },
      },
      defaultMessage: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
          de: "",
          en: "",
        },
        validate: {
          hasRequiredLanguages(value) {
            if (!value.de || !value.en) {
              throw new Error("Template must have both German and English messages");
            }
          },
        },
      },
      variables: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        validate: {
          isArrayOfStrings(value) {
            if (!Array.isArray(value)) {
              throw new Error("Variables must be an array");
            }
            if (!value.every(v => typeof v === "string")) {
              throw new Error("All variables must be strings");
            }
          },
        },
      },
      defaultPriority: {
        type: DataTypes.ENUM("low", "medium", "high", "urgent"),
        allowNull: false,
        defaultValue: "medium",
      },
      defaultType: {
        type: DataTypes.ENUM("info", "success", "warning", "error"),
        allowNull: false,
        defaultValue: "info",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
      },
    },
    {
      tableName: "notification_templates",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["key"],
        },
        {
          fields: ["category"],
        },
        {
          fields: ["isActive"],
        },
      ],
    },
  );

  return NotificationTemplate;
};