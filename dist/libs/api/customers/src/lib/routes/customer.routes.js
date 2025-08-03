"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var customer_controller_1 = require("../controllers/customer.controller");
var core_1 = require("@bakery/api/core");
var customer_validator_1 = require("../validators/customer.validator");
var router = (0, express_1.Router)();
// Public routes - no authentication required
router.post('/register', (0, customer_validator_1.userRegistrationRules)(), core_1.handleValidationErrors, customer_controller_1.CustomerController.register);
router.post('/login', (0, customer_validator_1.loginRules)(), core_1.handleValidationErrors, customer_controller_1.CustomerController.login);
// Protected routes - require authentication
router.use(core_1.authenticate); // Apply auth middleware to all routes below
// Customer management routes (admin only would be enforced in controller)
router.get('/', customer_controller_1.CustomerController.getAllCustomers);
router.get('/:id', (0, customer_validator_1.customerIdRules)(), core_1.handleValidationErrors, customer_controller_1.CustomerController.getCustomerById);
router.put('/:id', (0, customer_validator_1.customerUpdateRules)(), core_1.handleValidationErrors, customer_controller_1.CustomerController.updateCustomer);
router.patch('/:id/password', (0, customer_validator_1.passwordUpdateRules)(), core_1.handleValidationErrors, customer_controller_1.CustomerController.updatePassword);
router.patch('/:id/deactivate', (0, customer_validator_1.customerIdRules)(), core_1.handleValidationErrors, customer_controller_1.CustomerController.deactivateCustomer);
router.patch('/:id/reactivate', (0, customer_validator_1.customerIdRules)(), core_1.handleValidationErrors, customer_controller_1.CustomerController.reactivateCustomer);
exports.default = router;
