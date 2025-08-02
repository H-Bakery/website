const { Recipe } = require("../models");
const logger = require("../utils/logger");
const { marked } = require("marked");

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
  sanitize: false, // We'll handle sanitization separately if needed
});

// Helper function to convert instructions array to markdown format
const instructionsToMarkdown = (instructions) => {
  if (Array.isArray(instructions)) {
    return instructions.map((step, index) => `${index + 1}. ${step}`).join("\n");
  }
  return instructions;
};

// Helper function to parse markdown instructions to HTML
const parseInstructions = (markdownText) => {
  return marked(markdownText);
};

// Get all recipes
exports.getAllRecipes = async (req, res) => {
  try {
    logger.info("Processing get all recipes request...");
    
    const recipes = await Recipe.findAll({
      order: [["createdAt", "DESC"]],
    });

    // Convert markdown instructions to HTML for each recipe
    const recipesWithParsedInstructions = recipes.map((recipe) => {
      const recipeData = recipe.toJSON();
      return {
        ...recipeData,
        instructionsHtml: parseInstructions(recipeData.instructions),
      };
    });

    logger.info(`Retrieved ${recipes.length} recipes`);
    res.json(recipesWithParsedInstructions);
  } catch (error) {
    logger.error("Error fetching recipes:", error);
    res.status(500).json({ error: "Failed to fetch recipes" });
  }
};

// Get recipe by slug
exports.getRecipeBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    logger.info(`Fetching recipe with slug: ${slug}`);

    const recipe = await Recipe.findOne({ where: { slug } });

    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const recipeData = recipe.toJSON();
    const recipeWithParsedInstructions = {
      ...recipeData,
      instructionsHtml: parseInstructions(recipeData.instructions),
    };

    logger.info(`Retrieved recipe: ${recipe.name}`);
    res.json(recipeWithParsedInstructions);
  } catch (error) {
    logger.error("Error fetching recipe:", error);
    res.status(500).json({ error: "Failed to fetch recipe" });
  }
};

// Create new recipe
exports.createRecipe = async (req, res) => {
  try {
    const {
      name,
      description,
      ingredients,
      instructions,
      category,
      prepTime,
      cookTime,
      servings,
      image,
    } = req.body;

    logger.info(`Creating new recipe: ${name}`);

    // Validate required fields
    if (!name || !ingredients || !instructions || !category) {
      return res.status(400).json({
        error: "Name, ingredients, instructions, and category are required",
      });
    }

    // Convert instructions array to markdown if needed
    const markdownInstructions = instructionsToMarkdown(instructions);

    const recipe = await Recipe.create({
      name,
      description,
      ingredients,
      instructions: markdownInstructions,
      category,
      prepTime,
      cookTime,
      servings,
      image,
    });

    const recipeData = recipe.toJSON();
    const recipeWithParsedInstructions = {
      ...recipeData,
      instructionsHtml: parseInstructions(recipeData.instructions),
    };

    logger.info(`Recipe created successfully with ID: ${recipe.id}`);
    res.status(201).json(recipeWithParsedInstructions);
  } catch (error) {
    logger.error("Error creating recipe:", error);
    res.status(500).json({ error: "Failed to create recipe" });
  }
};

// Update recipe
exports.updateRecipe = async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      name,
      description,
      ingredients,
      instructions,
      category,
      prepTime,
      cookTime,
      servings,
      image,
    } = req.body;

    logger.info(`Updating recipe with slug: ${slug}`);

    const recipe = await Recipe.findOne({ where: { slug } });

    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (ingredients !== undefined) updateData.ingredients = ingredients;
    if (instructions !== undefined) {
      updateData.instructions = instructionsToMarkdown(instructions);
    }
    if (category !== undefined) updateData.category = category;
    if (prepTime !== undefined) updateData.prepTime = prepTime;
    if (cookTime !== undefined) updateData.cookTime = cookTime;
    if (servings !== undefined) updateData.servings = servings;
    if (image !== undefined) updateData.image = image;

    await recipe.update(updateData);

    const updatedRecipeData = recipe.toJSON();
    const recipeWithParsedInstructions = {
      ...updatedRecipeData,
      instructionsHtml: parseInstructions(updatedRecipeData.instructions),
    };

    logger.info(`Recipe updated successfully: ${recipe.name}`);
    res.json(recipeWithParsedInstructions);
  } catch (error) {
    logger.error("Error updating recipe:", error);
    res.status(500).json({ error: "Failed to update recipe" });
  }
};

// Delete recipe
exports.deleteRecipe = async (req, res) => {
  try {
    const { slug } = req.params;
    logger.info(`Deleting recipe with slug: ${slug}`);

    const recipe = await Recipe.findOne({ where: { slug } });

    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    await recipe.destroy();

    logger.info(`Recipe deleted successfully: ${recipe.name}`);
    res.json({ message: "Recipe deleted successfully" });
  } catch (error) {
    logger.error("Error deleting recipe:", error);
    res.status(500).json({ error: "Failed to delete recipe" });
  }
};