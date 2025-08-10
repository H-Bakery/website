import { Request, Response } from 'express';
import { StaffService } from '../services/staff.service';
import { 
  StaffMemberFilters,
  CreateStaffMemberInput,
  UpdateStaffMemberInput,
  STAFF_ERROR_MESSAGES 
} from '../models/staff.model';
import { logger } from '@bakery/api/core';

export class StaffController {
  constructor(private staffService: StaffService) {}

  /**
   * Get all staff members with pagination
   */
  getAllStaff = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: StaffMemberFilters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        search: req.query.search as string,
        role: req.query.role as any,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined
      };

      const result = await this.staffService.getAllStaff(filters);

      res.json(result);
    } catch (error) {
      logger.error('Error fetching staff members:', error);
      res.status(500).json({ 
        success: false,
        error: STAFF_ERROR_MESSAGES.DATABASE_ERROR 
      });
    }
  };

  /**
   * Get single staff member by ID
   */
  getStaffById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const staffId = parseInt(id);

      if (isNaN(staffId)) {
        res.status(400).json({ 
          success: false,
          error: 'Invalid staff ID' 
        });
        return;
      }

      const staffMember = await this.staffService.getStaffById(staffId);

      if (!staffMember) {
        res.status(404).json({ 
          success: false,
          error: STAFF_ERROR_MESSAGES.STAFF_NOT_FOUND 
        });
        return;
      }

      res.json({
        success: true,
        data: staffMember
      });
    } catch (error) {
      logger.error('Error fetching staff member:', error);
      res.status(500).json({ 
        success: false,
        error: STAFF_ERROR_MESSAGES.DATABASE_ERROR 
      });
    }
  };

  /**
   * Create new staff member
   */
  createStaff = async (req: Request, res: Response): Promise<void> => {
    try {
      const input: CreateStaffMemberInput = req.body;

      const newStaffMember = await this.staffService.createStaff(input);

      res.status(201).json({
        success: true,
        message: 'Staff member created successfully',
        data: newStaffMember
      });
    } catch (error: any) {
      logger.error('Error creating staff member:', error);

      if (error.name === 'SequelizeUniqueConstraintError') {
        res.status(400).json({ 
          success: false,
          error: 'Email already exists' 
        });
        return;
      }

      if (error.name === 'SequelizeValidationError') {
        res.status(400).json({ 
          success: false,
          error: error.errors[0].message 
        });
        return;
      }

      res.status(500).json({ 
        success: false,
        error: STAFF_ERROR_MESSAGES.DATABASE_ERROR 
      });
    }
  };

  /**
   * Update staff member
   */
  updateStaff = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const staffId = parseInt(id);
      const currentUserId = (req as any).userId; // From auth middleware
      const input: UpdateStaffMemberInput = req.body;

      if (isNaN(staffId)) {
        res.status(400).json({ 
          success: false,
          error: 'Invalid staff ID' 
        });
        return;
      }

      const updatedStaffMember = await this.staffService.updateStaff(
        staffId, 
        input, 
        currentUserId
      );

      if (!updatedStaffMember) {
        res.status(404).json({ 
          success: false,
          error: STAFF_ERROR_MESSAGES.STAFF_NOT_FOUND 
        });
        return;
      }

      res.json({
        success: true,
        message: 'Staff member updated successfully',
        data: updatedStaffMember
      });
    } catch (error: any) {
      logger.error('Error updating staff member:', error);

      if (error.message === STAFF_ERROR_MESSAGES.CANNOT_CHANGE_OWN_ROLE ||
          error.message === STAFF_ERROR_MESSAGES.CANNOT_DEACTIVATE_SELF) {
        res.status(400).json({ 
          success: false,
          error: error.message 
        });
        return;
      }

      if (error.name === 'SequelizeUniqueConstraintError') {
        res.status(400).json({ 
          success: false,
          error: 'Email already exists' 
        });
        return;
      }

      if (error.name === 'SequelizeValidationError') {
        res.status(400).json({ 
          success: false,
          error: error.errors[0].message 
        });
        return;
      }

      res.status(500).json({ 
        success: false,
        error: STAFF_ERROR_MESSAGES.DATABASE_ERROR 
      });
    }
  };

  /**
   * Delete staff member (soft delete)
   */
  deleteStaff = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const staffId = parseInt(id);
      const currentUserId = (req as any).userId; // From auth middleware

      if (isNaN(staffId)) {
        res.status(400).json({ 
          success: false,
          error: 'Invalid staff ID' 
        });
        return;
      }

      const deleted = await this.staffService.deleteStaff(staffId, currentUserId);

      if (!deleted) {
        res.status(404).json({ 
          success: false,
          error: STAFF_ERROR_MESSAGES.STAFF_NOT_FOUND 
        });
        return;
      }

      res.json({
        success: true,
        message: 'Staff member deleted successfully'
      });
    } catch (error: any) {
      logger.error('Error deleting staff member:', error);

      if (error.message === STAFF_ERROR_MESSAGES.CANNOT_DELETE_SELF) {
        res.status(400).json({ 
          success: false,
          error: error.message 
        });
        return;
      }

      res.status(500).json({ 
        success: false,
        error: STAFF_ERROR_MESSAGES.DATABASE_ERROR 
      });
    }
  };

  /**
   * Get staff statistics
   */
  getStaffStatistics = async (_req: Request, res: Response): Promise<void> => {
    try {
      const statistics = await this.staffService.getStaffStatistics();

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Error fetching staff statistics:', error);
      res.status(500).json({ 
        success: false,
        error: STAFF_ERROR_MESSAGES.DATABASE_ERROR 
      });
    }
  };
}