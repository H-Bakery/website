'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Inventories', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      sku: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          min: 0
        }
      },
      unit: {
        type: Sequelize.ENUM('kg', 'g', 'liters', 'ml', 'units', 'pieces', 'bags', 'boxes', 'bottles', 'jars'),
        allowNull: false,
        defaultValue: 'units'
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true
      },
      cost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          min: 0
        }
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          min: 0
        }
      },
      lowStockThreshold: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          min: 0
        }
      },
      reorderLevel: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          min: 0
        }
      },
      reorderQuantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          min: 0
        }
      },
      supplier: {
        type: Sequelize.STRING,
        allowNull: true
      },
      lastRestocked: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expiryDate: {
        type: Sequelize.DATE,
        allowNull: true
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
    await queryInterface.addIndex('Inventories', ['name']);
    await queryInterface.addIndex('Inventories', ['sku']);
    await queryInterface.addIndex('Inventories', ['category']);
    await queryInterface.addIndex('Inventories', ['supplier']);
    await queryInterface.addIndex('Inventories', ['quantity']);
    await queryInterface.addIndex('Inventories', ['lowStockThreshold']);
    await queryInterface.addIndex('Inventories', ['expiryDate']);
    await queryInterface.addIndex('Inventories', ['lastRestocked']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Inventories');
  }
};