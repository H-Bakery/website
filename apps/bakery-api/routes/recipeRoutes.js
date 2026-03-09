const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authMiddleware')
const recipeController = require('../controllers/recipeController')

router.get('/categories', recipeController.getCategories)
router.get('/tags', recipeController.getTags)
router.get('/', recipeController.getAllRecipes)
router.get('/:slug', recipeController.getRecipeBySlug)
router.post('/', authenticate, recipeController.createRecipe)
router.put('/:slug', authenticate, recipeController.updateRecipe)
router.delete('/:slug', authenticate, recipeController.deleteRecipe)

module.exports = router
