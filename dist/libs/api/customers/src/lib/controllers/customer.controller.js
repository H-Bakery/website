"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerController = void 0;
var tslib_1 = require("tslib");
var bcrypt = require("bcrypt");
var jwt = require("jsonwebtoken");
var customer_model_1 = require("../models/customer.model");
var core_1 = require("@bakery/api/core");
var CustomerController = /** @class */ (function () {
    function CustomerController() {
    }
    /**
     * Register new customer/user
     */
    CustomerController.register = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, username, password, email, firstName, lastName, role, hashedPassword, newUser, error_1;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        core_1.logger.info('Processing registration request...');
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        _a = req.body, username = _a.username, password = _a.password, email = _a.email, firstName = _a.firstName, lastName = _a.lastName, role = _a.role;
                        core_1.logger.info("Attempting to register user: ".concat(username));
                        return [4 /*yield*/, bcrypt.hash(password, 10)];
                    case 2:
                        hashedPassword = _b.sent();
                        core_1.logger.info('Password hashed successfully');
                        return [4 /*yield*/, customer_model_1.Customer.create({
                                username: username,
                                password: hashedPassword,
                                email: email,
                                firstName: firstName,
                                lastName: lastName,
                                role: role || 'user', // Default to 'user' if no role specified
                                isActive: true,
                                lastLogin: null
                            })];
                    case 3:
                        newUser = _b.sent();
                        core_1.logger.info("User created successfully with ID: ".concat(newUser.id));
                        res.json({
                            message: 'User created',
                            user: {
                                id: newUser.id,
                                username: newUser.username,
                                email: newUser.email,
                                firstName: newUser.firstName,
                                lastName: newUser.lastName,
                                role: newUser.role
                            }
                        });
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _b.sent();
                        core_1.logger.error('Registration error:', error_1);
                        if (error_1.name === 'SequelizeUniqueConstraintError') {
                            core_1.logger.info('Registration failed: Username or email already exists');
                            res.status(400).json({ error: 'Username or email already exists' });
                            return [2 /*return*/];
                        }
                        if (error_1.name === 'SequelizeValidationError') {
                            res.status(400).json({ error: error_1.errors[0].message });
                            return [2 /*return*/];
                        }
                        res.status(500).json({ error: 'Server error' });
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Login customer/user
     */
    CustomerController.login = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, username, password, user, validPassword, token, error_2;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        core_1.logger.info('Processing login request...');
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 5, , 6]);
                        _a = req.body, username = _a.username, password = _a.password;
                        core_1.logger.info("Login attempt for user: ".concat(username));
                        return [4 /*yield*/, customer_model_1.Customer.findOne({ where: { username: username } })];
                    case 2:
                        user = _b.sent();
                        if (!user) {
                            core_1.logger.info("Login failed: User ".concat(username, " not found"));
                            res.status(400).json({ error: 'Invalid credentials' });
                            return [2 /*return*/];
                        }
                        core_1.logger.info("User found with ID: ".concat(user.id, ", validating password..."));
                        return [4 /*yield*/, bcrypt.compare(password, user.password)];
                    case 3:
                        validPassword = _b.sent();
                        if (!validPassword) {
                            core_1.logger.info("Login failed: Invalid password for user ".concat(username));
                            res.status(400).json({ error: 'Invalid credentials' });
                            return [2 /*return*/];
                        }
                        core_1.logger.info("Password valid, generating token for user ".concat(username));
                        // Update last login timestamp
                        return [4 /*yield*/, user.updateLastLogin()];
                    case 4:
                        // Update last login timestamp
                        _b.sent();
                        token = jwt.sign({ id: user.id, role: user.role }, process.env['JWT_SECRET'] || 'your-secret-key');
                        core_1.logger.info('Login successful');
                        res.json({
                            token: token,
                            user: {
                                id: user.id,
                                username: user.username,
                                email: user.email,
                                firstName: user.firstName,
                                lastName: user.lastName,
                                role: user.role
                            }
                        });
                        return [3 /*break*/, 6];
                    case 5:
                        error_2 = _b.sent();
                        core_1.logger.error('Login error:', error_2);
                        res.status(500).json({ error: 'Server error' });
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all customers (admin only)
     */
    CustomerController.getAllCustomers = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var customers, error_3;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        core_1.logger.info('Retrieving all customers');
                        return [4 /*yield*/, customer_model_1.Customer.findAll({
                                attributes: { exclude: ['password'] },
                                order: [['createdAt', 'DESC']]
                            })];
                    case 1:
                        customers = _a.sent();
                        res.json({
                            success: true,
                            count: customers.length,
                            data: customers
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _a.sent();
                        core_1.logger.error('Error retrieving customers:', error_3);
                        res.status(500).json({ error: 'Failed to retrieve customers' });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get customer by ID
     */
    CustomerController.getCustomerById = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var customerId, customer, error_4;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        customerId = parseInt(req.params['id']);
                        core_1.logger.info("Retrieving customer: ".concat(customerId));
                        return [4 /*yield*/, customer_model_1.Customer.findByPk(customerId, {
                                attributes: { exclude: ['password'] }
                            })];
                    case 1:
                        customer = _a.sent();
                        if (!customer) {
                            res.status(404).json({ error: 'Customer not found' });
                            return [2 /*return*/];
                        }
                        res.json({
                            success: true,
                            data: customer
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _a.sent();
                        core_1.logger.error('Error retrieving customer:', error_4);
                        res.status(500).json({ error: 'Failed to retrieve customer' });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update customer profile
     */
    CustomerController.updateCustomer = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var customerId, updateData, customer, updatedCustomer, error_5;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        customerId = parseInt(req.params['id']);
                        updateData = req.body;
                        core_1.logger.info("Updating customer: ".concat(customerId));
                        // Remove password from update data if present (handle separately)
                        delete updateData.password;
                        return [4 /*yield*/, customer_model_1.Customer.findByPk(customerId)];
                    case 1:
                        customer = _a.sent();
                        if (!customer) {
                            res.status(404).json({ error: 'Customer not found' });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, customer.update(updateData)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, customer_model_1.Customer.findByPk(customerId, {
                                attributes: { exclude: ['password'] }
                            })];
                    case 3:
                        updatedCustomer = _a.sent();
                        res.json({
                            success: true,
                            message: 'Customer updated successfully',
                            data: updatedCustomer
                        });
                        return [3 /*break*/, 5];
                    case 4:
                        error_5 = _a.sent();
                        core_1.logger.error('Error updating customer:', error_5);
                        res.status(500).json({ error: 'Failed to update customer' });
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update customer password
     */
    CustomerController.updatePassword = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var customerId, _a, currentPassword, newPassword, customer, validPassword, hashedPassword, error_6;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 5, , 6]);
                        customerId = parseInt(req.params['id']);
                        _a = req.body, currentPassword = _a.currentPassword, newPassword = _a.newPassword;
                        core_1.logger.info("Updating password for customer: ".concat(customerId));
                        return [4 /*yield*/, customer_model_1.Customer.findByPk(customerId)];
                    case 1:
                        customer = _b.sent();
                        if (!customer) {
                            res.status(404).json({ error: 'Customer not found' });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, bcrypt.compare(currentPassword, customer.password)];
                    case 2:
                        validPassword = _b.sent();
                        if (!validPassword) {
                            res.status(400).json({ error: 'Current password is incorrect' });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, bcrypt.hash(newPassword, 10)];
                    case 3:
                        hashedPassword = _b.sent();
                        return [4 /*yield*/, customer.update({ password: hashedPassword })];
                    case 4:
                        _b.sent();
                        res.json({
                            success: true,
                            message: 'Password updated successfully'
                        });
                        return [3 /*break*/, 6];
                    case 5:
                        error_6 = _b.sent();
                        core_1.logger.error('Error updating password:', error_6);
                        res.status(500).json({ error: 'Failed to update password' });
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Deactivate customer (soft delete)
     */
    CustomerController.deactivateCustomer = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var customerId, customer, error_7;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        customerId = parseInt(req.params['id']);
                        core_1.logger.info("Deactivating customer: ".concat(customerId));
                        return [4 /*yield*/, customer_model_1.Customer.findByPk(customerId)];
                    case 1:
                        customer = _a.sent();
                        if (!customer) {
                            res.status(404).json({ error: 'Customer not found' });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, customer.update({ isActive: false })];
                    case 2:
                        _a.sent();
                        res.json({
                            success: true,
                            message: 'Customer deactivated successfully'
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_7 = _a.sent();
                        core_1.logger.error('Error deactivating customer:', error_7);
                        res.status(500).json({ error: 'Failed to deactivate customer' });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Reactivate customer
     */
    CustomerController.reactivateCustomer = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var customerId, customer, error_8;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        customerId = parseInt(req.params['id']);
                        core_1.logger.info("Reactivating customer: ".concat(customerId));
                        return [4 /*yield*/, customer_model_1.Customer.findByPk(customerId)];
                    case 1:
                        customer = _a.sent();
                        if (!customer) {
                            res.status(404).json({ error: 'Customer not found' });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, customer.update({ isActive: true })];
                    case 2:
                        _a.sent();
                        res.json({
                            success: true,
                            message: 'Customer reactivated successfully'
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_8 = _a.sent();
                        core_1.logger.error('Error reactivating customer:', error_8);
                        res.status(500).json({ error: 'Failed to reactivate customer' });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return CustomerController;
}());
exports.CustomerController = CustomerController;
