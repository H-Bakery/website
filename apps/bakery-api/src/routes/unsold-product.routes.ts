import { createUnsoldProductRoutes } from '@bakery/api/unsold-products'
import { UnsoldProduct, Product, User } from '../models'
import { handleValidationErrors } from '../middleware/validation.middleware'

// Create and export unsold product routes with required dependencies
export default createUnsoldProductRoutes({
  models: {
    UnsoldProduct,
    Product,
    User,
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
