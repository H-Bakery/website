'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Products', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true
      },
      subcategory: {
        type: Sequelize.STRING,
        allowNull: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          min: 0
        }
      },
      type: {
        type: Sequelize.STRING,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      available: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      seasonal: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      weight: {
        type: Sequelize.STRING,
        allowNull: true
      },
      allergens: {
        type: Sequelize.JSON,
        allowNull: true
      },
      nutritionalInfo: {
        type: Sequelize.JSON,
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
    await queryInterface.addIndex('Products', ['name']);
    await queryInterface.addIndex('Products', ['category']);
    await queryInterface.addIndex('Products', ['subcategory']);
    await queryInterface.addIndex('Products', ['available']);
    await queryInterface.addIndex('Products', ['seasonal']);
    await queryInterface.addIndex('Products', ['price']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Products');
  }
};