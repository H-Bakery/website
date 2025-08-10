import { createStaffRoutes } from '@bakery/api/staff'
import { User } from '../models'
import { handleValidationErrors } from '../middleware/validation.middleware'

// Create and export staff routes with required dependencies
export default createStaffRoutes({
  UserModel: User,
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
