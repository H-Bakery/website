'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('notification_templates', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      key: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      category: {
        type: Sequelize.ENUM('production', 'inventory', 'order', 'staff', 'financial', 'system', 'customer'),
        allowNull: false
      },
      defaultTitle: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: { de: '', en: '' }
      },
      defaultMessage: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: { de: '', en: '' }
      },
      variables: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: []
      },
      defaultPriority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium'
      },
      defaultType: {
        type: Sequelize.ENUM('info', 'success', 'warning', 'error'),
        allowNull: false,
        defaultValue: 'info'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {}
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('notification_templates', ['key']);
    await queryInterface.addIndex('notification_templates', ['category']);
    await queryInterface.addIndex('notification_templates', ['isActive']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('notification_templates');
  }
};