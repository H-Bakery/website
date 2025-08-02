'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('UnsoldProducts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      quantityUnsold: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 0
        }
      },
      reason: {
        type: Sequelize.ENUM('expired', 'damaged', 'overproduction', 'quality_issue', 'other'),
        allowNull: true,
        defaultValue: 'other'
      },
      estimatedValue: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          min: 0
        }
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
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
    await queryInterface.addIndex('UnsoldProducts', ['date']);
    await queryInterface.addIndex('UnsoldProducts', ['productId']);
    await queryInterface.addIndex('UnsoldProducts', ['userId']);
    await queryInterface.addIndex('UnsoldProducts', ['reason']);
    await queryInterface.addIndex('UnsoldProducts', ['date', 'productId'], {
      unique: true,
      name: 'unique_daily_product_record'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('UnsoldProducts');
  }
};