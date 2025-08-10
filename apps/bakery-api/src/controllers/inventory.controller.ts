import { Request, Response, NextFunction } from 'express'
import inventoryService from '../services/inventory.service'

class InventoryController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        category: req.query.category as string,
        lowStock: req.query.lowStock === 'true',
        search: req.query.search as string,
        supplier: req.query.supplier as string,
      }

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: (req.query.sortBy as string) || 'id',
        sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'ASC',
      }

      const result = await inventoryService.findAll(filters, pagination)
      res.json(result)
    } catch (error) {
      next(error)
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const inventory = await inventoryService.findById(parseInt(id))
      res.json(inventory)
    } catch (error) {
      next(error)
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = {
        ...req.body,
        createdBy: (req as any).user?.id,
      }
      const inventory = await inventoryService.create(data)
      res.status(201).json(inventory)
    } catch (error) {
      next(error)
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const inventory = await inventoryService.update(parseInt(id), req.body)
      res.json(inventory)
    } catch (error) {
      next(error)
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const result = await inventoryService.delete(parseInt(id))
      res.json(result)
    } catch (error) {
      next(error)
    }
  }

  async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const adjustmentData = {
        ...req.body,
        performedBy: (req as any).user?.id,
      }
      const inventory = await inventoryService.adjustStock(
        parseInt(id),
        adjustmentData
      )
      res.json(inventory)
    } catch (error) {
      next(error)
    }
  }

  async getLowStock(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await inventoryService.getLowStockItems()
      res.json(items)
    } catch (error) {
      next(error)
    }
  }

  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await inventoryService.getCategories()
      res.json(categories)
    } catch (error) {
      next(error)
    }
  }

  async getSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const suppliers = await inventoryService.getSuppliers()
      res.json(suppliers)
    } catch (error) {
      next(error)
    }
  }
}

export default new InventoryController()
