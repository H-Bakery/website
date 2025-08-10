/**
 * Recipe routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { recipeController } from '../controllers/recipe.controller';

export interface AuthMiddleware {
  authMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  requireRole: (roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
}

export function createRecipeRoutes(auth?: AuthMiddleware): Router {
  const router = Router();
  
  // Use provided auth middleware or no-op middleware
  const authMiddleware = auth?.authMiddleware || ((req, res, next) => next());
  const requireRole = auth?.requireRole || ((roles: string[]) => (req, res, next) => next());

/**
 * @openapi
 * /api/recipes:
 *   get:
 *     summary: Get all recipes
 *     description: Retrieve a list of all public recipes
 *     tags: [Recipes]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name and description
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Offset for pagination
 *     responses:
 *       '200':
 *         description: List of recipes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Recipe'
 *       '500':
 *         description: Internal server error
 */
router.get('/', recipeController.getAllRecipes);

/**
 * @openapi
 * /api/recipes/categories:
 *   get:
 *     summary: Get recipe categories
 *     description: Get list of all recipe categories with counts
 *     tags: [Recipes]
 *     responses:
 *       '200':
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       displayName:
 *                         type: string
 *                       count:
 *                         type: integer
 *       '500':
 *         description: Internal server error
 */
router.get('/categories', recipeController.getCategories);

/**
 * @openapi
 * /api/recipes/{slug}:
 *   get:
 *     summary: Get recipe by slug
 *     description: Retrieve a specific recipe by its URL slug
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipe URL slug
 *         example: klassisches-sauerteigbrot
 *     responses:
 *       '200':
 *         description: Recipe details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Recipe'
 *       '404':
 *         description: Recipe not found
 *       '500':
 *         description: Internal server error
 */
router.get('/:slug', recipeController.getRecipeBySlug);

/**
 * @openapi
 * /api/recipes/{id}/scale:
 *   get:
 *     summary: Get scaled recipe
 *     description: Get recipe with ingredients scaled to different servings
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Recipe ID
 *       - in: query
 *         name: servings
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Target number of servings
 *     responses:
 *       '200':
 *         description: Scaled recipe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Recipe'
 *       '400':
 *         description: Invalid parameters
 *       '404':
 *         description: Recipe not found or cannot be scaled
 *       '500':
 *         description: Internal server error
 */
router.get('/:id/scale', recipeController.scaleRecipe);

/**
 * @openapi
 * /api/recipes:
 *   post:
 *     summary: Create a new recipe
 *     description: Add a new recipe to the system (authentication required)
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - ingredients
 *               - instructions
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 description: Recipe name
 *               description:
 *                 type: string
 *                 description: Recipe description
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - quantity
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: string
 *                     unit:
 *                       type: string
 *                     notes:
 *                       type: string
 *               instructions:
 *                 oneOf:
 *                   - type: string
 *                     description: Markdown formatted instructions
 *                   - type: array
 *                     items:
 *                       type: string
 *                     description: Array of instruction steps
 *               category:
 *                 type: string
 *                 enum: [bread, pastries, cakes, cookies, seasonal, special]
 *               prepTime:
 *                 type: string
 *               cookTime:
 *                 type: string
 *               servings:
 *                 type: integer
 *                 minimum: 1
 *               image:
 *                 type: string
 *     responses:
 *       '201':
 *         description: Recipe created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Recipe'
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Authentication required
 *       '403':
 *         description: Forbidden - Admin access required
 *       '500':
 *         description: Internal server error
 */
router.post('/', authMiddleware, requireRole(['admin', 'staff']), recipeController.createRecipe);

/**
 * @openapi
 * /api/recipes/{slug}:
 *   put:
 *     summary: Update recipe
 *     description: Update an existing recipe (authentication required)
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipe URL slug
 *         example: klassisches-sauerteigbrot
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: string
 *                     unit:
 *                       type: string
 *                     notes:
 *                       type: string
 *               instructions:
 *                 oneOf:
 *                   - type: string
 *                   - type: array
 *                     items:
 *                       type: string
 *               category:
 *                 type: string
 *               prepTime:
 *                 type: string
 *               cookTime:
 *                 type: string
 *               servings:
 *                 type: integer
 *               image:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Recipe updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Recipe'
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Authentication required
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Recipe not found
 *       '500':
 *         description: Internal server error
 */
router.put('/:slug', authMiddleware, requireRole(['admin', 'staff']), recipeController.updateRecipe);

/**
 * @openapi
 * /api/recipes/{slug}:
 *   delete:
 *     summary: Delete recipe
 *     description: Remove a recipe from the system (authentication required)
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipe URL slug
 *         example: klassisches-sauerteigbrot
 *     responses:
 *       '200':
 *         description: Recipe deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       '401':
 *         description: Authentication required
 *       '403':
 *         description: Forbidden - Admin access required
 *       '404':
 *         description: Recipe not found
 *       '500':
 *         description: Internal server error
 */
router.delete('/:slug', authMiddleware, requireRole(['admin']), recipeController.deleteRecipe);

  return router;
}

// Export a default router without auth for backward compatibility
export default createRecipeRoutes();