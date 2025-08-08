/**
 * Authentication controller
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { CreateUserInput, LoginInput, UpdateUserInput, ChangePasswordInput } from '../models/user.model';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
    // Seed admin user on initialization
    this.authService.seedAdminUser();
  }

  /**
   * Register new user
   * @route POST /api/auth/register
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const input: CreateUserInput = req.body;
      const result = await this.authService.register(input);
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          res.status(400).json({
            success: false,
            error: error.message
          });
          return;
        }
        
        if (error.message.includes('required') || error.message.includes('Invalid')) {
          res.status(400).json({
            success: false,
            error: error.message
          });
          return;
        }
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to register user'
      });
    }
  };

  /**
   * Login user
   * @route POST /api/auth/login
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const input: LoginInput = req.body;
      const result = await this.authService.login(input);
      
      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      console.error('Login error:', error);
      
      if (error instanceof Error && 
          (error.message.includes('Invalid credentials') || 
           error.message.includes('deactivated'))) {
        res.status(401).json({
          success: false,
          error: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to login'
      });
    }
  };

  /**
   * Get current user profile
   * @route GET /api/auth/profile
   */
  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      // The user ID should be attached by auth middleware
      const userId = (req as any).userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
        return;
      }
      
      const user = await this.authService.getUserById(userId);
      
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile'
      });
    }
  };

  /**
   * Update user profile
   * @route PUT /api/auth/profile
   */
  updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
        return;
      }
      
      const input: UpdateUserInput = req.body;
      
      // Users can't change their own role unless they're admin
      const userRole = (req as any).userRole;
      if (input.role && userRole !== 'admin') {
        delete input.role;
      }
      
      const user = await this.authService.updateUser(userId, input);
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });
    } catch (error) {
      console.error('Update profile error:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
        return;
      }
      
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  };

  /**
   * Change password
   * @route POST /api/auth/change-password
   */
  changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
        return;
      }
      
      const input: ChangePasswordInput = req.body;
      
      if (!input.currentPassword || !input.newPassword) {
        res.status(400).json({
          success: false,
          error: 'Current password and new password are required'
        });
        return;
      }
      
      await this.authService.changePassword(userId, input);
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      
      if (error instanceof Error && error.message.includes('incorrect')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  };

  /**
   * Get all users (admin only)
   * @route GET /api/auth/users
   */
  getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const userRole = (req as any).userRole;
      
      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Forbidden'
        });
        return;
      }
      
      const users = await this.authService.getAllUsers();
      
      res.json({
        success: true,
        count: users.length,
        data: users
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get users'
      });
    }
  };

  /**
   * Update user (admin only)
   * @route PUT /api/auth/users/:id
   */
  updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const userRole = (req as any).userRole;
      
      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Forbidden'
        });
        return;
      }
      
      const userId = parseInt(req.params['id']);
      const input: UpdateUserInput = req.body;
      
      const user = await this.authService.updateUser(userId, input);
      
      res.json({
        success: true,
        message: 'User updated successfully',
        data: user
      });
    } catch (error) {
      console.error('Update user error:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to update user'
      });
    }
  };

  /**
   * Delete user (admin only)
   * @route DELETE /api/auth/users/:id
   */
  deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const userRole = (req as any).userRole;
      
      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Forbidden'
        });
        return;
      }
      
      const userId = parseInt(req.params['id']);
      await this.authService.deleteUser(userId);
      
      res.json({
        success: true,
        message: 'User deactivated successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete user'
      });
    }
  };

  /**
   * Refresh token
   * @route POST /api/auth/refresh
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      // In a real implementation, you would validate the refresh token
      // and issue a new access token
      res.status(501).json({
        success: false,
        error: 'Not implemented'
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh token'
      });
    }
  };

  /**
   * Logout
   * @route POST /api/auth/logout
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      // In a real implementation with refresh tokens,
      // you would invalidate the refresh token here
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to logout'
      });
    }
  };
}

// Export singleton instance
export const authController = new AuthController();