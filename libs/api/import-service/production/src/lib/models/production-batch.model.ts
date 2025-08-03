import { Model, DataTypes, Sequelize, CreationOptional, Association } from 'sequelize';
import { logger } from '@bakery/api/core';

export interface ProductionBatchAttributes {
  id: number;
  name: string;
  workflowId: string;
  productId: number | null;
  plannedStartTime: Date;
  plannedEndTime: Date;
  actualStartTime: Date | null;
  actualEndTime: Date | null;
  plannedQuantity: number;
  actualQuantity: number | null;
  unit: string;
  status: 'planned' | 'ready' | 'in_progress' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  currentStepIndex: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedStaffIds: number[];
  requiredEquipment: string[];
  allocatedEquipment: string[];
  notes: string | null;
  qualityNotes: string | null;
  metadata: Record<string, any>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export interface ProductionBatchCreationAttributes extends Omit<ProductionBatchAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  id?: number;
}

export class ProductionBatch extends Model<ProductionBatchAttributes, ProductionBatchCreationAttributes> implements ProductionBatchAttributes {
  public id!: number;
  public name!: string;
  public workflowId!: string;
  public productId!: number | null;
  public plannedStartTime!: Date;
  public plannedEndTime!: Date;
  public actualStartTime!: CreationOptional<Date | null>;
  public actualEndTime!: CreationOptional<Date | null>;
  public plannedQuantity!: number;
  public actualQuantity!: CreationOptional<number | null>;
  public unit!: string;
  public status!: 'planned' | 'ready' | 'in_progress' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  public currentStepIndex!: number;
  public priority!: 'low' | 'medium' | 'high' | 'urgent';
  public assignedStaffIds!: number[];
  public requiredEquipment!: string[];
  public allocatedEquipment!: string[];
  public notes!: CreationOptional<string | null>;
  public qualityNotes!: CreationOptional<string | null>;
  public metadata!: Record<string, any>;
  public createdBy!: CreationOptional<number | null>;
  public updatedBy!: CreationOptional<number | null>;
  
  // timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date | null;

  // Associations
  public readonly product?: any; // Will be properly typed when Product model is available
  public readonly productionSteps?: any[];
  public readonly creator?: any; // User who created
  public readonly updater?: any; // User who updated

  public static override associations: {
    product: Association<ProductionBatch, any>;
    productionSteps: Association<ProductionBatch, any>;
    creator: Association<ProductionBatch, any>;
    updater: Association<ProductionBatch, any>;
  };

  // Getter methods
  public get plannedDuration(): number | null {
    if (this.plannedStartTime && this.plannedEndTime) {
      return Math.round((new Date(this.plannedEndTime).getTime() - new Date(this.plannedStartTime).getTime()) / (1000 * 60)); // minutes
    }
    return null;
  }

  public get actualDuration(): number | null {
    if (this.actualStartTime && this.actualEndTime) {
      return Math.round((new Date(this.actualEndTime).getTime() - new Date(this.actualStartTime).getTime()) / (1000 * 60)); // minutes
    }
    return null;
  }

  public get progress(): number {
    if (this.status === 'completed') return 100;
    if (this.status === 'failed' || this.status === 'cancelled') return 0;
    if (this.status === 'planned' || this.status === 'ready') return 0;
    
    // For in_progress, calculate based on current step
    // This would need to be enhanced with actual workflow step data
    return Math.min(Math.round((this.currentStepIndex / 10) * 100), 90); // Rough estimate
  }

  public get isActive(): boolean {
    return ['ready', 'in_progress', 'waiting'].includes(this.status);
  }

  public get isCompleted(): boolean {
    return ['completed', 'failed', 'cancelled'].includes(this.status);
  }

  public get isDelayed(): boolean {
    if (this.status === 'completed' || this.status === 'failed' || this.status === 'cancelled') {
      return false;
    }
    const now = new Date();
    return now > new Date(this.plannedEndTime);
  }

  public get delayMinutes(): number {
    if (!this.isDelayed) return 0;
    const now = new Date();
    return Math.round((now.getTime() - new Date(this.plannedEndTime).getTime()) / (1000 * 60));
  }

  // Instance methods
  public async startProduction(): Promise<void> {
    this.actualStartTime = new Date();
    this.status = 'in_progress';
    await this.save();
    logger.info(`Production batch ${this.id} started`);
  }

  public async completeProduction(actualQuantity: number): Promise<void> {
    this.actualEndTime = new Date();
    this.actualQuantity = actualQuantity;
    this.status = 'completed';
    await this.save();
    logger.info(`Production batch ${this.id} completed with quantity: ${actualQuantity}`);
  }

  public async updateStep(stepIndex: number): Promise<void> {
    this.currentStepIndex = stepIndex;
    await this.save();
    logger.info(`Production batch ${this.id} moved to step ${stepIndex}`);
  }

  public static initModel(sequelize: Sequelize): typeof ProductionBatch {
    ProductionBatch.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: 'Human-readable name for the batch (e.g., "Morning Croissants")',
        },
        workflowId: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: 'Reference to the YAML workflow definition',
        },
        productId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: 'Optional reference to specific product',
        },
        plannedStartTime: {
          type: DataTypes.DATE,
          allowNull: false,
          comment: 'When this batch should start',
        },
        plannedEndTime: {
          type: DataTypes.DATE,
          allowNull: false,
          comment: 'Expected completion time',
        },
        actualStartTime: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'When production actually started',
        },
        actualEndTime: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'When production actually finished',
        },
        plannedQuantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
          comment: 'Number of units planned to produce',
        },
        actualQuantity: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: 'Actual number of units produced',
        },
        unit: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'pieces',
          comment: 'Unit of measurement (pieces, kg, loaves, etc.)',
        },
        status: {
          type: DataTypes.ENUM('planned', 'ready', 'in_progress', 'waiting', 'completed', 'failed', 'cancelled'),
          defaultValue: 'planned',
          allowNull: false,
        },
        currentStepIndex: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          allowNull: false,
          comment: 'Current step in the workflow (0-based index)',
        },
        priority: {
          type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
          defaultValue: 'medium',
          allowNull: false,
        },
        assignedStaffIds: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'Array of staff member IDs assigned to this batch',
        },
        requiredEquipment: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'List of required equipment/stations',
        },
        allocatedEquipment: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'Actually allocated equipment/stations',
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'General notes about this batch',
        },
        qualityNotes: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Quality control notes and observations',
        },
        metadata: {
          type: DataTypes.JSON,
          defaultValue: {},
          comment: 'Additional metadata (temperatures, conditions, etc.)',
        },
        createdBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: 'User ID who created this batch',
        },
        updatedBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: 'User ID who last updated this batch',
        },
      },
      {
        sequelize,
        modelName: 'ProductionBatch',
        tableName: 'production_batches',
        timestamps: true,
        paranoid: true, // Soft deletes
      }
    );

    return ProductionBatch;
  }

  public static associate(models: any): void {
    // ProductionBatch belongs to Product
    if (models.Product) {
      ProductionBatch.belongsTo(models.Product, {
        foreignKey: 'productId',
        as: 'product',
      });
    }

    // ProductionBatch has many ProductionSteps
    if (models.ProductionStep) {
      ProductionBatch.hasMany(models.ProductionStep, {
        foreignKey: 'batchId',
        as: 'productionSteps',
      });
    }

    // ProductionBatch belongs to User (creator)
    if (models.User || models.Customer) {
      const UserModel = models.User || models.Customer;
      ProductionBatch.belongsTo(UserModel, {
        foreignKey: 'createdBy',
        as: 'creator',
      });
      ProductionBatch.belongsTo(UserModel, {
        foreignKey: 'updatedBy',
        as: 'updater',
      });
    }
  }
}