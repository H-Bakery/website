import { Router } from 'express';
import { UnsoldProductController } from '../controllers/unsold-product.controller';
import { UnsoldProductService } from '../services/unsold-product.service';
import {
  unsoldProductCreationRules,
  unsoldProductUpdateRules,
  unsoldProductDeleteRules,
  unsoldProductQueryRules,
  dailyWasteReportRules
} from '../validators/unsold-product.validator';

/**
 * Create unsold product routes with dependency injection
 */
export function createUnsoldProductRoutes(dependencies: {
  models: {
    UnsoldProduct: any;
    Product: any;
    User: any;
  };
  authMiddleware: any;
  requireRole?: any;
  handleValidationErrors: any;
}): Router {
  const router = Router();
  const { models, authMiddleware, requireRole, handleValidationErrors } = dependencies;

  // Initialize service and controller
  const unsoldProductService = new UnsoldProductService(models);
  const unsoldProductController = new UnsoldProductController(unsoldProductService);

  // All routes require authentication
  router.use(authMiddleware);

  /**
   * @openapi
   * /api/unsold-products:
   *   post:
   *     summary: Record unsold products
   *     description: Record products that were not sold (waste tracking)
   *     tags: [Waste Management]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - productId
   *               - quantity
   *             properties:
   *               productId:
   *                 type: integer
   *                 minimum: 1
   *                 description: ID of the product
   *               quantity:
   *                 type: integer
   *                 minimum: 1
   *                 description: Quantity of unsold items
   *               date:
   *                 type: string
   *                 format: date
   *                 pattern: '^\d{4}-\d{2}-\d{2}$'
   *                 description: Date when products were marked as unsold (defaults to today)
   *               reason:
   *                 type: string
   *                 enum: [expired, damaged, overproduction, customer_return, quality_issue, other]
   *                 description: Reason for waste
   *               notes:
   *                 type: string
   *                 maxLength: 500
   *                 description: Additional notes
   *     responses:
   *       '200':
   *         description: Unsold product entry saved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   $ref: '#/components/schemas/UnsoldProduct'
   *       '400':
   *         $ref: '#/components/responses/ValidationError'
   *       '401':
   *         $ref: '#/components/responses/UnauthorizedError'
   *       '404':
   *         description: Product not found
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.post(
    '/',
    unsoldProductCreationRules(),
    handleValidationErrors,
    unsoldProductController.addUnsoldProduct
  );

  /**
   * @openapi
   * /api/unsold-products:
   *   get:
   *     summary: Get unsold products history
   *     description: Retrieve list of unsold products with filtering options
   *     tags: [Waste Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for filtering
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for filtering
   *       - in: query
   *         name: productId
   *         schema:
   *           type: integer
   *         description: Filter by specific product
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Filter by product category
   *       - in: query
   *         name: userId
   *         schema:
   *           type: integer
   *         description: Filter by user who recorded the entry
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Items per page
   *     responses:
   *       '200':
   *         description: Successfully retrieved unsold products
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
   *                     $ref: '#/components/schemas/UnsoldProduct'
   *                 pagination:
   *                   $ref: '#/components/schemas/Pagination'
   *       '400':
   *         $ref: '#/components/responses/ValidationError'
   *       '401':
   *         $ref: '#/components/responses/UnauthorizedError'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get(
    '/',
    unsoldProductQueryRules(),
    handleValidationErrors,
    unsoldProductController.getUnsoldProducts
  );

  /**
   * @openapi
   * /api/unsold-products/summary:
   *   get:
   *     summary: Get unsold products summary
   *     description: Get aggregated totals of unsold products by product
   *     tags: [Waste Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for filtering
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for filtering
   *     responses:
   *       '200':
   *         description: Successfully retrieved summary
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
   *                     $ref: '#/components/schemas/UnsoldProductSummary'
   *       '401':
   *         $ref: '#/components/responses/UnauthorizedError'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get(
    '/summary',
    unsoldProductController.getUnsoldProductsSummary
  );

  /**
   * @openapi
   * /api/unsold-products/daily-report:
   *   get:
   *     summary: Get daily waste report
   *     description: Get detailed waste report for a specific day
   *     tags: [Waste Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: date
   *         schema:
   *           type: string
   *           format: date
   *         description: Date for report (defaults to today)
   *     responses:
   *       '200':
   *         description: Successfully generated daily report
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/DailyWasteReport'
   *       '400':
   *         $ref: '#/components/responses/ValidationError'
   *       '401':
   *         $ref: '#/components/responses/UnauthorizedError'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get(
    '/daily-report',
    dailyWasteReportRules(),
    handleValidationErrors,
    unsoldProductController.getDailyWasteReport
  );

  /**
   * @openapi
   * /api/unsold-products/{id}:
   *   put:
   *     summary: Update unsold product entry
   *     description: Update an existing unsold product record
   *     tags: [Waste Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Unsold product entry ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               quantity:
   *                 type: integer
   *                 minimum: 1
   *               reason:
   *                 type: string
   *                 enum: [expired, damaged, overproduction, customer_return, quality_issue, other]
   *               notes:
   *                 type: string
   *                 maxLength: 500
   *     responses:
   *       '200':
   *         description: Successfully updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   $ref: '#/components/schemas/UnsoldProduct'
   *       '400':
   *         $ref: '#/components/responses/ValidationError'
   *       '401':
   *         $ref: '#/components/responses/UnauthorizedError'
   *       '404':
   *         description: Entry not found
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.put(
    '/:id',
    requireRole ? requireRole(['admin', 'manager']) : (_req: any, _res: any, next: any) => next(),
    unsoldProductUpdateRules(),
    handleValidationErrors,
    unsoldProductController.updateUnsoldProduct
  );

  /**
   * @openapi
   * /api/unsold-products/{id}:
   *   delete:
   *     summary: Delete unsold product entry
   *     description: Delete an unsold product record (admin only)
   *     tags: [Waste Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Unsold product entry ID
   *     responses:
   *       '200':
   *         description: Successfully deleted
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       '400':
   *         $ref: '#/components/responses/BadRequestError'
   *       '401':
   *         $ref: '#/components/responses/UnauthorizedError'
   *       '403':
   *         $ref: '#/components/responses/ForbiddenError'
   *       '404':
   *         description: Entry not found
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.delete(
    '/:id',
    requireRole ? requireRole(['admin']) : (_req: any, _res: any, next: any) => next(),
    unsoldProductDeleteRules(),
    handleValidationErrors,
    unsoldProductController.deleteUnsoldProduct
  );

  return router;
}

// Export a default router instance for backward compatibility
export const unsoldProductRoutes = Router();