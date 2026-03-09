const recipeParser = require('../utils/recipeParser')
const logger = require('../utils/logger')

const getAllRecipes = async (req, res) => {
  try {
    let recipes = await recipeParser.getAllRecipes()

    if (req.query.category) {
      recipes = recipes.filter((r) => r.category === req.query.category)
    }
    if (req.query.tag) {
      recipes = recipes.filter((r) => r.tags && r.tags.includes(req.query.tag))
    }
    if (req.query.difficulty) {
      recipes = recipes.filter((r) => r.difficulty === req.query.difficulty)
    }

    return res.json({
      success: true,
      count: recipes.length,
      data: recipes,
    })
  } catch (error) {
    logger.error('Recipe list retrieval error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve recipes',
    })
  }
}

const getRecipeBySlug = async (req, res) => {
  try {
    const recipe = await recipeParser.getRecipeBySlug(req.params.slug)
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found',
      })
    }
    return res.json({ success: true, data: recipe })
  } catch (error) {
    logger.error('Recipe retrieval error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve recipe',
    })
  }
}

const createRecipe = async (req, res) => {
  try {
    const { title, content } = req.body
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required',
      })
    }

    const now = new Date().toISOString()
    const recipeData = {
      ...req.body,
      created_at: now,
      updated_at: now,
    }

    const recipe = await recipeParser.createRecipe(recipeData)
    return res.status(201).json({ success: true, data: recipe })
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message,
      })
    }
    logger.error('Recipe creation error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create recipe',
    })
  }
}

const updateRecipe = async (req, res) => {
  try {
    const existing = await recipeParser.getRecipeBySlug(req.params.slug)
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found',
      })
    }

    const updateData = {
      ...existing,
      ...req.body,
      updated_at: new Date().toISOString(),
    }
    if (existing.created_at) {
      updateData.created_at = existing.created_at
    }

    const updated = await recipeParser.updateRecipe(req.params.slug, updateData)
    return res.json({ success: true, data: updated })
  } catch (error) {
    logger.error('Recipe update error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update recipe',
    })
  }
}

const deleteRecipe = async (req, res) => {
  try {
    const result = await recipeParser.deleteRecipe(req.params.slug)
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found',
      })
    }
    return res.status(204).send()
  } catch (error) {
    logger.error('Recipe deletion error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete recipe',
    })
  }
}

const getCategories = async (req, res) => {
  try {
    const recipes = await recipeParser.getAllRecipes()
    const categories = [...new Set(recipes.map((r) => r.category))]
    return res.json({ success: true, data: categories })
  } catch (error) {
    logger.error('Category retrieval error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve categories',
    })
  }
}

const getTags = async (req, res) => {
  try {
    const recipes = await recipeParser.getAllRecipes()
    const tags = new Set()
    recipes.forEach((r) => {
      if (r.tags && Array.isArray(r.tags)) {
        r.tags.forEach((t) => tags.add(t))
      }
    })
    return res.json({
      success: true,
      data: [...tags].sort(),
    })
  } catch (error) {
    logger.error('Tag retrieval error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve tags',
    })
  }
}

module.exports = {
  getAllRecipes,
  getRecipeBySlug,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getCategories,
  getTags,
}
