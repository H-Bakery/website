'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Chats', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      channel: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'general'
      },
      isRead: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      priority: {
        type: Sequelize.ENUM('low', 'normal', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'normal'
      },
      replyToId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Chats',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
    await queryInterface.addIndex('Chats', ['userId']);
    await queryInterface.addIndex('Chats', ['channel']);
    await queryInterface.addIndex('Chats', ['isRead']);
    await queryInterface.addIndex('Chats', ['priority']);
    await queryInterface.addIndex('Chats', ['replyToId']);
    await queryInterface.addIndex('Chats', ['createdAt']);
    await queryInterface.addIndex('Chats', ['channel', 'createdAt']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Chats');
  }
};