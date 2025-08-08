/**
 * Production Routes - Local integration with production domain
 * Bakery Management System
 */

import { Router } from 'express'
// TODO: Import from @bakery/api/production when library is created
// import { productionRoutes } from '@bakery/api/production';

const router = Router()

// TODO: Mount production routes when library is created
// router.use('/', productionRoutes);

// Temporary stub routes
router.get('/schedules', (req, res) => {
  res.json({ message: 'Production schedules - to be implemented' })
})

router.post('/schedules', (req, res) => {
  res.json({ message: 'Create production schedule - to be implemented' })
})

router.get('/batches', (req, res) => {
  res.json({ message: 'Production batches - to be implemented' })
})

router.post('/batches', (req, res) => {
  res.json({ message: 'Create production batch - to be implemented' })
})

export default router
