import { Router } from 'express';
import { BakingListController } from '../controllers/baking-list.controller';
import { BakingListService } from '../services/baking-list.service';
import { bakingListValidationRules, productionPlanValidationRules } from '../validators/baking-list.validator';

/**
 * Create baking list routes with dependency injection
 */
export function createBakingListRoutes(dependencies: {
  models: {
    Order: any;
    OrderItem: any;
    Product: any;
    ProductionPlan?: any;
  };
  authMiddleware?: any;
  requireRole?: any;
  handleValidationErrors?: any;
}): Router {
  const router = Router();
  const { models, authMiddleware, requireRole, handleValidationErrors } = dependencies;

  // Initialize service and controller
  const bakingListService = new BakingListService(models);
  const bakingListController = new BakingListController(bakingListService);

  /**
   * @openapi
   * /api/baking-list:
   *   get:
   *     summary: Get baking list
   *     description: Generate a consolidated baking list showing total quantities needed for shop inventory and customer orders
   *     tags: [Production]
   *     parameters:
   *       - in: query
   *         name: date
   *         schema:
   *           type: string
   *           format: date
   *           pattern: '^\d{4}-\d{2}-\d{2}$'
   *         description: Date for baking list (YYYY-MM-DD) - defaults to today
   *         example: '2025-08-04'
   *     responses:
   *       '200':
   *         description: Successfully generated baking list
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BakingListResponse'
   *       '400':
   *         description: Invalid date format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       '404':
   *         description: No products found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get(
    '/', 
    bakingListValidationRules(),
    handleValidationErrors ? handleValidationErrors : (_req: any, _res: any, next: any) => next(),
    bakingListController.getBakingList
  );

  /**
   * @openapi
   * /api/baking-list/production/hefezopf-orders:
   *   get:
   *     summary: Get Hefezopf orders
   *     description: Retrieve quantities for all Hefezopf-related products (special yeast bread products)
   *     tags: [Production]
   *     parameters:
   *       - in: query
   *         name: date
   *         schema:
   *           type: string
   *           format: date
   *           pattern: '^\d{4}-\d{2}-\d{2}$'
   *         description: Date for orders (YYYY-MM-DD)
   *         example: '2025-08-04'
   *     responses:
   *       '200':
   *         description: Successfully retrieved Hefezopf orders
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               description: Map of product names to quantities
   *               additionalProperties:
   *                 type: integer
   *                 minimum: 0
   *               example:
   *                 "Hefezopf Plain": 15
   *                 "Hefekranz Nuss": 8
   *                 "Hefekranz Schoko": 12
   *                 "Hefekranz Pudding": 5
   *                 "Hefekranz Marzipan": 4
   *                 "Mini Hefezopf": 20
   *                 "Hefeschnecken Nuss": 30
   *                 "Hefeschnecken Schoko": 25
   *       '400':
   *         description: Invalid date format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get(
    '/production/hefezopf-orders',
    bakingListValidationRules(),
    handleValidationErrors ? handleValidationErrors : (_req: any, _res: any, next: any) => next(),
    bakingListController.getHefezopfOrders
  );

  /**
   * @openapi
   * /api/baking-list/production/plans:
   *   post:
   *     summary: Save production plan
   *     description: Save a production plan with quantities and notes for a specific date
   *     tags: [Production]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ProductionPlanRequest'
   *     responses:
   *       '200':
   *         description: Production plan saved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: 'Production plan saved successfully'
   *                 id:
   *                   type: string
   *                   description: Unique identifier for the saved plan
   *                   example: 'plan-1234567890'
   *       '400':
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ValidationError'
   *       '401':
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UnauthorizedError'
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post(
    '/production/plans',
    authMiddleware ? authMiddleware : (_req: any, _res: any, next: any) => next(),
    productionPlanValidationRules(),
    handleValidationErrors ? handleValidationErrors : (_req: any, _res: any, next: any) => next(),
    bakingListController.saveProductionPlan
  );

  /**
   * @openapi
   * /api/baking-list/production/plans:
   *   get:
   *     summary: Get production plan
   *     description: Retrieve a production plan for a specific date
   *     tags: [Production]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: date
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *           pattern: '^\d{4}-\d{2}-\d{2}$'
   *         description: Date for production plan (YYYY-MM-DD)
   *         example: '2025-08-04'
   *     responses:
   *       '200':
   *         description: Successfully retrieved production plan
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/ProductionPlan'
   *       '400':
   *         description: Invalid date or missing date parameter
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ValidationError'
   *       '401':
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UnauthorizedError'
   *       '404':
   *         description: Production plan not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundError'
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get(
    '/production/plans',
    authMiddleware ? authMiddleware : (_req: any, _res: any, next: any) => next(),
    bakingListValidationRules(),
    handleValidationErrors ? handleValidationErrors : (_req: any, _res: any, next: any) => next(),
    bakingListController.getProductionPlan
  );

  return router;
}

// Export a default router instance for backward compatibility
export const bakingListRoutes = Router();