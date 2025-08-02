// Models
export { Customer } from './lib/models/customer.model';
export type { 
  CustomerAttributes, 
  CustomerCreationAttributes 
} from './lib/models/customer.model';

// Controllers
export { CustomerController } from './lib/controllers/customer.controller';

// Services
export { CustomerService } from './lib/services/customer.service';

// Routes
export { default as customerRoutes } from './lib/routes/customer.routes';

// Validators
export {
  userRegistrationRules,
  loginRules,
  customerUpdateRules,
  passwordUpdateRules,
  customerIdRules
} from './lib/validators/customer.validator';