import { Inventory, Product, StockAdjustment } from '../../models'
import inventoryService from '../inventory.service'
import { sequelize } from '@bakery/api/database'

// Mock the models
jest.mock('../../models')
jest.mock('@bakery/api/database')

describe('InventoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('findAll', () => {
    it('should return paginated inventory items', async () => {
      const mockInventoryItems = [
        { id: 1, productId: 1, quantity: 100, minimumQuantity: 20 },
        { id: 2, productId: 2, quantity: 50, minimumQuantity: 10 },
      ]

      ;(Inventory.findAndCountAll as jest.Mock).mockResolvedValue({
        count: 2,
        rows: mockInventoryItems,
      })

      const result = await inventoryService.findAll({}, { page: 1, limit: 20 })

      expect(result).toEqual({
        items: mockInventoryItems,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      })

      expect(Inventory.findAndCountAll).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Array),
        limit: 20,
        offset: 0,
        order: [['id', 'ASC']],
      })
    })

    it('should filter by category', async () => {
      ;(Inventory.findAndCountAll as jest.Mock).mockResolvedValue({
        count: 1,
        rows: [{ id: 1, category: 'Rohstoffe' }],
      })

      await inventoryService.findAll({ category: 'Rohstoffe' })

      expect(Inventory.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'Rohstoffe' },
        })
      )
    })

    it('should filter low stock items', async () => {
      ;(Inventory.findAndCountAll as jest.Mock).mockResolvedValue({
        count: 0,
        rows: [],
      })

      await inventoryService.findAll({ lowStock: true })

      expect(Inventory.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Object),
        })
      )
    })
  })

  describe('findById', () => {
    it('should return inventory item with associations', async () => {
      const mockItem = {
        id: 1,
        productId: 1,
        quantity: 100,
        product: { id: 1, name: 'Flour' },
        adjustments: [],
      }

      ;(Inventory.findByPk as jest.Mock).mockResolvedValue(mockItem)

      const result = await inventoryService.findById(1)

      expect(result).toEqual(mockItem)
      expect(Inventory.findByPk).toHaveBeenCalledWith(1, {
        include: expect.any(Array),
      })
    })

    it('should throw error if item not found', async () => {
      ;(Inventory.findByPk as jest.Mock).mockResolvedValue(null)

      await expect(inventoryService.findById(999)).rejects.toThrow(
        'Inventory item not found'
      )
    })
  })

  describe('create', () => {
    it('should create inventory item with initial adjustment', async () => {
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn(),
      }
      ;(sequelize.transaction as jest.Mock).mockResolvedValue(mockTransaction)
      ;(Inventory.findOne as jest.Mock).mockResolvedValue(null)
      ;(Product.findByPk as jest.Mock).mockResolvedValue({ id: 1 })
      ;(Inventory.create as jest.Mock).mockResolvedValue({
        id: 1,
        quantity: 100,
      })
      ;(StockAdjustment.create as jest.Mock).mockResolvedValue({})

      const data = {
        productId: 1,
        quantity: 100,
        minimumQuantity: 20,
      }

      await inventoryService.create(data)

      expect(Inventory.create).toHaveBeenCalledWith(data, {
        transaction: mockTransaction,
      })
      expect(StockAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inventoryId: 1,
          adjustmentType: 'set',
          quantity: 100,
          previousQuantity: 0,
          newQuantity: 100,
          reason: 'Initial inventory setup',
        }),
        { transaction: mockTransaction }
      )
      expect(mockTransaction.commit).toHaveBeenCalled()
    })

    it('should rollback on duplicate product', async () => {
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn(),
      }
      ;(sequelize.transaction as jest.Mock).mockResolvedValue(mockTransaction)
      ;(Inventory.findOne as jest.Mock).mockResolvedValue({ id: 1 })

      await expect(
        inventoryService.create({ productId: 1, minimumQuantity: 20 })
      ).rejects.toThrow('Product already has inventory record')

      expect(mockTransaction.rollback).toHaveBeenCalled()
    })
  })

  describe('adjustStock', () => {
    it('should increase stock correctly', async () => {
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn(),
      }
      const mockInventory = {
        id: 1,
        quantity: 100,
        update: jest.fn(),
      }

      ;(sequelize.transaction as jest.Mock).mockResolvedValue(mockTransaction)
      ;(Inventory.findByPk as jest.Mock).mockResolvedValue(mockInventory)
      ;(StockAdjustment.create as jest.Mock).mockResolvedValue({})

      await inventoryService.adjustStock(1, {
        adjustmentType: 'increase',
        quantity: 50,
        reason: 'New delivery',
      })

      expect(mockInventory.update).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 150 }),
        { transaction: mockTransaction }
      )
      expect(StockAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inventoryId: 1,
          adjustmentType: 'increase',
          quantity: 50,
          previousQuantity: 100,
          newQuantity: 150,
          reason: 'New delivery',
        }),
        { transaction: mockTransaction }
      )
      expect(mockTransaction.commit).toHaveBeenCalled()
    })

    it('should prevent negative stock on decrease', async () => {
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn(),
      }
      const mockInventory = {
        id: 1,
        quantity: 30,
      }

      ;(sequelize.transaction as jest.Mock).mockResolvedValue(mockTransaction)
      ;(Inventory.findByPk as jest.Mock).mockResolvedValue(mockInventory)

      await expect(
        inventoryService.adjustStock(1, {
          adjustmentType: 'decrease',
          quantity: 50,
          reason: 'Sale',
        })
      ).rejects.toThrow('Insufficient stock for adjustment')

      expect(mockTransaction.rollback).toHaveBeenCalled()
    })
  })

  describe('getLowStockItems', () => {
    it('should return items below minimum or reorder point', async () => {
      const mockLowStockItems = [
        { id: 1, quantity: 5, minimumQuantity: 10 },
        { id: 2, quantity: 15, reorderPoint: 20 },
      ]

      ;(Inventory.findAll as jest.Mock).mockResolvedValue(mockLowStockItems)

      const result = await inventoryService.getLowStockItems()

      expect(result).toEqual(mockLowStockItems)
      expect(Inventory.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Object),
          include: expect.any(Array),
          order: [['quantity', 'ASC']],
        })
      )
    })
  })
})
