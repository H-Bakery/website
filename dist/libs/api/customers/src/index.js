"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerIdRules = exports.passwordUpdateRules = exports.customerUpdateRules = exports.loginRules = exports.userRegistrationRules = exports.customerRoutes = exports.CustomerService = exports.CustomerController = exports.Customer = void 0;
// Models
var customer_model_1 = require("./lib/models/customer.model");
Object.defineProperty(exports, "Customer", { enumerable: true, get: function () { return customer_model_1.Customer; } });
// Controllers
var customer_controller_1 = require("./lib/controllers/customer.controller");
Object.defineProperty(exports, "CustomerController", { enumerable: true, get: function () { return customer_controller_1.CustomerController; } });
// Services
var customer_service_1 = require("./lib/services/customer.service");
Object.defineProperty(exports, "CustomerService", { enumerable: true, get: function () { return customer_service_1.CustomerService; } });
// Routes
var customer_routes_1 = require("./lib/routes/customer.routes");
Object.defineProperty(exports, "customerRoutes", { enumerable: true, get: function () { return customer_routes_1.default; } });
// Validators
var customer_validator_1 = require("./lib/validators/customer.validator");
Object.defineProperty(exports, "userRegistrationRules", { enumerable: true, get: function () { return customer_validator_1.userRegistrationRules; } });
Object.defineProperty(exports, "loginRules", { enumerable: true, get: function () { return customer_validator_1.loginRules; } });
Object.defineProperty(exports, "customerUpdateRules", { enumerable: true, get: function () { return customer_validator_1.customerUpdateRules; } });
Object.defineProperty(exports, "passwordUpdateRules", { enumerable: true, get: function () { return customer_validator_1.passwordUpdateRules; } });
Object.defineProperty(exports, "customerIdRules", { enumerable: true, get: function () { return customer_validator_1.customerIdRules; } });
