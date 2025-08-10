import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authenticate, handleValidationErrors } from '@bakery/api/core';
import { 
  userRegistrationRules, 
  loginRules,
  customerUpdateRules,
  passwordUpdateRules,
  customerIdRules
} from '../validators/customer.validator';

const router = Router();

// Public routes - no authentication required
router.post('/register', userRegistrationRules(), handleValidationErrors, CustomerController.register);
router.post('/login', loginRules(), handleValidationErrors, CustomerController.login);

// Protected routes - require authentication
router.use(authenticate); // Apply auth middleware to all routes below

// Customer management routes (admin only would be enforced in controller)
router.get('/', CustomerController.getAllCustomers);
router.get('/:id', customerIdRules(), handleValidationErrors, CustomerController.getCustomerById);
router.put('/:id', customerUpdateRules(), handleValidationErrors, CustomerController.updateCustomer);
router.patch('/:id/password', passwordUpdateRules(), handleValidationErrors, CustomerController.updatePassword);
router.patch('/:id/deactivate', customerIdRules(), handleValidationErrors, CustomerController.deactivateCustomer);
router.patch('/:id/reactivate', customerIdRules(), handleValidationErrors, CustomerController.reactivateCustomer);

export default router;