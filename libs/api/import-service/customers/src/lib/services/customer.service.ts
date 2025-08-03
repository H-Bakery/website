import { Op } from 'sequelize';
import * as bcrypt from 'bcrypt';
import { Customer, CustomerCreationAttributes } from '../models/customer.model';
import { logger } from '@bakery/api/core';

interface CustomerFilters {
  role?: string;
  isActive?: boolean;
  search?: string;
}

interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  customersByRole: {
    admin: number;
    staff: number;
    user: number;
  };
}

export class CustomerService {
  /**
   * Create a new customer
   * @param customerData - The customer data
   * @returns The created customer (without password)
   */
  async createCustomer(customerData: CustomerCreationAttributes): Promise<Omit<Customer, 'password'>> {
    try {
      logger.info(`Creating new customer: ${customerData.username}`);
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(customerData.password, 10);
      
      const customer = await Customer.create({
        ...customerData,
        password: hashedPassword
      });
      
      // Return customer without password
      const { password, ...customerWithoutPassword } = customer.toJSON();
      logger.info(`Customer created successfully: ${customer.id}`);
      
      return customerWithoutPassword as Omit<Customer, 'password'>;
    } catch (error) {
      logger.error('Error creating customer:', error);
      throw error;
    }
  }

  /**
   * Get all customers with optional filtering
   * @param filters - Optional filters
   * @returns Array of customers (without passwords)
   */
  async getAllCustomers(filters: CustomerFilters = {}): Promise<Omit<Customer, 'password'>[]> {
    try {
      const where: any = {};
      
      // Apply role filter
      if (filters.role) {
        where.role = filters.role;
      }

      // Apply active status filter
      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      // Apply search filter
      if (filters.search) {
        where[Op.or] = [
          { username: { [Op.like]: `%${filters.search}%` } },
          { email: { [Op.like]: `%${filters.search}%` } },
          { firstName: { [Op.like]: `%${filters.search}%` } },
          { lastName: { [Op.like]: `%${filters.search}%` } }
        ];
      }

      logger.info(`Retrieving customers with filters: ${JSON.stringify(filters)}`);
      
      const customers = await Customer.findAll({
        where,
        attributes: { exclude: ['password'] },
        order: [['createdAt', 'DESC']]
      });

      logger.info(`Retrieved ${customers.length} customers`);
      return customers as unknown as Omit<Customer, 'password'>[];
    } catch (error) {
      logger.error('Error retrieving customers:', error);
      throw error;
    }
  }

  /**
   * Get a single customer by ID
   * @param id - The customer ID
   * @returns The customer (without password) or null
   */
  async getCustomerById(id: number): Promise<Omit<Customer, 'password'> | null> {
    try {
      logger.info(`Retrieving customer: ${id}`);
      
      const customer = await Customer.findByPk(id, {
        attributes: { exclude: ['password'] }
      });
      
      if (!customer) {
        logger.warn(`Customer not found: ${id}`);
        return null;
      }

      logger.info(`Customer retrieved: ${id}`);
      return customer as unknown as Omit<Customer, 'password'>;
    } catch (error) {
      logger.error(`Error retrieving customer ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get customer by username
   * @param username - The username
   * @returns The customer or null
   */
  async getCustomerByUsername(username: string): Promise<Customer | null> {
    try {
      logger.info(`Retrieving customer by username: ${username}`);
      
      const customer = await Customer.findOne({
        where: { username }
      });
      
      if (!customer) {
        logger.warn(`Customer not found with username: ${username}`);
        return null;
      }

      logger.info(`Customer retrieved: ${customer.id}`);
      return customer;
    } catch (error) {
      logger.error(`Error retrieving customer by username ${username}:`, error);
      throw error;
    }
  }

  /**
   * Update customer details
   * @param id - The customer ID
   * @param updateData - The data to update
   * @returns The updated customer (without password)
   */
  async updateCustomer(id: number, updateData: Partial<CustomerCreationAttributes>): Promise<Omit<Customer, 'password'> | null> {
    try {
      logger.info(`Updating customer: ${id}`);
      
      // Remove password from update data (should be handled separately)
      const { password, ...safeUpdateData } = updateData;
      
      const customer = await Customer.findByPk(id);
      if (!customer) {
        logger.warn(`Customer not found for update: ${id}`);
        return null;
      }

      await customer.update(safeUpdateData);
      
      const updatedCustomer = await Customer.findByPk(id, {
        attributes: { exclude: ['password'] }
      });
      
      logger.info(`Customer updated successfully: ${id}`);
      return updatedCustomer as unknown as Omit<Customer, 'password'>;
    } catch (error) {
      logger.error(`Error updating customer ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update customer password
   * @param id - The customer ID
   * @param currentPassword - The current password for verification
   * @param newPassword - The new password
   * @returns Success boolean
   */
  async updatePassword(id: number, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      logger.info(`Updating password for customer: ${id}`);
      
      const customer = await Customer.findByPk(id);
      if (!customer) {
        logger.warn(`Customer not found for password update: ${id}`);
        return false;
      }

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, customer.password);
      if (!validPassword) {
        logger.warn(`Invalid current password for customer: ${id}`);
        return false;
      }

      // Hash and update new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await customer.update({ password: hashedPassword });
      
      logger.info(`Password updated successfully for customer: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error updating password for customer ${id}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate customer (soft delete)
   * @param id - The customer ID
   * @returns Success boolean
   */
  async deactivateCustomer(id: number): Promise<boolean> {
    try {
      logger.info(`Deactivating customer: ${id}`);
      
      const customer = await Customer.findByPk(id);
      if (!customer) {
        logger.warn(`Customer not found for deactivation: ${id}`);
        return false;
      }

      await customer.update({ isActive: false });
      logger.info(`Customer deactivated: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error deactivating customer ${id}:`, error);
      throw error;
    }
  }

  /**
   * Reactivate customer
   * @param id - The customer ID
   * @returns Success boolean
   */
  async reactivateCustomer(id: number): Promise<boolean> {
    try {
      logger.info(`Reactivating customer: ${id}`);
      
      const customer = await Customer.findByPk(id);
      if (!customer) {
        logger.warn(`Customer not found for reactivation: ${id}`);
        return false;
      }

      await customer.update({ isActive: true });
      logger.info(`Customer reactivated: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error reactivating customer ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get customer statistics
   * @returns Customer statistics
   */
  async getCustomerStats(): Promise<CustomerStats> {
    try {
      logger.info('Retrieving customer statistics');
      
      const [totalCustomers, activeCustomers, adminCount, staffCount, userCount] = await Promise.all([
        Customer.count(),
        Customer.count({ where: { isActive: true } }),
        Customer.count({ where: { role: 'admin' } }),
        Customer.count({ where: { role: 'staff' } }),
        Customer.count({ where: { role: 'user' } })
      ]);

      const stats: CustomerStats = {
        totalCustomers,
        activeCustomers,
        inactiveCustomers: totalCustomers - activeCustomers,
        customersByRole: {
          admin: adminCount,
          staff: staffCount,
          user: userCount
        }
      };

      logger.info('Customer statistics retrieved successfully');
      return stats;
    } catch (error) {
      logger.error('Error retrieving customer statistics:', error);
      throw error;
    }
  }

  /**
   * Validate customer credentials
   * @param username - The username
   * @param password - The password
   * @returns The customer if valid, null otherwise
   */
  async validateCredentials(username: string, password: string): Promise<Customer | null> {
    try {
      logger.info(`Validating credentials for user: ${username}`);
      
      const customer = await Customer.findOne({ where: { username } });
      
      if (!customer) {
        logger.warn(`User not found: ${username}`);
        return null;
      }

      const validPassword = await bcrypt.compare(password, customer.password);
      
      if (!validPassword) {
        logger.warn(`Invalid password for user: ${username}`);
        return null;
      }

      logger.info(`Credentials validated for user: ${username}`);
      return customer;
    } catch (error) {
      logger.error(`Error validating credentials for ${username}:`, error);
      throw error;
    }
  }
}