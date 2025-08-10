/**
 * Product routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { productController } from '../controllers/product.controller';

export interface AuthMiddleware {
  authMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  requireRole: (roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
}

export function createProductRoutes(auth?: AuthMiddleware): Router {
  const router = Router();
  
  // Use provided auth middleware or no-op middleware
  const authMiddleware = auth?.authMiddleware || ((req, res, next) => next());
  const requireRole = auth?.requireRole || ((roles: string[]) => (req, res, next) => next());

/**
 * @openapi
 * /api/products:
 *   get:
 *     summary: Get all products
 *     description: Get list of all products with optional filters
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name and description
 *     responses:
 *       '200':
 *         description: Products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *       '500':
 *         description: Internal server error
 */
router.get('/', productController.getAllProducts);

/**
 * @openapi
 * /api/products/active:
 *   get:
 *     summary: Get active products
 *     description: Get list of all active products
 *     tags: [Products]
 *     responses:
 *       '200':
 *         description: Active products retrieved successfully
 *       '500':
 *         description: Internal server error
 */
router.get('/active', productController.getActiveProducts);

/**
 * @openapi
 * /api/products/categories:
 *   get:
 *     summary: Get product categories
 *     description: Get list of all product categories
 *     tags: [Products]
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
 *                     type: string
 *       '500':
 *         description: Internal server error
 */
router.get('/categories', productController.getCategories);

/**
 * @openapi
 * /api/products/low-stock:
 *   get:
 *     summary: Get low stock products
 *     description: Get products with stock below threshold
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Stock threshold
 *     responses:
 *       '200':
 *         description: Low stock products retrieved successfully
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Internal server error
 */
router.get('/low-stock', authMiddleware, productController.getLowStockProducts);

/**
 * @openapi
 * /api/products/category/{category}:
 *   get:
 *     summary: Get products by category
 *     description: Get all products in a specific category
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *         description: Product category
 *     responses:
 *       '200':
 *         description: Products retrieved successfully
 *       '500':
 *         description: Internal server error
 */
router.get('/category/:category', productController.getProductsByCategory);

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     description: Get specific product details
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       '200':
 *         description: Product retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       '404':
 *         description: Product not found
 *       '500':
 *         description: Internal server error
 */
router.get('/:id', productController.getProductById);

/**
 * @openapi
 * /api/products/{id}/stats:
 *   get:
 *     summary: Get product with statistics
 *     description: Get product details with sales statistics
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       '200':
 *         description: Product stats retrieved successfully
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Product not found
 *       '500':
 *         description: Internal server error
 */
router.get('/:id/stats', authMiddleware, productController.getProductWithStats);

/**
 * @openapi
 * /api/products:
 *   post:
 *     summary: Create new product
 *     description: Create a new product (admin only)
 *     tags: [Products]
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
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 description: Product name
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 description: Product price
 *               stock:
 *                 type: integer
 *                 minimum: 0
 *                 description: Initial stock
 *               dailyTarget:
 *                 type: integer
 *                 minimum: 0
 *                 description: Daily production target
 *               description:
 *                 type: string
 *                 description: Product description
 *               image:
 *                 type: string
 *                 description: Product image URL
 *               category:
 *                 type: string
 *                 description: Product category
 *     responses:
 *       '201':
 *         description: Product created successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Admin access required
 *       '500':
 *         description: Internal server error
 */
router.post('/', authMiddleware, requireRole(['admin', 'staff']), productController.createProduct);

/**
 * @openapi
 * /api/products/{id}:
 *   put:
 *     summary: Update product
 *     description: Update product information (admin/staff only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *                 minimum: 0
 *               stock:
 *                 type: integer
 *                 minimum: 0
 *               dailyTarget:
 *                 type: integer
 *                 minimum: 0
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               image:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Product updated successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Product not found
 *       '500':
 *         description: Internal server error
 */
router.put('/:id', authMiddleware, requireRole(['admin', 'staff']), productController.updateProduct);

/**
 * @openapi
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product
 *     description: Deactivate product (admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       '200':
 *         description: Product deactivated successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Admin access required
 *       '404':
 *         description: Product not found
 *       '500':
 *         description: Internal server error
 */
router.delete('/:id', authMiddleware, requireRole(['admin']), productController.deleteProduct);

/**
 * @openapi
 * /api/products/{id}/stock:
 *   patch:
 *     summary: Adjust product stock
 *     description: Adjust product stock level (staff only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *               - type
 *             properties:
 *               quantity:
 *                 type: integer
 *                 description: Quantity to adjust
 *               type:
 *                 type: string
 *                 enum: [add, subtract, set]
 *                 description: Type of adjustment
 *               reason:
 *                 type: string
 *                 description: Reason for adjustment
 *     responses:
 *       '200':
 *         description: Stock adjusted successfully
 *       '400':
 *         description: Validation error or insufficient stock
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Product not found
 *       '500':
 *         description: Internal server error
 */
router.patch('/:id/stock', authMiddleware, requireRole(['admin', 'staff']), productController.adjustStock);

  return router;
}

// Export a default router without auth for backward compatibility
export default createProductRoutes();