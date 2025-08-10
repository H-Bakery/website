/**
 * Notification Routes - Local integration with notifications domain
 * Bakery Management System
 */

import { Router } from 'express'
// TODO: Import from @bakery/api/notifications when library is created
// import { notificationRoutes } from '@bakery/api/notifications';

const router = Router()

// TODO: Mount notification routes when library is created
// router.use('/', notificationRoutes);

// Temporary stub routes
router.get('/', (req, res) => {
  res.json({ message: 'User notifications - to be implemented' })
})

router.post('/', (req, res) => {
  res.json({ message: 'Create notification - to be implemented' })
})

router.put('/:id/read', (req, res) => {
  res.json({
    message: `Mark notification ${req.params.id} as read - to be implemented`,
  })
})

router.delete('/:id', (req, res) => {
  res.json({
    message: `Delete notification ${req.params.id} - to be implemented`,
  })
})

export default router
