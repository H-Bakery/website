/**
 * Recipe Routes - Local integration with recipes domain
 * Bakery Management System
 */

import { Router } from 'express'
import { recipeRoutes } from '@bakery/api/recipes'

const router = Router()

// Mount recipe routes at /api/recipes
router.use('/', recipeRoutes)

export default router
