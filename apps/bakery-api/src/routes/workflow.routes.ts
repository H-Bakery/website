/**
 * Workflow Routes - Local integration with workflows domain
 * Bakery Management System
 */

import { Router } from 'express'
import { workflowRoutes } from '@bakery/api/workflows'

const router = Router()

// Mount workflow routes at /api/workflows
router.use('/', workflowRoutes)

export default router
