/**
 * Chat Routes - Local integration with chat domain
 * Bakery Management System
 */

import { Router } from 'express'
import { chatRoutes } from '@bakery/api/chat'

const router = Router()

// Mount chat routes at /api/chat
router.use('/', chatRoutes)

export default router
