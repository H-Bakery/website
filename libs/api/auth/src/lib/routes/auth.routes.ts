/**
 * Authentication routes
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import {
  validateRegistration,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword
} from '../validators/auth.validator';

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with username, password, and profile information
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 description: Unique username for login
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: Account password
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 description: User's last name
 *               role:
 *                 type: string
 *                 enum: [admin, staff, user]
 *                 description: User role (defaults to 'user')
 *     responses:
 *       '201':
 *         description: User registered successfully
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
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       '400':
 *         description: Validation error or user already exists
 *       '500':
 *         description: Internal server error
 */
router.post('/register', validateRegistration, authController.register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user with username and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username for login
 *               password:
 *                 type: string
 *                 description: Account password
 *     responses:
 *       '200':
 *         description: Login successful
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
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       '401':
 *         description: Invalid credentials
 *       '500':
 *         description: Internal server error
 */
router.post('/login', validateLogin, authController.login);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Logout current user session
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Logout successful
 *       '500':
 *         description: Internal server error
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Get a new access token using refresh token
 *     tags: [Authentication]
 *     responses:
 *       '501':
 *         description: Not implemented
 */
router.post('/refresh', authController.refreshToken);

/**
 * @openapi
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     description: Get profile information of the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: User not found
 *       '500':
 *         description: Internal server error
 */
router.get('/profile', authMiddleware, authController.getProfile);

/**
 * @openapi
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     description: Update profile information of the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Profile updated successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: User not found
 *       '500':
 *         description: Internal server error
 */
router.put('/profile', authMiddleware, validateUpdateProfile, authController.updateProfile);

/**
 * @openapi
 * /api/auth/change-password:
 *   post:
 *     summary: Change password
 *     description: Change password for the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: New password
 *     responses:
 *       '200':
 *         description: Password changed successfully
 *       '400':
 *         description: Validation error or incorrect current password
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Internal server error
 */
router.post('/change-password', authMiddleware, validateChangePassword, authController.changePassword);

/**
 * @openapi
 * /api/auth/users:
 *   get:
 *     summary: Get all users
 *     description: Get list of all users (admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Users retrieved successfully
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
 *                     $ref: '#/components/schemas/User'
 *       '403':
 *         description: Forbidden - Admin access required
 *       '500':
 *         description: Internal server error
 */
router.get('/users', authMiddleware, requireRole(['admin']), authController.getAllUsers);

/**
 * @openapi
 * /api/auth/users/{id}:
 *   put:
 *     summary: Update user
 *     description: Update user information (admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, staff, user]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: User updated successfully
 *       '403':
 *         description: Forbidden - Admin access required
 *       '404':
 *         description: User not found
 *       '500':
 *         description: Internal server error
 */
router.put('/users/:id', authMiddleware, requireRole(['admin']), authController.updateUser);

/**
 * @openapi
 * /api/auth/users/{id}:
 *   delete:
 *     summary: Delete user
 *     description: Deactivate user account (admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       '200':
 *         description: User deactivated successfully
 *       '403':
 *         description: Forbidden - Admin access required
 *       '404':
 *         description: User not found
 *       '500':
 *         description: Internal server error
 */
router.delete('/users/:id', authMiddleware, requireRole(['admin']), authController.deleteUser);

export default router;