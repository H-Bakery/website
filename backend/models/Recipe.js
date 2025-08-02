const { DataTypes } = require("sequelize");
const logger = require("../utils/logger");

module.exports = (sequelize) => {
  const Recipe = sequelize.define(
    "Recipe",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Store ingredients as JSON array
      ingredients: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        validate: {
          isArray(value) {
            if (!Array.isArray(value)) {
              throw new Error("Ingredients must be an array");
            }
            // Validate each ingredient has name and quantity
            value.forEach((ingredient, index) => {
              if (!ingredient.name || !ingredient.quantity) {
                throw new Error(`Ingredient at index ${index} must have name and quantity`);
              }
            });
          },
        },
      },
      // Store instructions as markdown text (will be parsed to HTML on GET)
      instructions: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      prepTime: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      cookTime: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      servings: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
        },
      },
      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      hooks: {
        beforeValidate: (recipe) => {
          // Create slug from name
          if (recipe.name && !recipe.slug) {
            recipe.slug = recipe.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "");
          }
        },
        beforeCreate: (recipe) => {
          logger.info(`Creating new recipe: ${recipe.name}`);
        },
        afterCreate: (recipe) => {
          logger.info(`Recipe created with ID: ${recipe.id}, slug: ${recipe.slug}`);
        },
      },
    }
  );

  return Recipe;
};