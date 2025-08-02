'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.CustomerService = void 0
var tslib_1 = require('tslib')
var sequelize_1 = require('sequelize')
var bcrypt = require('bcrypt')
var customer_model_1 = require('../models/customer.model')
var core_1 = require('@bakery/api/core')
var CustomerService = /** @class */ (function () {
  function CustomerService() {}
  /**
   * Create a new customer
   * @param customerData - The customer data
   * @returns The created customer (without password)
   */
  CustomerService.prototype.createCustomer = function (customerData) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
      var hashedPassword,
        customer,
        _a,
        password,
        customerWithoutPassword,
        error_1
      return tslib_1.__generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            _b.trys.push([0, 3, , 4])
            core_1.logger.info(
              'Creating new customer: '.concat(customerData.username)
            )
            return [4 /*yield*/, bcrypt.hash(customerData.password, 10)]
          case 1:
            hashedPassword = _b.sent()
            return [
              4 /*yield*/,
              customer_model_1.Customer.create(
                tslib_1.__assign(tslib_1.__assign({}, customerData), {
                  password: hashedPassword,
                })
              ),
            ]
          case 2:
            customer = _b.sent()
            ;(_a = customer.toJSON()),
              (password = _a.password),
              (customerWithoutPassword = tslib_1.__rest(_a, ['password']))
            core_1.logger.info(
              'Customer created successfully: '.concat(customer.id)
            )
            return [2 /*return*/, customerWithoutPassword]
          case 3:
            error_1 = _b.sent()
            core_1.logger.error('Error creating customer:', error_1)
            throw error_1
          case 4:
            return [2 /*return*/]
        }
      })
    })
  }
  /**
   * Get all customers with optional filtering
   * @param filters - Optional filters
   * @returns Array of customers (without passwords)
   */
  CustomerService.prototype.getAllCustomers = function () {
    return tslib_1.__awaiter(this, arguments, void 0, function (filters) {
      var where, customers, error_2
      var _a, _b, _c, _d
      if (filters === void 0) {
        filters = {}
      }
      return tslib_1.__generator(this, function (_e) {
        switch (_e.label) {
          case 0:
            _e.trys.push([0, 2, , 3])
            where = {}
            // Apply role filter
            if (filters.role) {
              where.role = filters.role
            }
            // Apply active status filter
            if (filters.isActive !== undefined) {
              where.isActive = filters.isActive
            }
            // Apply search filter
            if (filters.search) {
              where[sequelize_1.Op.or] = [
                {
                  username:
                    ((_a = {}),
                    (_a[sequelize_1.Op.like] = '%'.concat(filters.search, '%')),
                    _a),
                },
                {
                  email:
                    ((_b = {}),
                    (_b[sequelize_1.Op.like] = '%'.concat(filters.search, '%')),
                    _b),
                },
                {
                  firstName:
                    ((_c = {}),
                    (_c[sequelize_1.Op.like] = '%'.concat(filters.search, '%')),
                    _c),
                },
                {
                  lastName:
                    ((_d = {}),
                    (_d[sequelize_1.Op.like] = '%'.concat(filters.search, '%')),
                    _d),
                },
              ]
            }
            core_1.logger.info(
              'Retrieving customers with filters: '.concat(
                JSON.stringify(filters)
              )
            )
            return [
              4 /*yield*/,
              customer_model_1.Customer.findAll({
                where: where,
                attributes: { exclude: ['password'] },
                order: [['createdAt', 'DESC']],
              }),
            ]
          case 1:
            customers = _e.sent()
            core_1.logger.info(
              'Retrieved '.concat(customers.length, ' customers')
            )
            return [2 /*return*/, customers]
          case 2:
            error_2 = _e.sent()
            core_1.logger.error('Error retrieving customers:', error_2)
            throw error_2
          case 3:
            return [2 /*return*/]
        }
      })
    })
  }
  /**
   * Get a single customer by ID
   * @param id - The customer ID
   * @returns The customer (without password) or null
   */
  CustomerService.prototype.getCustomerById = function (id) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
      var customer, error_3
      return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 2, , 3])
            core_1.logger.info('Retrieving customer: '.concat(id))
            return [
              4 /*yield*/,
              customer_model_1.Customer.findByPk(id, {
                attributes: { exclude: ['password'] },
              }),
            ]
          case 1:
            customer = _a.sent()
            if (!customer) {
              core_1.logger.warn('Customer not found: '.concat(id))
              return [2 /*return*/, null]
            }
            core_1.logger.info('Customer retrieved: '.concat(id))
            return [2 /*return*/, customer]
          case 2:
            error_3 = _a.sent()
            core_1.logger.error(
              'Error retrieving customer '.concat(id, ':'),
              error_3
            )
            throw error_3
          case 3:
            return [2 /*return*/]
        }
      })
    })
  }
  /**
   * Get customer by username
   * @param username - The username
   * @returns The customer or null
   */
  CustomerService.prototype.getCustomerByUsername = function (username) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
      var customer, error_4
      return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 2, , 3])
            core_1.logger.info(
              'Retrieving customer by username: '.concat(username)
            )
            return [
              4 /*yield*/,
              customer_model_1.Customer.findOne({
                where: { username: username },
              }),
            ]
          case 1:
            customer = _a.sent()
            if (!customer) {
              core_1.logger.warn(
                'Customer not found with username: '.concat(username)
              )
              return [2 /*return*/, null]
            }
            core_1.logger.info('Customer retrieved: '.concat(customer.id))
            return [2 /*return*/, customer]
          case 2:
            error_4 = _a.sent()
            core_1.logger.error(
              'Error retrieving customer by username '.concat(username, ':'),
              error_4
            )
            throw error_4
          case 3:
            return [2 /*return*/]
        }
      })
    })
  }
  /**
   * Update customer details
   * @param id - The customer ID
   * @param updateData - The data to update
   * @returns The updated customer (without password)
   */
  CustomerService.prototype.updateCustomer = function (id, updateData) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
      var password, safeUpdateData, customer, updatedCustomer, error_5
      return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 4, , 5])
            core_1.logger.info('Updating customer: '.concat(id))
            ;(password = updateData.password),
              (safeUpdateData = tslib_1.__rest(updateData, ['password']))
            return [4 /*yield*/, customer_model_1.Customer.findByPk(id)]
          case 1:
            customer = _a.sent()
            if (!customer) {
              core_1.logger.warn('Customer not found for update: '.concat(id))
              return [2 /*return*/, null]
            }
            return [4 /*yield*/, customer.update(safeUpdateData)]
          case 2:
            _a.sent()
            return [
              4 /*yield*/,
              customer_model_1.Customer.findByPk(id, {
                attributes: { exclude: ['password'] },
              }),
            ]
          case 3:
            updatedCustomer = _a.sent()
            core_1.logger.info('Customer updated successfully: '.concat(id))
            return [2 /*return*/, updatedCustomer]
          case 4:
            error_5 = _a.sent()
            core_1.logger.error(
              'Error updating customer '.concat(id, ':'),
              error_5
            )
            throw error_5
          case 5:
            return [2 /*return*/]
        }
      })
    })
  }
  /**
   * Update customer password
   * @param id - The customer ID
   * @param currentPassword - The current password for verification
   * @param newPassword - The new password
   * @returns Success boolean
   */
  CustomerService.prototype.updatePassword = function (
    id,
    currentPassword,
    newPassword
  ) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
      var customer, validPassword, hashedPassword, error_6
      return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 5, , 6])
            core_1.logger.info('Updating password for customer: '.concat(id))
            return [4 /*yield*/, customer_model_1.Customer.findByPk(id)]
          case 1:
            customer = _a.sent()
            if (!customer) {
              core_1.logger.warn(
                'Customer not found for password update: '.concat(id)
              )
              return [2 /*return*/, false]
            }
            return [
              4 /*yield*/,
              bcrypt.compare(currentPassword, customer.password),
            ]
          case 2:
            validPassword = _a.sent()
            if (!validPassword) {
              core_1.logger.warn(
                'Invalid current password for customer: '.concat(id)
              )
              return [2 /*return*/, false]
            }
            return [4 /*yield*/, bcrypt.hash(newPassword, 10)]
          case 3:
            hashedPassword = _a.sent()
            return [4 /*yield*/, customer.update({ password: hashedPassword })]
          case 4:
            _a.sent()
            core_1.logger.info(
              'Password updated successfully for customer: '.concat(id)
            )
            return [2 /*return*/, true]
          case 5:
            error_6 = _a.sent()
            core_1.logger.error(
              'Error updating password for customer '.concat(id, ':'),
              error_6
            )
            throw error_6
          case 6:
            return [2 /*return*/]
        }
      })
    })
  }
  /**
   * Deactivate customer (soft delete)
   * @param id - The customer ID
   * @returns Success boolean
   */
  CustomerService.prototype.deactivateCustomer = function (id) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
      var customer, error_7
      return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 3, , 4])
            core_1.logger.info('Deactivating customer: '.concat(id))
            return [4 /*yield*/, customer_model_1.Customer.findByPk(id)]
          case 1:
            customer = _a.sent()
            if (!customer) {
              core_1.logger.warn(
                'Customer not found for deactivation: '.concat(id)
              )
              return [2 /*return*/, false]
            }
            return [4 /*yield*/, customer.update({ isActive: false })]
          case 2:
            _a.sent()
            core_1.logger.info('Customer deactivated: '.concat(id))
            return [2 /*return*/, true]
          case 3:
            error_7 = _a.sent()
            core_1.logger.error(
              'Error deactivating customer '.concat(id, ':'),
              error_7
            )
            throw error_7
          case 4:
            return [2 /*return*/]
        }
      })
    })
  }
  /**
   * Reactivate customer
   * @param id - The customer ID
   * @returns Success boolean
   */
  CustomerService.prototype.reactivateCustomer = function (id) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
      var customer, error_8
      return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 3, , 4])
            core_1.logger.info('Reactivating customer: '.concat(id))
            return [4 /*yield*/, customer_model_1.Customer.findByPk(id)]
          case 1:
            customer = _a.sent()
            if (!customer) {
              core_1.logger.warn(
                'Customer not found for reactivation: '.concat(id)
              )
              return [2 /*return*/, false]
            }
            return [4 /*yield*/, customer.update({ isActive: true })]
          case 2:
            _a.sent()
            core_1.logger.info('Customer reactivated: '.concat(id))
            return [2 /*return*/, true]
          case 3:
            error_8 = _a.sent()
            core_1.logger.error(
              'Error reactivating customer '.concat(id, ':'),
              error_8
            )
            throw error_8
          case 4:
            return [2 /*return*/]
        }
      })
    })
  }
  /**
   * Get customer statistics
   * @returns Customer statistics
   */
  CustomerService.prototype.getCustomerStats = function () {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
      var _a,
        totalCustomers,
        activeCustomers,
        adminCount,
        staffCount,
        userCount,
        stats,
        error_9
      return tslib_1.__generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            _b.trys.push([0, 2, , 3])
            core_1.logger.info('Retrieving customer statistics')
            return [
              4 /*yield*/,
              Promise.all([
                customer_model_1.Customer.count(),
                customer_model_1.Customer.count({ where: { isActive: true } }),
                customer_model_1.Customer.count({ where: { role: 'admin' } }),
                customer_model_1.Customer.count({ where: { role: 'staff' } }),
                customer_model_1.Customer.count({ where: { role: 'user' } }),
              ]),
            ]
          case 1:
            ;(_a = _b.sent()),
              (totalCustomers = _a[0]),
              (activeCustomers = _a[1]),
              (adminCount = _a[2]),
              (staffCount = _a[3]),
              (userCount = _a[4])
            stats = {
              totalCustomers: totalCustomers,
              activeCustomers: activeCustomers,
              inactiveCustomers: totalCustomers - activeCustomers,
              customersByRole: {
                admin: adminCount,
                staff: staffCount,
                user: userCount,
              },
            }
            core_1.logger.info('Customer statistics retrieved successfully')
            return [2 /*return*/, stats]
          case 2:
            error_9 = _b.sent()
            core_1.logger.error(
              'Error retrieving customer statistics:',
              error_9
            )
            throw error_9
          case 3:
            return [2 /*return*/]
        }
      })
    })
  }
  /**
   * Validate customer credentials
   * @param username - The username
   * @param password - The password
   * @returns The customer if valid, null otherwise
   */
  CustomerService.prototype.validateCredentials = function (
    username,
    password
  ) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
      var customer, validPassword, error_10
      return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 3, , 4])
            core_1.logger.info(
              'Validating credentials for user: '.concat(username)
            )
            return [
              4 /*yield*/,
              customer_model_1.Customer.findOne({
                where: { username: username },
              }),
            ]
          case 1:
            customer = _a.sent()
            if (!customer) {
              core_1.logger.warn('User not found: '.concat(username))
              return [2 /*return*/, null]
            }
            return [4 /*yield*/, bcrypt.compare(password, customer.password)]
          case 2:
            validPassword = _a.sent()
            if (!validPassword) {
              core_1.logger.warn('Invalid password for user: '.concat(username))
              return [2 /*return*/, null]
            }
            core_1.logger.info(
              'Credentials validated for user: '.concat(username)
            )
            return [2 /*return*/, customer]
          case 3:
            error_10 = _a.sent()
            core_1.logger.error(
              'Error validating credentials for '.concat(username, ':'),
              error_10
            )
            throw error_10
          case 4:
            return [2 /*return*/]
        }
      })
    })
  }
  return CustomerService
})()
exports.CustomerService = CustomerService
