"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Customer = void 0;
var tslib_1 = require("tslib");
var sequelize_1 = require("sequelize");
var core_1 = require("@bakery/api/core");
var Customer = /** @class */ (function (_super) {
    tslib_1.__extends(Customer, _super);
    function Customer() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    // Instance methods
    Customer.prototype.getFullName = function () {
        return "".concat(this.firstName, " ").concat(this.lastName);
    };
    Customer.prototype.isAdmin = function () {
        return this.role === 'admin';
    };
    Customer.prototype.isStaff = function () {
        return this.role === 'staff' || this.role === 'admin';
    };
    Customer.prototype.updateLastLogin = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.lastLogin = new Date();
                        return [4 /*yield*/, this.save()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Customer.initModel = function (sequelize) {
        Customer.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            username: {
                type: sequelize_1.DataTypes.STRING,
                unique: true,
                allowNull: false,
            },
            password: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            email: {
                type: sequelize_1.DataTypes.STRING,
                unique: true,
                allowNull: false,
                validate: {
                    isEmail: true,
                },
            },
            firstName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            lastName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            role: {
                type: sequelize_1.DataTypes.ENUM('admin', 'staff', 'user'),
                defaultValue: 'user',
                allowNull: false,
            },
            isActive: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: true,
                allowNull: false,
            },
            lastLogin: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
            },
        }, {
            sequelize: sequelize,
            modelName: 'Customer',
            tableName: 'users', // Using 'users' table name to maintain compatibility
            timestamps: true,
            paranoid: true, // Enable soft deletes
            hooks: {
                beforeCreate: function (user) {
                    core_1.logger.info("Creating new user: ".concat(user.username));
                },
                afterCreate: function (user) {
                    core_1.logger.info("User created with ID: ".concat(user.id));
                },
            },
        });
        return Customer;
    };
    Customer.associate = function (models) {
        // Customer has many Orders
        Customer.hasMany(models.Order, {
            foreignKey: 'userId',
            as: 'orders',
        });
        // Customer has many Cash entries
        Customer.hasMany(models.Cash, {
            foreignKey: 'userId',
            as: 'cashEntries',
        });
        // Customer has many Chat messages
        Customer.hasMany(models.Chat, {
            foreignKey: 'userId',
            as: 'chats',
        });
        // Customer has many UnsoldProduct records
        Customer.hasMany(models.UnsoldProduct, {
            foreignKey: 'userId',
            as: 'unsoldProducts',
        });
    };
    return Customer;
}(sequelize_1.Model));
exports.Customer = Customer;
