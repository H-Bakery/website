import { Inventory, Product, StockAdjustment } from '../models'
import { Op, WhereOptions, Transaction } from 'sequelize'
import { sequelize } from '@bakery/api/database'

export interface InventoryFilters {
  category?: string
  lowStock?: boolean
  search?: string
  supplier?: string
}

export interface StockAdjustmentData {
  adjustmentType: 'increase' | 'decrease' | 'set'
  quantity: number
  reason: string
  performedBy?: number
  notes?: string
}

export interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

class InventoryService {
  async findAll(
    filters: InventoryFilters = {},
    pagination: PaginationOptions = {}
  ) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'id',
      sortOrder = 'ASC',
    } = pagination
    const offset = (page - 1) * limit

    const where: WhereOptions = {}

    if (filters.category) {
      where.category = filters.category
    }

    if (filters.supplier) {
      where.supplier = filters.supplier
    }

    if (filters.search) {
      where[Op.or] = [
        { '$product.name$': { [Op.like]: `%${filters.search}%` } },
        { location: { [Op.like]: `%${filters.search}%` } },
        { supplier: { [Op.like]: `%${filters.search}%` } },
      ]
    }

    if (filters.lowStock) {
      where[Op.or] = [
        sequelize.where(
          sequelize.col('quantity'),
          '<=',
          sequelize.col('minimumQuantity')
        ),
        sequelize.where(
          sequelize.col('quantity'),
          '<=',
          sequelize.col('reorderPoint')
        ),
      ]
    }

    const { count, rows } = await Inventory.findAndCountAll({
      where,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price', 'category'],
        },
      ],
      limit,
      offset,
      order: [[sortBy, sortOrder]],
    })

    return {
      items: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    }
  }

  async findById(id: number) {
    const inventory = await Inventory.findByPk(id, {
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price', 'category', 'description'],
        },
        {
          model: StockAdjustment,
          as: 'adjustments',
          limit: 10,
          order: [['createdAt', 'DESC']],
        },
      ],
    })

    if (!inventory) {
      throw new Error('Inventory item not found')
    }

    return inventory
  }

  async create(data: any) {
    const transaction = await sequelize.transaction()

    try {
      // Check if product already has inventory
      const existing = await Inventory.findOne({
        where: { productId: data.productId },
        transaction,
      })

      if (existing) {
        await transaction.rollback()
        throw new Error('Product already has inventory record')
      }

      // Verify product exists
      const product = await Product.findByPk(data.productId, { transaction })
      if (!product) {
        await transaction.rollback()
        throw new Error('Product not found')
      }

      // Create inventory
      const inventory = await Inventory.create(data, { transaction })

      // Create initial stock adjustment record
      await StockAdjustment.create(
        {
          inventoryId: inventory.id,
          adjustmentType: 'set',
          quantity: data.quantity || 0,
          previousQuantity: 0,
          newQuantity: data.quantity || 0,
          reason: 'Initial inventory setup',
          performedBy: data.createdBy,
        },
        { transaction }
      )

      await transaction.commit()

      return this.findById(inventory.id)
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  }

  async update(id: number, data: any) {
    const inventory = await Inventory.findByPk(id)
    if (!inventory) {
      throw new Error('Inventory item not found')
    }

    // Don't allow direct quantity updates through this method
    const { quantity, ...updateData } = data

    await inventory.update(updateData)
    return this.findById(id)
  }

  async delete(id: number) {
    const inventory = await Inventory.findByPk(id)
    if (!inventory) {
      throw new Error('Inventory item not found')
    }

    // Check if there are any stock adjustments
    const adjustmentCount = await StockAdjustment.count({
      where: { inventoryId: id },
    })

    if (adjustmentCount > 1) {
      // More than the initial adjustment
      throw new Error('Cannot delete inventory with stock adjustment history')
    }

    await inventory.destroy()
    return { message: 'Inventory item deleted successfully' }
  }

  async adjustStock(id: number, adjustmentData: StockAdjustmentData) {
    const transaction = await sequelize.transaction()

    try {
      const inventory = await Inventory.findByPk(id, { transaction })
      if (!inventory) {
        await transaction.rollback()
        throw new Error('Inventory item not found')
      }

      const previousQuantity = inventory.quantity
      let newQuantity: number

      switch (adjustmentData.adjustmentType) {
        case 'increase':
          newQuantity = previousQuantity + adjustmentData.quantity
          break
        case 'decrease':
          newQuantity = previousQuantity - adjustmentData.quantity
          if (newQuantity < 0) {
            await transaction.rollback()
            throw new Error('Insufficient stock for adjustment')
          }
          break
        case 'set':
          newQuantity = adjustmentData.quantity
          break
        default:
          await transaction.rollback()
          throw new Error('Invalid adjustment type')
      }

      // Update inventory quantity
      await inventory.update(
        {
          quantity: newQuantity,
          lastRestocked:
            adjustmentData.adjustmentType === 'increase'
              ? new Date()
              : inventory.lastRestocked,
        },
        { transaction }
      )

      // Create adjustment record
      await StockAdjustment.create(
        {
          inventoryId: id,
          adjustmentType: adjustmentData.adjustmentType,
          quantity: adjustmentData.quantity,
          previousQuantity,
          newQuantity,
          reason: adjustmentData.reason,
          performedBy: adjustmentData.performedBy,
          notes: adjustmentData.notes,
        },
        { transaction }
      )

      await transaction.commit()

      return this.findById(id)
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  }

  async getLowStockItems() {
    const items = await Inventory.findAll({
      where: {
        [Op.or]: [
          sequelize.where(
            sequelize.col('quantity'),
            '<=',
            sequelize.col('minimumQuantity')
          ),
          sequelize.where(
            sequelize.col('quantity'),
            '<=',
            sequelize.col('reorderPoint')
          ),
        ],
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'category'],
        },
      ],
      order: [['quantity', 'ASC']],
    })

    return items
  }

  async getCategories() {
    const categories = await Inventory.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('category')), 'category'],
      ],
      where: {
        category: { [Op.not]: null },
      },
      raw: true,
    })

    return categories.map((c) => c.category).filter(Boolean)
  }

  async getSuppliers() {
    const suppliers = await Inventory.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('supplier')), 'supplier'],
      ],
      where: {
        supplier: { [Op.not]: null },
      },
      raw: true,
    })

    return suppliers.map((s) => s.supplier).filter(Boolean)
  }
}

export default new InventoryService()
