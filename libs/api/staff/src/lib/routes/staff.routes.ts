import { Router } from 'express';
import { StaffController } from '../controllers/staff.controller';
import { StaffService } from '../services/staff.service';
import {
  staffCreationRules,
  staffUpdateRules,
  staffDeleteRules,
  staffGetByIdRules
} from '../validators/staff.validator';

/**
 * Create staff routes with dependency injection
 */
export function createStaffRoutes(dependencies: {
  UserModel: any;
  authMiddleware: any;
  requireRole: any;
  handleValidationErrors: any;
}): Router {
  const router = Router();
  const { UserModel, authMiddleware, requireRole, handleValidationErrors } = dependencies;

  // Initialize service and controller
  const staffService = new StaffService(UserModel);
  const staffController = new StaffController(staffService);

  // All staff routes require authentication and admin/manager role
  router.use(authMiddleware);
  router.use(requireRole(['admin', 'manager']));

  /**
   * @openapi
   * /api/staff:
   *   get:
   *     summary: Get all staff members
   *     description: Retrieve a paginated list of staff members with optional filtering
   *     tags: [Staff]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number for pagination
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 10
   *         description: Number of items per page
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term for name, email, or username
   *       - in: query
   *         name: role
   *         schema:
   *           type: string
   *           enum: [manager, baker, assistant, cashier, delivery]
   *         description: Filter by role
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *     responses:
   *       '200':
   *         description: Successfully retrieved staff members
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedStaffResponse'
   *       '401':
   *         $ref: '#/components/responses/UnauthorizedError'
   *       '403':
   *         $ref: '#/components/responses/ForbiddenError'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get('/', staffController.getAllStaff);

  /**
   * @openapi
   * /api/staff/statistics:
   *   get:
   *     summary: Get staff statistics
   *     description: Retrieve statistical information about staff members
   *     tags: [Staff]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Successfully retrieved staff statistics
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StaffStatistics'
   *       '401':
   *         $ref: '#/components/responses/UnauthorizedError'
   *       '403':
   *         $ref: '#/components/responses/ForbiddenError'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get('/statistics', staffController.getStaffStatistics);

  /**
   * @openapi
   * /api/staff/{id}:
   *   get:
   *     summary: Get staff member by ID
   *     description: Retrieve detailed information about a specific staff member
   *     tags: [Staff]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: Staff member ID
   *     responses:
   *       '200':
   *         description: Successfully retrieved staff member
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StaffMember'
   *       '400':
   *         $ref: '#/components/responses/BadRequestError'
   *       '401':
   *         $ref: '#/components/responses/UnauthorizedError'
   *       '403':
   *         $ref: '#/components/responses/ForbiddenError'
   *       '404':
   *         $ref: '#/components/responses/NotFoundError'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get('/:id', staffGetByIdRules(), handleValidationErrors, staffController.getStaffById);

  /**
   * @openapi
   * /api/staff:
   *   post:
   *     summary: Create a new staff member
   *     description: Create a new staff member account with specified role and details
   *     tags: [Staff]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateStaffMemberInput'
   *     responses:
   *       '201':
   *         description: Staff member created successfully
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
   *                   example: 'Staff member created successfully'
   *                 data:
   *                   $ref: '#/components/schemas/StaffMember'
   *       '400':
   *         $ref: '#/components/responses/ValidationError'
   *       '401':
   *         $ref: '#/components/responses/UnauthorizedError'
   *       '403':
   *         $ref: '#/components/responses/ForbiddenError'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.post('/', staffCreationRules(), handleValidationErrors, staffController.createStaff);

  /**
   * @openapi
   * /api/staff/{id}:
   *   put:
   *     summary: Update staff member
   *     description: Update an existing staff member's information
   *     tags: [Staff]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: Staff member ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateStaffMemberInput'
   *     responses:
   *       '200':
   *         description: Staff member updated successfully
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
   *                   example: 'Staff member updated successfully'
   *                 data:
   *                   $ref: '#/components/schemas/StaffMember'
   *       '400':
   *         $ref: '#/components/responses/ValidationError'
   *       '401':
   *         $ref: '#/components/responses/UnauthorizedError'
   *       '403':
   *         $ref: '#/components/responses/ForbiddenError'
   *       '404':
   *         $ref: '#/components/responses/NotFoundError'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.put('/:id', staffUpdateRules(), handleValidationErrors, staffController.updateStaff);

  /**
   * @openapi
   * /api/staff/{id}:
   *   delete:
   *     summary: Delete staff member
   *     description: Delete a staff member account (soft delete - sets isActive to false)
   *     tags: [Staff]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: Staff member ID
   *     responses:
   *       '200':
   *         description: Staff member deleted successfully
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
   *                   example: 'Staff member deleted successfully'
   *       '400':
   *         $ref: '#/components/responses/BadRequestError'
   *       '401':
   *         $ref: '#/components/responses/UnauthorizedError'
   *       '403':
   *         $ref: '#/components/responses/ForbiddenError'
   *       '404':
   *         $ref: '#/components/responses/NotFoundError'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.delete('/:id', staffDeleteRules(), handleValidationErrors, staffController.deleteStaff);

  return router;
}

// Export a default router instance for backward compatibility
export const staffRoutes = Router();