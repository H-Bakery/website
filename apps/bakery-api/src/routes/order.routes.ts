/**
 * Order Routes - Local integration with orders domain
 * Bakery Management System
 */

import { Router } from 'express'
// TODO: Import from @bakery/api/orders when library is created
// import { orderRoutes } from '@bakery/api/orders';

const router = Router()

// TODO: Mount order routes when library is created
// router.use('/', orderRoutes);

// Temporary stub routes
router.get('/', (req, res) => {
  res.json({ message: 'Orders endpoint - to be implemented' })
})

router.get('/:id', (req, res) => {
  res.json({ message: `Order ${req.params.id} - to be implemented` })
})

router.post('/', (req, res) => {
  res.json({ message: 'Create order - to be implemented' })
})

router.put('/:id', (req, res) => {
  res.json({ message: `Update order ${req.params.id} - to be implemented` })
})

router.delete('/:id', (req, res) => {
  res.json({ message: `Delete order ${req.params.id} - to be implemented` })
})

export default router
