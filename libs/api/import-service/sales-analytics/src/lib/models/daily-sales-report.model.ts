import { DataTypes, Model, Sequelize, Association } from 'sequelize';

export interface DailySalesReportAttributes {
  reportDate: Date;
  totalSales: number;
  cashSales: number;
  totalTransactions: number;
  mostPopularProductId?: number | null;
  vatTotals?: object;
  reportNumber: number;
  registerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DailySalesReportCreationAttributes extends Omit<DailySalesReportAttributes, 'createdAt' | 'updatedAt'> {}

export class DailySalesReport extends Model<DailySalesReportAttributes, DailySalesReportCreationAttributes> implements DailySalesReportAttributes {
  public reportDate!: Date;
  public totalSales!: number;
  public cashSales!: number;
  public totalTransactions!: number;
  public mostPopularProductId?: number | null;
  public vatTotals?: object;
  public reportNumber!: number;
  public registerId!: string;

  // timestamps!
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // associations
  public readonly mostPopularProduct?: any; // Product model from the main app

  public static override associations: {
    mostPopularProduct: Association<DailySalesReport, any>;
  };

  public static initialize(sequelize: Sequelize): void {
    DailySalesReport.init(
      {
        reportDate: {
          type: DataTypes.DATEONLY,
          primaryKey: true,
          allowNull: false,
        },
        totalSales: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Total sales cannot be negative',
            },
          },
        },
        cashSales: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Cash sales cannot be negative',
            },
          },
        },
        totalTransactions: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Total transactions cannot be negative',
            },
          },
        },
        mostPopularProductId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'Products',
            key: 'id',
          },
        },
        vatTotals: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: {},
          comment: 'JSON object containing VAT breakdown',
        },
        reportNumber: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: {
              args: [1],
              msg: 'Report number must be positive',
            },
          },
        },
        registerId: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Register ID cannot be empty',
            },
          },
        },
      },
      {
        sequelize,
        modelName: 'DailySalesReport',
        tableName: 'DailySalesReports',
        timestamps: true,
        indexes: [
          {
            fields: ['reportDate'],
            unique: true,
          },
        ],
      }
    );
  }

  public static associate(models: any): void {
    if (models.Product) {
      DailySalesReport.belongsTo(models.Product, {
        as: 'mostPopularProduct',
        foreignKey: 'mostPopularProductId',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }

  // Instance methods
  public isHighSalesDay(threshold: number = 1000): boolean {
    return this.totalSales >= threshold;
  }

  public getCashPercentage(): number {
    if (this.totalSales === 0) return 0;
    return (this.cashSales / this.totalSales) * 100;
  }

  public getAverageTransactionValue(): number {
    if (this.totalTransactions === 0) return 0;
    return this.totalSales / this.totalTransactions;
  }
}