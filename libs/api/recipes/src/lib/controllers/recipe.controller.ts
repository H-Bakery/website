/**
 * Recipe controller - HTTP request handling
 */

import { Request, Response } from 'express';
import { recipeService } from '../services/recipe.service';
import { RecipeFilters } from '../models/recipe.model';

export class RecipeController {
  /**
   * GET /api/recipes
   * Get all recipes with optional filters
   */
  static async getAllRecipes(req: Request, res: Response): Promise<void> {
    try {
      const filters: RecipeFilters = {
        category: req.query['category'] as string,
        search: req.query['search'] as string,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string) : undefined,
        offset: req.query['offset'] ? parseInt(req.query['offset'] as string) : undefined
      };

      const recipes = await recipeService.getAllRecipes(filters);

      res.json({
        success: true,
        count: recipes.length,
        data: recipes
      });
    } catch (error) {
      console.error('Error fetching recipes:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch recipes' 
      });
    }
  }

  /**
   * GET /api/recipes/categories
   * Get all recipe categories
   */
  static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await recipeService.getCategories();

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch categories' 
      });
    }
  }

  /**
   * GET /api/recipes/:slug
   * Get recipe by slug
   */
  static async getRecipeBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const recipe = await recipeService.getRecipeBySlug(slug);

      if (!recipe) {
        res.status(404).json({ 
          success: false,
          error: 'Recipe not found' 
        });
        return;
      }

      res.json({
        success: true,
        data: recipe
      });
    } catch (error) {
      console.error('Error fetching recipe:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch recipe' 
      });
    }
  }

  /**
   * GET /api/recipes/:id/scale
   * Get scaled recipe
   */
  static async scaleRecipe(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params['id']);
      const servings = parseInt(req.query['servings'] as string);

      if (isNaN(id)) {
        res.status(400).json({ 
          success: false,
          error: 'Invalid recipe ID' 
        });
        return;
      }

      if (isNaN(servings) || servings < 1) {
        res.status(400).json({ 
          success: false,
          error: 'Servings must be a positive number' 
        });
        return;
      }

      const scaledRecipe = await recipeService.scaleRecipe(id, servings);

      if (!scaledRecipe) {
        res.status(404).json({ 
          success: false,
          error: 'Recipe not found or cannot be scaled' 
        });
        return;
      }

      res.json({
        success: true,
        data: scaledRecipe
      });
    } catch (error) {
      console.error('Error scaling recipe:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to scale recipe' 
      });
    }
  }

  /**
   * POST /api/recipes
   * Create new recipe
   */
  static async createRecipe(req: Request, res: Response): Promise<void> {
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
        image
      } = req.body;

      // Validate required fields
      if (!name || !ingredients || !instructions || !category) {
        res.status(400).json({
          success: false,
          error: 'Name, ingredients, instructions, and category are required'
        });
        return;
      }

      const recipe = await recipeService.createRecipe({
        name,
        description,
        ingredients,
        instructions,
        category,
        prepTime,
        cookTime,
        servings,
        image
      });

      res.status(201).json({
        success: true,
        data: recipe
      });
    } catch (error) {
      console.error('Error creating recipe:', error);
      if (error instanceof Error && error.message.includes('Ingredient')) {
        res.status(400).json({ 
          success: false,
          error: error.message 
        });
      } else {
        res.status(500).json({ 
          success: false,
          error: 'Failed to create recipe' 
        });
      }
    }
  }

  /**
   * PUT /api/recipes/:slug
   * Update recipe
   */
  static async updateRecipe(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const updateData = req.body;

      const recipe = await recipeService.updateRecipeBySlug(slug, updateData);

      if (!recipe) {
        res.status(404).json({ 
          success: false,
          error: 'Recipe not found' 
        });
        return;
      }

      res.json({
        success: true,
        data: recipe
      });
    } catch (error) {
      console.error('Error updating recipe:', error);
      if (error instanceof Error && error.message.includes('Ingredient')) {
        res.status(400).json({ 
          success: false,
          error: error.message 
        });
      } else {
        res.status(500).json({ 
          success: false,
          error: 'Failed to update recipe' 
        });
      }
    }
  }

  /**
   * DELETE /api/recipes/:slug
   * Delete recipe
   */
  static async deleteRecipe(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const deleted = await recipeService.deleteRecipeBySlug(slug);

      if (!deleted) {
        res.status(404).json({ 
          success: false,
          error: 'Recipe not found' 
        });
        return;
      }

      res.json({
        success: true,
        message: 'Recipe deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to delete recipe' 
      });
    }
  }
}

export const recipeController = RecipeController;