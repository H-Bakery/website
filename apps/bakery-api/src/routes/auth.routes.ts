/**
 * Auth Routes - Local integration with auth domain
 * Bakery Management System
 */

import { Router } from 'express'
import { authRoutes } from '@bakery/api/auth'

const router = Router()

// Mount auth routes at /api/auth
router.use('/', authRoutes)

export default router
