/**
 * Cash routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { cashController } from '../controllers/cash.controller';
import {
  cashEntryCreationRules,
  cashEntryUpdateRules,
  cashEntryDeleteRules,
  getCashEntryRules,
  getCashEntriesRules,
  getCashStatsRules
} from '../validators/cash.validator';

export interface AuthMiddleware {
  authMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  requireRole: (roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
}

export interface ValidationMiddleware {
  handleValidationErrors: (req: Request, res: Response, next: NextFunction) => void;
}

export function createCashRoutes(
  auth?: AuthMiddleware, 
  validation?: ValidationMiddleware
): Router {
  const router = Router();
  
  // Use provided middleware or no-op middleware
  const authMiddleware = auth?.authMiddleware || ((req, res, next) => next());
  const requireRole = auth?.requireRole || ((roles: string[]) => (req, res, next) => next());
  const handleValidationErrors = validation?.handleValidationErrors || ((req, res, next) => next());

/**
 * @openapi
 * /api/cash:
 *   post:
 *     summary: Create a new cash entry
 *     description: Record a new daily cash total for the authenticated user
 *     tags: [Financial]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 999999.99
 *                 description: Cash amount for the day
 *                 example: 1250.50
 *               date:
 *                 type: string
 *                 format: date
 *                 pattern: '^\d{4}-\d{2}-\d{2}$'
 *                 description: Date for the cash entry (defaults to today)
 *                 example: '2025-01-15'
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional notes about the cash entry
 *                 example: 'Good sales day'
 *     responses:
 *       '201':
 *         description: Cash entry created successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Authentication required
 *       '500':
 *         description: Internal server error
 */
router.post('/', 
  authMiddleware, 
  requireRole(['admin', 'staff']),
  cashEntryCreationRules(), 
  handleValidationErrors, 
  cashController.createCashEntry.bind(cashController)
);

/**
 * @openapi
 * /api/cash:
 *   get:
 *     summary: Get cash entries
 *     description: Retrieve cash entries for the authenticated user with optional filtering
 *     tags: [Financial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Start date for filtering (YYYY-MM-DD)
 *         example: '2025-01-01'
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: End date for filtering (YYYY-MM-DD)
 *         example: '2025-01-31'
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Maximum number of entries to return
 *         example: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Number of entries to skip
 *         example: 0
 *     responses:
 *       '200':
 *         description: Successfully retrieved cash entries
 *       '401':
 *         description: Authentication required
 *       '500':
 *         description: Internal server error
 */
router.get('/', 
  authMiddleware, 
  getCashEntriesRules(), 
  handleValidationErrors, 
  cashController.getCashEntries.bind(cashController)
);

/**
 * @openapi
 * /api/cash/stats:
 *   get:
 *     summary: Get cash statistics
 *     description: Retrieve aggregated cash statistics for the authenticated user
 *     tags: [Financial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Start date for statistics calculation (YYYY-MM-DD)
 *         example: '2025-01-01'
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: End date for statistics calculation (YYYY-MM-DD)
 *         example: '2025-01-31'
 *     responses:
 *       '200':
 *         description: Successfully calculated cash statistics
 *       '401':
 *         description: Authentication required
 *       '500':
 *         description: Internal server error
 */
router.get('/stats', 
  authMiddleware, 
  getCashStatsRules(), 
  handleValidationErrors, 
  cashController.getCashStatistics.bind(cashController)
);

/**
 * @openapi
 * /api/cash/{id}:
 *   get:
 *     summary: Get cash entry by ID
 *     description: Retrieve a specific cash entry by its ID
 *     tags: [Financial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Cash entry ID
 *         example: 1
 *     responses:
 *       '200':
 *         description: Cash entry details
 *       '401':
 *         description: Authentication required
 *       '404':
 *         description: Cash entry not found
 *       '500':
 *         description: Internal server error
 */
router.get('/:id', 
  authMiddleware, 
  getCashEntryRules(), 
  handleValidationErrors, 
  cashController.getCashEntryById.bind(cashController)
);

/**
 * @openapi
 * /api/cash/{id}:
 *   put:
 *     summary: Update cash entry
 *     description: Update an existing cash entry for the authenticated user
 *     tags: [Financial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Cash entry ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 999999.99
 *                 description: Updated cash amount
 *                 example: 1350.75
 *               date:
 *                 type: string
 *                 format: date
 *                 pattern: '^\d{4}-\d{2}-\d{2}$'
 *                 description: Updated date
 *                 example: '2025-01-15'
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Updated notes
 *                 example: 'Corrected amount'
 *     responses:
 *       '200':
 *         description: Cash entry updated successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Authentication required
 *       '404':
 *         description: Cash entry not found
 *       '500':
 *         description: Internal server error
 */
router.put('/:id', 
  authMiddleware, 
  requireRole(['admin', 'staff']),
  cashEntryUpdateRules(), 
  handleValidationErrors, 
  cashController.updateCashEntry.bind(cashController)
);

/**
 * @openapi
 * /api/cash/{id}:
 *   delete:
 *     summary: Delete cash entry
 *     description: Delete a cash entry for the authenticated user
 *     tags: [Financial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Cash entry ID
 *         example: 1
 *     responses:
 *       '200':
 *         description: Cash entry deleted successfully
 *       '401':
 *         description: Authentication required
 *       '404':
 *         description: Cash entry not found
 *       '500':
 *         description: Internal server error
 */
router.delete('/:id', 
  authMiddleware, 
  requireRole(['admin']),
  cashEntryDeleteRules(), 
  handleValidationErrors, 
  cashController.deleteCashEntry.bind(cashController)
);

  return router;
}

// Export a default router without auth for backward compatibility
export default createCashRoutes();