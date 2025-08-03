import { Model, DataTypes, Sequelize, CreationOptional, Association } from 'sequelize';
import { logger } from '@bakery/api/core';

export interface CustomerAttributes {
  id: number;
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'staff' | 'user';
  isActive: boolean;
  lastLogin: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export interface CustomerCreationAttributes extends Omit<CustomerAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  id?: number;
}

export class Customer extends Model<CustomerAttributes, CustomerCreationAttributes> implements CustomerAttributes {
  public id!: number;
  public username!: string;
  public password!: string;
  public email!: string;
  public firstName!: string;
  public lastName!: string;
  public role!: 'admin' | 'staff' | 'user';
  public isActive!: boolean;
  public lastLogin!: CreationOptional<Date | null>;
  
  // timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date | null;

  // Associations
  public readonly orders?: any[]; // Will be properly typed when Order model is available
  public readonly cashEntries?: any[];
  public readonly chats?: any[];
  public readonly unsoldProducts?: any[];

  public static override associations: {
    orders: Association<Customer, any>;
    cashEntries: Association<Customer, any>;
    chats: Association<Customer, any>;
    unsoldProducts: Association<Customer, any>;
  };

  // Instance methods
  public getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  public isAdmin(): boolean {
    return this.role === 'admin';
  }

  public isStaff(): boolean {
    return this.role === 'staff' || this.role === 'admin';
  }

  public async updateLastLogin(): Promise<void> {
    this.lastLogin = new Date();
    await this.save();
  }

  public static initModel(sequelize: Sequelize): typeof Customer {
    Customer.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        username: {
          type: DataTypes.STRING,
          unique: true,
          allowNull: false,
        },
        password: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          unique: true,
          allowNull: false,
          validate: {
            isEmail: true,
          },
        },
        firstName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        lastName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        role: {
          type: DataTypes.ENUM('admin', 'staff', 'user'),
          defaultValue: 'user',
          allowNull: false,
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
          allowNull: false,
        },
        lastLogin: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'Customer',
        tableName: 'users', // Using 'users' table name to maintain compatibility
        timestamps: true,
        paranoid: true, // Enable soft deletes
        hooks: {
          beforeCreate: (user) => {
            logger.info(`Creating new user: ${user.username}`);
          },
          afterCreate: (user) => {
            logger.info(`User created with ID: ${user.id}`);
          },
        },
      }
    );

    return Customer;
  }

  public static associate(models: any): void {
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
  }
}