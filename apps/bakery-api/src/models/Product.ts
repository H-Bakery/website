import { 
  Model, 
  DataTypes, 
  Sequelize, 
  InferAttributes, 
  InferCreationAttributes,
  CreationOptional,
  HasManyGetAssociationsMixin
} from 'sequelize';
import { logger } from '@bakery/api/core';

export interface ProductAttributes {
  id: number;
  name: string;
  price: number;
  stock: number;
  dailyTarget: number;
  description?: string | null;
  isActive: boolean;
  image?: string | null;
  category?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Product extends Model<
  InferAttributes<Product>,
  InferCreationAttributes<Product>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare price: number;
  declare stock: CreationOptional<number>;
  declare dailyTarget: CreationOptional<number>;
  declare description: CreationOptional<string | null>;
  declare isActive: CreationOptional<boolean>;
  declare image: CreationOptional<string | null>;
  declare category: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare getOrderItems: HasManyGetAssociationsMixin<any>;
  declare getUnsoldProducts: HasManyGetAssociationsMixin<any>;
  declare getInventory: HasManyGetAssociationsMixin<any>;
  declare orderItems?: any[];
  declare unsoldProducts?: any[];
  declare inventory?: any;

  static initModel(sequelize: Sequelize): typeof Product {
    Product.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Product name cannot be empty',
            },
          },
        },
        price: {
          type: DataTypes.FLOAT,
          allowNull: false,
          validate: {
            isFloat: {
              msg: 'Price must be a valid number',
            },
            min: {
              args: [0],
              msg: 'Price must be positive',
            },
          },
        },
        stock: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          validate: {
            isInt: {
              msg: 'Stock must be an integer',
            },
            min: {
              args: [0],
              msg: 'Stock cannot be negative',
            },
          },
        },
        dailyTarget: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          validate: {
            isInt: {
              msg: 'Daily target must be an integer',
            },
            min: {
              args: [0],
              msg: 'Daily target cannot be negative',
            },
          },
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
        },
        image: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        category: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'Product',
        tableName: 'Products',
        timestamps: true,
        hooks: {
          beforeCreate: (product: Product) => {
            logger.info(`Creating product: ${product.name}`);
          },
          beforeUpdate: (product: Product) => {
            logger.info(`Updating product: ${product.name}`);
          },
        },
      }
    );

    return Product;
  }

  // Instance methods
  isInStock(): boolean {
    return this.stock > 0;
  }

  hasLowStock(threshold: number = 10): boolean {
    return this.stock <= threshold;
  }

  adjustStock(quantity: number): void {
    const newStock = this.stock + quantity;
    if (newStock < 0) {
      throw new Error(`Insufficient stock. Available: ${this.stock}, Requested: ${Math.abs(quantity)}`);
    }
    this.stock = newStock;
  }

  toJSON() {
    const values = { ...this.get() };
    return values;
  }
}

// For backward compatibility
export default Product;