import { Sequelize } from 'sequelize';
import { logger } from '@bakery/api/core';

export const mappingService = {
  /**
   * Map username to user ID
   * Returns user ID if found, null if not found
   */
  async mapUser(username: string, sequelize: Sequelize): Promise<number | null> {
    const User = sequelize.models['User'];
    
    const user = await User.findOne({
      where: { username },
      attributes: ['id'],
    });
    
    if (!user) {
      logger.warn(`User not found for mapping: ${username}`);
      return null;
    }
    
    return user.getDataValue('id') as number;
  },
  
  /**
   * Map product ID string to product database ID
   * Returns product ID if found, null if not found
   */
  async mapProduct(productId: string, sequelize: Sequelize): Promise<number | null> {
    const Product = sequelize.models['Product'];
    
    // First try to find by exact ID match
    let product = await Product.findByPk(productId, {
      attributes: ['id'],
    });
    
    if (!product) {
      // If not found, try to find by name (fallback)
      // This handles cases where product_id might be a name instead
      product = await Product.findOne({
        where: { name: productId },
        attributes: ['id'],
      });
    }
    
    if (!product) {
      logger.warn(`Product not found for mapping: ${productId}`);
      return null;
    }
    
    return product.getDataValue('id') as number;
  },
  
  /**
   * Create a mapping cache for bulk operations
   * This improves performance for large imports
   */
  async createMappingCache(sequelize: Sequelize) {
    const User = sequelize.models['User'];
    const Product = sequelize.models['Product'];
    
    // Load all users
    const users = await User.findAll({
      attributes: ['id', 'username'],
    });
    
    const userMap = new Map<string, number>();
    for (const user of users) {
      userMap.set(user.getDataValue('username'), user.getDataValue('id'));
    }
    
    // Load all products
    const products = await Product.findAll({
      attributes: ['id', 'name'],
    });
    
    const productMap = new Map<string, number>();
    for (const product of products) {
      // Map by ID (assuming ID is numeric but stored as string in reports)
      productMap.set(String(product.getDataValue('id')), product.getDataValue('id'));
      // Also map by name as fallback
      productMap.set(product.getDataValue('name'), product.getDataValue('id'));
    }
    
    return {
      users: userMap,
      products: productMap,
    };
  },
};