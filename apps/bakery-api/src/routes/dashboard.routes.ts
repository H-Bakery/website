/**
 * Dashboard Routes - Local integration with dashboard domain
 * Bakery Management System
 */

import { Router } from 'express'
import { dashboardRoutes } from '@bakery/api/dashboard'

const router = Router()

// Mount dashboard routes at /api/dashboard
router.use('/', dashboardRoutes)

export default router
