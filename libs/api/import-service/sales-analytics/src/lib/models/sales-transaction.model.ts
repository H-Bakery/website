import { DataTypes, Model, Sequelize, Association } from 'sequelize';
import { TransactionItem } from './transaction-item.model';

export interface SalesTransactionAttributes {
  id?: number;
  transactionId: string;
  transactionDate: Date;
  totalAmount: number;
  paymentMethod: string;
  userId: string;
  registerNumber: string;
  type: 'sale' | 'refund' | 'adjustment';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SalesTransactionCreationAttributes extends Omit<SalesTransactionAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class SalesTransaction extends Model<SalesTransactionAttributes, SalesTransactionCreationAttributes> implements SalesTransactionAttributes {
  public id!: number;
  public transactionId!: string;
  public transactionDate!: Date;
  public totalAmount!: number;
  public paymentMethod!: string;
  public userId!: string;
  public registerNumber!: string;
  public type!: 'sale' | 'refund' | 'adjustment';

  // timestamps!
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // associations
  public readonly transactionItems?: TransactionItem[];

  public static override associations: {
    transactionItems: Association<SalesTransaction, TransactionItem>;
  };

  public static initialize(sequelize: Sequelize): void {
    SalesTransaction.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        transactionId: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            notEmpty: {
              msg: 'Transaction ID cannot be empty',
            },
          },
        },
        transactionDate: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        totalAmount: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Total amount cannot be negative',
            },
          },
        },
        paymentMethod: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Payment method cannot be empty',
            },
          },
        },
        userId: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'User ID cannot be empty',
            },
          },
        },
        registerNumber: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Register number cannot be empty',
            },
          },
        },
        type: {
          type: DataTypes.ENUM('sale', 'refund', 'adjustment'),
          allowNull: false,
          defaultValue: 'sale',
        },
      },
      {
        sequelize,
        modelName: 'SalesTransaction',
        tableName: 'SalesTransactions',
        timestamps: true,
        indexes: [
          {
            fields: ['transactionId'],
            unique: true,
          },
          {
            fields: ['transactionDate'],
          },
          {
            fields: ['userId'],
          },
        ],
      }
    );
  }

  public static associate(models: any): void {
    if (models.TransactionItem) {
      SalesTransaction.hasMany(models.TransactionItem, {
        as: 'transactionItems',
        foreignKey: 'salesTransactionId',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
}