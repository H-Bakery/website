import { Sequelize } from 'sequelize';
import { mappingService } from './mapping.service';

// Mock logger
jest.mock('@bakery/api/core', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

describe('MappingService', () => {
  let sequelize: Sequelize;
  let mockModels: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockModels = {
      User: {
        findOne: jest.fn(),
        findAll: jest.fn(),
      },
      Product: {
        findByPk: jest.fn(),
        findOne: jest.fn(),
        findAll: jest.fn(),
      },
    };

    sequelize = {
      models: mockModels,
    } as any;
  });

  describe('mapUser', () => {
    it('should return user ID when user exists', async () => {
      mockModels.User.findOne.mockResolvedValue({
        getDataValue: jest.fn().mockReturnValue(123),
      });

      const result = await mappingService.mapUser('john.doe', sequelize);

      expect(result).toBe(123);
      expect(mockModels.User.findOne).toHaveBeenCalledWith({
        where: { username: 'john.doe' },
        attributes: ['id'],
      });
    });

    it('should return null when user not found', async () => {
      mockModels.User.findOne.mockResolvedValue(null);

      const result = await mappingService.mapUser('unknown.user', sequelize);

      expect(result).toBeNull();
      expect(mockModels.User.findOne).toHaveBeenCalledWith({
        where: { username: 'unknown.user' },
        attributes: ['id'],
      });
    });
  });

  describe('mapProduct', () => {
    it('should return product ID when found by primary key', async () => {
      mockModels.Product.findByPk.mockResolvedValue({
        getDataValue: jest.fn().mockReturnValue(456),
      });

      const result = await mappingService.mapProduct('456', sequelize);

      expect(result).toBe(456);
      expect(mockModels.Product.findByPk).toHaveBeenCalledWith('456', {
        attributes: ['id'],
      });
      expect(mockModels.Product.findOne).not.toHaveBeenCalled();
    });

    it('should fallback to name search when not found by ID', async () => {
      mockModels.Product.findByPk.mockResolvedValue(null);
      mockModels.Product.findOne.mockResolvedValue({
        getDataValue: jest.fn().mockReturnValue(789),
      });

      const result = await mappingService.mapProduct('Croissant', sequelize);

      expect(result).toBe(789);
      expect(mockModels.Product.findByPk).toHaveBeenCalledWith('Croissant', {
        attributes: ['id'],
      });
      expect(mockModels.Product.findOne).toHaveBeenCalledWith({
        where: { name: 'Croissant' },
        attributes: ['id'],
      });
    });

    it('should return null when product not found by ID or name', async () => {
      mockModels.Product.findByPk.mockResolvedValue(null);
      mockModels.Product.findOne.mockResolvedValue(null);

      const result = await mappingService.mapProduct('unknown-product', sequelize);

      expect(result).toBeNull();
    });
  });

  describe('createMappingCache', () => {
    it('should create cache maps for users and products', async () => {
      // Mock user data
      const mockUsers = [
        {
          getDataValue: jest.fn((field: string) => 
            field === 'id' ? 1 : 'john.doe'
          ),
        },
        {
          getDataValue: jest.fn((field: string) => 
            field === 'id' ? 2 : 'jane.smith'
          ),
        },
      ];

      // Mock product data
      const mockProducts = [
        {
          getDataValue: jest.fn((field: string) => 
            field === 'id' ? 10 : 'Croissant'
          ),
        },
        {
          getDataValue: jest.fn((field: string) => 
            field === 'id' ? 20 : 'Baguette'
          ),
        },
      ];

      mockModels.User.findAll.mockResolvedValue(mockUsers);
      mockModels.Product.findAll.mockResolvedValue(mockProducts);

      const cache = await mappingService.createMappingCache(sequelize);

      // Verify user cache
      expect(cache.users.get('john.doe')).toBe(1);
      expect(cache.users.get('jane.smith')).toBe(2);

      // Verify product cache (by ID and name)
      expect(cache.products.get('10')).toBe(10);
      expect(cache.products.get('20')).toBe(20);
      expect(cache.products.get('Croissant')).toBe(10);
      expect(cache.products.get('Baguette')).toBe(20);

      // Verify queries
      expect(mockModels.User.findAll).toHaveBeenCalledWith({
        attributes: ['id', 'username'],
      });
      expect(mockModels.Product.findAll).toHaveBeenCalledWith({
        attributes: ['id', 'name'],
      });
    });
  });
});