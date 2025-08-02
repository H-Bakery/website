import { DataTypes, Model, Sequelize } from 'sequelize';

export type InventoryUnit = 'kg' | 'g' | 'liters' | 'ml' | 'units' | 'pieces' | 'bags' | 'boxes' | 'bottles' | 'jars';
export type InventoryCategory = 'ingredients' | 'packaging' | 'supplies' | 'equipment' | 'consumables' | 'other';

export interface InventoryAttributes {
  id?: number;
  name: string;
  sku?: string;
  description?: string;
  quantity: number;
  unit: InventoryUnit;
  lowStockThreshold?: number;
  category?: InventoryCategory;
  location?: string;
  supplier?: string;
  cost?: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  lastRestockedAt?: Date;
  expiryDate?: Date;
  notes?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InventoryCreationAttributes extends Omit<InventoryAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Inventory extends Model<InventoryAttributes, InventoryCreationAttributes> implements InventoryAttributes {
  public id!: number;
  public name!: string;
  public sku?: string;
  public description?: string;
  public quantity!: number;
  public unit!: InventoryUnit;
  public lowStockThreshold!: number;
  public category?: InventoryCategory;
  public location?: string;
  public supplier?: string;
  public cost?: number;
  public reorderLevel!: number;
  public reorderQuantity!: number;
  public lastRestockedAt?: Date;
  public expiryDate?: Date;
  public notes?: string;
  public isActive!: boolean;

  // timestamps!
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public isLowStock(): boolean {
    return this.quantity <= this.lowStockThreshold;
  }

  public needsReorder(): boolean {
    return this.quantity <= this.reorderLevel;
  }

  public async adjustStock(change: number): Promise<Inventory> {
    const newQuantity = this.quantity + change;
    if (newQuantity < 0) {
      throw new Error(`Insufficient stock. Available: ${this.quantity}, Requested: ${Math.abs(change)}`);
    }
    this.quantity = newQuantity;
    if (change > 0) {
      this.lastRestockedAt = new Date();
    }
    await this.save();
    return this;
  }

  public static initialize(sequelize: Sequelize): void {
    Inventory.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            notEmpty: {
              msg: 'Item name cannot be empty',
            },
          },
        },
        sku: {
          type: DataTypes.STRING,
          unique: true,
          validate: {
            notEmpty: {
              msg: 'SKU cannot be empty if provided',
            },
          },
        },
        description: {
          type: DataTypes.TEXT,
        },
        quantity: {
          type: DataTypes.FLOAT,
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
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'units',
          validate: {
            isIn: {
              args: [['kg', 'g', 'liters', 'ml', 'units', 'pieces', 'bags', 'boxes', 'bottles', 'jars']],
              msg: 'Invalid unit type',
            },
          },
        },
        lowStockThreshold: {
          type: DataTypes.FLOAT,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Low stock threshold cannot be negative',
            },
          },
        },
        category: {
          type: DataTypes.STRING,
          validate: {
            isIn: {
              args: [['ingredients', 'packaging', 'supplies', 'equipment', 'consumables', 'other']],
              msg: 'Invalid category',
            },
          },
        },
        location: {
          type: DataTypes.STRING,
          comment: 'Storage location in the bakery',
        },
        supplier: {
          type: DataTypes.STRING,
        },
        cost: {
          type: DataTypes.FLOAT,
          validate: {
            min: {
              args: [0],
              msg: 'Cost cannot be negative',
            },
          },
        },
        reorderLevel: {
          type: DataTypes.FLOAT,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Reorder level cannot be negative',
            },
          },
        },
        reorderQuantity: {
          type: DataTypes.FLOAT,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Reorder quantity cannot be negative',
            },
          },
        },
        lastRestockedAt: {
          type: DataTypes.DATE,
        },
        expiryDate: {
          type: DataTypes.DATE,
        },
        notes: {
          type: DataTypes.TEXT,
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
        },
      },
      {
        sequelize,
        modelName: 'Inventory',
        tableName: 'Inventories',
        timestamps: true,
      }
    );
  }
}