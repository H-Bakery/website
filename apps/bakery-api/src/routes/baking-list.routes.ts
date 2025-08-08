import { createBakingListRoutes } from '@bakery/api/baking-list'
import { Order, OrderItem, Product } from '../models'
import { handleValidationErrors } from '../middleware/validation.middleware'

// Create and export baking list routes with required dependencies
export default createBakingListRoutes({
  models: {
    Order,
    OrderItem,
    Product,
  },
  authMiddleware: (req: any, res: any, next: any) => {
    // This will be replaced by the actual auth middleware from main.ts
    next()
  },
  requireRole: (roles: string[]) => (req: any, res: any, next: any) => {
    // This will be replaced by the actual requireRole middleware from main.ts
    next()
  },
  handleValidationErrors,
})
