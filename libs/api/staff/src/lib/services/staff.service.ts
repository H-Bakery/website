import bcrypt from 'bcrypt';
import { Op, FindAndCountOptions } from 'sequelize';
import {
  StaffMember,
  CreateStaffMemberInput,
  UpdateStaffMemberInput,
  StaffMemberFilters,
  PaginatedStaffResponse,
  StaffStatistics,
  STAFF_ERROR_MESSAGES
} from '../models/staff.model';
import { logger } from '@bakery/api/core';

export class StaffService {
  private User: any; // Will be injected via constructor

  constructor(UserModel: any) {
    this.User = UserModel;
  }

  /**
   * Get all staff members with pagination and filtering
   */
  async getAllStaff(filters: StaffMemberFilters): Promise<PaginatedStaffResponse> {
    const {
      search = '',
      role,
      isActive,
      page = 1,
      limit = 10
    } = filters;

    const offset = (page - 1) * limit;

    logger.info(`Fetching staff members - Page: ${page}, Limit: ${limit}, Search: ${search}`);

    // Build where clause
    const whereClause: any = {};

    if (search) {
      whereClause[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } }
      ];
    }

    if (role) {
      whereClause.role = role;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    const options: FindAndCountOptions = {
      where: whereClause,
      limit,
      offset,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    };

    const { count, rows } = await this.User.findAndCountAll(options);

    const totalPages = Math.ceil(count / limit);

    // Transform to StaffMember type
    const users = rows.map((user: any) => this.transformToStaffMember(user));

    return {
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: count,
        itemsPerPage: limit
      }
    };
  }

  /**
   * Get single staff member by ID
   */
  async getStaffById(id: number): Promise<StaffMember | null> {
    logger.info(`Fetching staff member with ID: ${id}`);

    const user = await this.User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      logger.info(`Staff member not found with ID: ${id}`);
      return null;
    }

    return this.transformToStaffMember(user);
  }

  /**
   * Create new staff member
   */
  async createStaff(data: CreateStaffMemberInput): Promise<StaffMember> {
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      role, 
      schedule, 
      isActive = true,
      password 
    } = data;

    logger.info(`Creating new staff member: ${email}`);

    // Create username from email (before @ symbol)
    const username = email.split('@')[0];

    // Hash password if provided, otherwise generate a default
    const hashedPassword = password 
      ? await bcrypt.hash(password, 10)
      : await bcrypt.hash(`${firstName.toLowerCase()}123!`, 10);

    // Create user
    const newUser = await this.User.create({
      username,
      password: hashedPassword,
      email,
      firstName,
      lastName,
      phone,
      role,
      schedule,
      isActive
    });

    logger.info(`Staff member created successfully with ID: ${newUser.id}`);

    return this.transformToStaffMember(newUser);
  }

  /**
   * Update staff member
   */
  async updateStaff(
    id: number, 
    data: UpdateStaffMemberInput, 
    currentUserId: number
  ): Promise<StaffMember | null> {
    logger.info(`Updating staff member with ID: ${id}`);

    // Find user
    const user = await this.User.findByPk(id);

    if (!user) {
      logger.info(`Staff member not found with ID: ${id}`);
      return null;
    }

    // Prevent users from modifying their own role or deactivating themselves
    if (currentUserId === id) {
      if (data.role !== undefined && data.role !== user.role) {
        throw new Error(STAFF_ERROR_MESSAGES.CANNOT_CHANGE_OWN_ROLE);
      }
      if (data.isActive !== undefined && !data.isActive) {
        throw new Error(STAFF_ERROR_MESSAGES.CANNOT_DEACTIVATE_SELF);
      }
    }

    // Build update object
    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) {
      updateData.email = data.email;
      // Update username to match new email
      updateData.username = data.email.split('@')[0];
    }
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.schedule !== undefined) updateData.schedule = data.schedule;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Hash new password if provided
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    // Update user
    await user.update(updateData);

    logger.info(`Staff member updated successfully with ID: ${id}`);

    return this.transformToStaffMember(user);
  }

  /**
   * Delete staff member (soft delete)
   */
  async deleteStaff(id: number, currentUserId: number): Promise<boolean> {
    logger.info(`Deleting staff member with ID: ${id}`);

    // Prevent users from deleting themselves
    if (currentUserId === id) {
      throw new Error(STAFF_ERROR_MESSAGES.CANNOT_DELETE_SELF);
    }

    // Find user
    const user = await this.User.findByPk(id);

    if (!user) {
      logger.info(`Staff member not found with ID: ${id}`);
      return false;
    }

    // Soft delete by setting isActive to false
    await user.update({ isActive: false });

    logger.info(`Staff member soft deleted successfully with ID: ${id}`);

    return true;
  }

  /**
   * Get staff statistics
   */
  async getStaffStatistics(): Promise<StaffStatistics> {
    const totalStaff = await this.User.count();
    const activeStaff = await this.User.count({ where: { isActive: true } });
    const inactiveStaff = totalStaff - activeStaff;

    // Get role breakdown
    const roleBreakdown: any = {};
    const roles = ['manager', 'baker', 'assistant', 'cashier', 'delivery'];
    
    for (const role of roles) {
      roleBreakdown[role] = await this.User.count({ where: { role } });
    }

    // Calculate average experience (placeholder - would need actual experience field)
    const averageExperienceMonths = 24; // Placeholder value

    return {
      totalStaff,
      activeStaff,
      inactiveStaff,
      roleBreakdown,
      averageExperienceMonths
    };
  }

  /**
   * Transform database user to StaffMember type
   */
  private transformToStaffMember(user: any): StaffMember {
    const staffMember: StaffMember = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      schedule: user.schedule,
      isActive: user.isActive,
      username: user.username,
      fullName: `${user.firstName} ${user.lastName}`,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return staffMember;
  }
}