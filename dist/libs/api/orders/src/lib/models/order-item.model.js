"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderItem = void 0;
var tslib_1 = require("tslib");
var sequelize_1 = require("sequelize");
var OrderItem = /** @class */ (function (_super) {
    tslib_1.__extends(OrderItem, _super);
    function OrderItem() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    OrderItem.initialize = function (sequelize) {
        OrderItem.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            productId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            productName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            quantity: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            unitPrice: {
                type: sequelize_1.DataTypes.FLOAT,
                allowNull: false,
            },
        }, {
            sequelize: sequelize,
            modelName: 'OrderItem',
            tableName: 'OrderItems',
            timestamps: true,
        });
    };
    OrderItem.associate = function (models) {
        if (models.Order) {
            OrderItem.belongsTo(models.Order, {
                as: 'order',
                foreignKey: 'orderId',
            });
        }
    };
    return OrderItem;
}(sequelize_1.Model));
exports.OrderItem = OrderItem;
