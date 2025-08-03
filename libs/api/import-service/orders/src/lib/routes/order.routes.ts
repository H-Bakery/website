import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate } from '@bakery/api/core';
import { 
  orderCreationRules, 
  orderUpdateRules, 
  orderDeleteRules 
} from '../validators/order.validator';
import { handleValidationErrors } from '@bakery/api/core';

const router = Router();

// Order CRUD routes - all protected with authentication
router.get('/', authenticate, OrderController.getOrders);
router.get('/:id', authenticate, OrderController.getOrder);
router.post('/', authenticate, orderCreationRules(), handleValidationErrors, OrderController.createOrder);
router.put('/:id', authenticate, orderUpdateRules(), handleValidationErrors, OrderController.updateOrder);
router.delete('/:id', authenticate, orderDeleteRules(), handleValidationErrors, OrderController.deleteOrder);

export default router;