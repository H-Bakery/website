'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Recipes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      instructions: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      ingredients: {
        type: Sequelize.JSON,
        allowNull: true
      },
      prepTime: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 0
        }
      },
      cookTime: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 0
        }
      },
      servings: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1
        }
      },
      difficulty: {
        type: Sequelize.ENUM('easy', 'medium', 'hard'),
        allowNull: false,
        defaultValue: 'medium'
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true
      },
      published: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
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
    await queryInterface.addIndex('Recipes', ['slug']);
    await queryInterface.addIndex('Recipes', ['title']);
    await queryInterface.addIndex('Recipes', ['category']);
    await queryInterface.addIndex('Recipes', ['difficulty']);
    await queryInterface.addIndex('Recipes', ['published']);
    await queryInterface.addIndex('Recipes', ['published', 'category']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Recipes');
  }
};