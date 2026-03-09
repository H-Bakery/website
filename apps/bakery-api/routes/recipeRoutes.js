const express = require('express')
const router = express.Router()
const recipeController = require('../controllers/recipeController')

router.get('/categories', recipeController.getCategories)
router.get('/tags', recipeController.getTags)
router.get('/', recipeController.getAllRecipes)
router.get('/:slug', recipeController.getRecipeBySlug)
router.post('/', recipeController.createRecipe)
router.put('/:slug', recipeController.updateRecipe)
router.delete('/:slug', recipeController.deleteRecipe)

module.exports = router
