/**
 * Cash Routes - Local integration with cash domain
 * Bakery Management System
 */

import { Router } from 'express'
import { cashRoutes } from '@bakery/api/cash'

const router = Router()

// Mount cash routes at /api/cash
router.use('/', cashRoutes)

export default router
