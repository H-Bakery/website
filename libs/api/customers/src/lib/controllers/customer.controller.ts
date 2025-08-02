import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { Customer, CustomerCreationAttributes } from '../models/customer.model';
import { logger } from '@bakery/api/core';

export class CustomerController {
  /**
   * Register new customer/user
   */
  static async register(req: Request, res: Response): Promise<void> {
    logger.info('Processing registration request...');
    try {
      const { username, password, email, firstName, lastName, role } = req.body;
      logger.info(`Attempting to register user: ${username}`);

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      logger.info('Password hashed successfully');

      const newUser = await Customer.create({
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        role: role || 'user', // Default to 'user' if no role specified
        isActive: true,
        lastLogin: null
      });

      logger.info(`User created successfully with ID: ${newUser.id}`);
      res.json({ 
        message: 'User created',
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role
        }
      });
    } catch (error: any) {
      logger.error('Registration error:', error);

      if (error.name === 'SequelizeUniqueConstraintError') {
        logger.info('Registration failed: Username or email already exists');
        res.status(400).json({ error: 'Username or email already exists' });
        return;
      }
      if (error.name === 'SequelizeValidationError') {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Login customer/user
   */
  static async login(req: Request, res: Response): Promise<void> {
    logger.info('Processing login request...');
    try {
      const { username, password } = req.body;
      logger.info(`Login attempt for user: ${username}`);

      const user = await Customer.findOne({ where: { username } });

      if (!user) {
        logger.info(`Login failed: User ${username} not found`);
        res.status(400).json({ error: 'Invalid credentials' });
        return;
      }

      logger.info(`User found with ID: ${user.id}, validating password...`);
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        logger.info(`Login failed: Invalid password for user ${username}`);
        res.status(400).json({ error: 'Invalid credentials' });
        return;
      }

      logger.info(`Password valid, generating token for user ${username}`);
      
      // Update last login timestamp
      await user.updateLastLogin();
      
      const token = jwt.sign(
        { id: user.id, role: user.role }, 
        process.env['JWT_SECRET'] || 'your-secret-key'
      );
      
      logger.info('Login successful');
      res.json({ 
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Get all customers (admin only)
   */
  static async getAllCustomers(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Retrieving all customers');
      
      const customers = await Customer.findAll({
        attributes: { exclude: ['password'] },
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        count: customers.length,
        data: customers
      });
    } catch (error) {
      logger.error('Error retrieving customers:', error);
      res.status(500).json({ error: 'Failed to retrieve customers' });
    }
  }

  /**
   * Get customer by ID
   */
  static async getCustomerById(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params['id']);
      logger.info(`Retrieving customer: ${customerId}`);
      
      const customer = await Customer.findByPk(customerId, {
        attributes: { exclude: ['password'] }
      });

      if (!customer) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }

      res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      logger.error('Error retrieving customer:', error);
      res.status(500).json({ error: 'Failed to retrieve customer' });
    }
  }

  /**
   * Update customer profile
   */
  static async updateCustomer(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params['id']);
      const updateData: Partial<CustomerCreationAttributes> = req.body;
      
      logger.info(`Updating customer: ${customerId}`);

      // Remove password from update data if present (handle separately)
      delete updateData.password;

      const customer = await Customer.findByPk(customerId);
      if (!customer) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }

      await customer.update(updateData);
      
      const updatedCustomer = await Customer.findByPk(customerId, {
        attributes: { exclude: ['password'] }
      });

      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: updatedCustomer
      });
    } catch (error) {
      logger.error('Error updating customer:', error);
      res.status(500).json({ error: 'Failed to update customer' });
    }
  }

  /**
   * Update customer password
   */
  static async updatePassword(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params['id']);
      const { currentPassword, newPassword } = req.body;
      
      logger.info(`Updating password for customer: ${customerId}`);

      const customer = await Customer.findByPk(customerId);
      if (!customer) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, customer.password);
      if (!validPassword) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }

      // Hash and update new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await customer.update({ password: hashedPassword });

      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      logger.error('Error updating password:', error);
      res.status(500).json({ error: 'Failed to update password' });
    }
  }

  /**
   * Deactivate customer (soft delete)
   */
  static async deactivateCustomer(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params['id']);
      logger.info(`Deactivating customer: ${customerId}`);

      const customer = await Customer.findByPk(customerId);
      if (!customer) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }

      await customer.update({ isActive: false });

      res.json({
        success: true,
        message: 'Customer deactivated successfully'
      });
    } catch (error) {
      logger.error('Error deactivating customer:', error);
      res.status(500).json({ error: 'Failed to deactivate customer' });
    }
  }

  /**
   * Reactivate customer
   */
  static async reactivateCustomer(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params['id']);
      logger.info(`Reactivating customer: ${customerId}`);

      const customer = await Customer.findByPk(customerId);
      if (!customer) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }

      await customer.update({ isActive: true });

      res.json({
        success: true,
        message: 'Customer reactivated successfully'
      });
    } catch (error) {
      logger.error('Error reactivating customer:', error);
      res.status(500).json({ error: 'Failed to reactivate customer' });
    }
  }
}