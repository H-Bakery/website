module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "Notification",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 255],
        },
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      type: {
        type: DataTypes.ENUM("info", "success", "warning", "error"),
        allowNull: false,
        defaultValue: "info",
      },
      category: {
        type: DataTypes.ENUM("staff", "order", "system", "inventory", "general"),
        allowNull: false,
        defaultValue: "general",
      },
      priority: {
        type: DataTypes.ENUM("low", "medium", "high", "urgent"),
        allowNull: false,
        defaultValue: "medium",
      },
      read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      archived: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      archivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
      },
    },
    {
      tableName: "notifications",
      timestamps: true,
      paranoid: true, // Enable soft deletes
      indexes: [
        {
          fields: ["userId"],
        },
        {
          fields: ["read"],
        },
        {
          fields: ["archived"],
        },
        {
          fields: ["category"],
        },
        {
          fields: ["priority"],
        },
        {
          fields: ["createdAt"],
        },
        {
          fields: ["archivedAt"],
        },
        {
          fields: ["deletedAt"],
        },
        {
          // Composite index for active notifications (most common query)
          fields: ["userId", "archived", "deletedAt"],
        },
        {
          // Composite index for archive queries
          fields: ["userId", "archived", "archivedAt"],
        },
      ],
    },
  );

  return Notification;
};