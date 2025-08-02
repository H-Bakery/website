'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.Inventory = void 0
var tslib_1 = require('tslib')
var sequelize_1 = require('sequelize')
var Inventory = /** @class */ (function (_super) {
  tslib_1.__extends(Inventory, _super)
  function Inventory() {
    return (_super !== null && _super.apply(this, arguments)) || this
  }
  // Instance methods
  Inventory.prototype.isLowStock = function () {
    return this.quantity <= this.lowStockThreshold
  }
  Inventory.prototype.needsReorder = function () {
    return this.quantity <= this.reorderLevel
  }
  Inventory.prototype.adjustStock = function (change) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
      var newQuantity
      return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            newQuantity = this.quantity + change
            if (newQuantity < 0) {
              throw new Error(
                'Insufficient stock. Available: '
                  .concat(this.quantity, ', Requested: ')
                  .concat(Math.abs(change))
              )
            }
            this.quantity = newQuantity
            if (change > 0) {
              this.lastRestockedAt = new Date()
            }
            return [4 /*yield*/, this.save()]
          case 1:
            _a.sent()
            return [2 /*return*/, this]
        }
      })
    })
  }
  Inventory.initialize = function (sequelize) {
    Inventory.init(
      {
        id: {
          type: sequelize_1.DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: sequelize_1.DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            notEmpty: {
              msg: 'Item name cannot be empty',
            },
          },
        },
        sku: {
          type: sequelize_1.DataTypes.STRING,
          unique: true,
          validate: {
            notEmpty: {
              msg: 'SKU cannot be empty if provided',
            },
          },
        },
        description: {
          type: sequelize_1.DataTypes.TEXT,
        },
        quantity: {
          type: sequelize_1.DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Quantity cannot be negative',
            },
          },
        },
        unit: {
          type: sequelize_1.DataTypes.STRING,
          allowNull: false,
          defaultValue: 'units',
          validate: {
            isIn: {
              args: [
                [
                  'kg',
                  'g',
                  'liters',
                  'ml',
                  'units',
                  'pieces',
                  'bags',
                  'boxes',
                  'bottles',
                  'jars',
                ],
              ],
              msg: 'Invalid unit type',
            },
          },
        },
        lowStockThreshold: {
          type: sequelize_1.DataTypes.FLOAT,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Low stock threshold cannot be negative',
            },
          },
        },
        category: {
          type: sequelize_1.DataTypes.STRING,
          validate: {
            isIn: {
              args: [
                [
                  'ingredients',
                  'packaging',
                  'supplies',
                  'equipment',
                  'consumables',
                  'other',
                ],
              ],
              msg: 'Invalid category',
            },
          },
        },
        location: {
          type: sequelize_1.DataTypes.STRING,
          comment: 'Storage location in the bakery',
        },
        supplier: {
          type: sequelize_1.DataTypes.STRING,
        },
        cost: {
          type: sequelize_1.DataTypes.FLOAT,
          validate: {
            min: {
              args: [0],
              msg: 'Cost cannot be negative',
            },
          },
        },
        reorderLevel: {
          type: sequelize_1.DataTypes.FLOAT,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Reorder level cannot be negative',
            },
          },
        },
        reorderQuantity: {
          type: sequelize_1.DataTypes.FLOAT,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Reorder quantity cannot be negative',
            },
          },
        },
        lastRestockedAt: {
          type: sequelize_1.DataTypes.DATE,
        },
        expiryDate: {
          type: sequelize_1.DataTypes.DATE,
        },
        notes: {
          type: sequelize_1.DataTypes.TEXT,
        },
        isActive: {
          type: sequelize_1.DataTypes.BOOLEAN,
          defaultValue: true,
        },
      },
      {
        sequelize: sequelize,
        modelName: 'Inventory',
        tableName: 'Inventories',
        timestamps: true,
      }
    )
  }
  return Inventory
})(sequelize_1.Model)
exports.Inventory = Inventory
