/**
 * Product Routes - Local integration with products domain
 * Bakery Management System
 */

import { Router } from 'express'
import { productRoutes } from '@bakery/api/products'

const router = Router()

// Mount product routes at /api/products
router.use('/', productRoutes)

export default router
