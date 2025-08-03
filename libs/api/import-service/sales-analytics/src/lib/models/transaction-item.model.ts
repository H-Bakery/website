import { DataTypes, Model, Sequelize, Association } from 'sequelize';
import { SalesTransaction } from './sales-transaction.model';

export interface TransactionItemAttributes {
  id?: number;
  salesTransactionId: number;
  productId: number;
  productName: string;
  quantity: number;
  pricePerItem: number;
  totalPrice: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TransactionItemCreationAttributes extends Omit<TransactionItemAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class TransactionItem extends Model<TransactionItemAttributes, TransactionItemCreationAttributes> implements TransactionItemAttributes {
  public id!: number;
  public salesTransactionId!: number;
  public productId!: number;
  public productName!: string;
  public quantity!: number;
  public pricePerItem!: number;
  public totalPrice!: number;

  // timestamps!
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // associations
  public readonly salesTransaction?: SalesTransaction;
  public readonly product?: any; // Product model from the main app

  public static override associations: {
    salesTransaction: Association<TransactionItem, SalesTransaction>;
    product: Association<TransactionItem, any>;
  };

  public static initialize(sequelize: Sequelize): void {
    TransactionItem.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        salesTransactionId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'SalesTransactions',
            key: 'id',
          },
        },
        productId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'Products',
            key: 'id',
          },
        },
        productName: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Product name cannot be empty',
            },
          },
          comment: 'Denormalized product name for historical accuracy',
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: {
              args: [1],
              msg: 'Quantity must be at least 1',
            },
          },
        },
        pricePerItem: {
          type: DataTypes.FLOAT,
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Price per item cannot be negative',
            },
          },
        },
        totalPrice: {
          type: DataTypes.FLOAT,
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Total price cannot be negative',
            },
          },
        },
      },
      {
        sequelize,
        modelName: 'TransactionItem',
        tableName: 'TransactionItems',
        timestamps: true,
        indexes: [
          {
            fields: ['salesTransactionId'],
          },
          {
            fields: ['productId'],
          },
        ],
      }
    );
  }

  public static associate(models: any): void {
    if (models.SalesTransaction) {
      TransactionItem.belongsTo(models.SalesTransaction, {
        as: 'salesTransaction',
        foreignKey: 'salesTransactionId',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }

    if (models.Product) {
      TransactionItem.belongsTo(models.Product, {
        as: 'product',
        foreignKey: 'productId',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      });
    }
  }
}