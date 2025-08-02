import { Model, DataTypes, Sequelize, CreationOptional, Association } from 'sequelize';
import { logger } from '@bakery/api/core';

export interface ProductionStepAttributes {
  id: number;
  batchId: number;
  stepIndex: number;
  stepName: string;
  stepType: string;
  plannedStartTime: Date | null;
  plannedEndTime: Date | null;
  actualStartTime: Date | null;
  actualEndTime: Date | null;
  plannedDurationMinutes: number | null;
  status: 'pending' | 'ready' | 'in_progress' | 'waiting' | 'completed' | 'skipped' | 'failed';
  progress: number;
  activities: string[];
  completedActivities: string[];
  conditions: Array<{ type: string; value: any; unit?: string }>;
  parameters: Record<string, any>;
  actualParameters: Record<string, any>;
  assignedStaffIds: number[];
  requiredEquipment: string[];
  location: string | null;
  qualityCheckRequired: boolean;
  qualityCheckCompleted: boolean;
  qualityResults: Record<string, any>;
  hasIssues: boolean;
  issues: Array<{ timestamp: string; issue: string; severity: string }>;
  notes: string | null;
  workflowNotes: string | null;
  repeatCount: number;
  currentRepeat: number;
  metadata: Record<string, any>;
  completedBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export interface ProductionStepCreationAttributes extends Omit<ProductionStepAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  id?: number;
}

export class ProductionStep extends Model<ProductionStepAttributes, ProductionStepCreationAttributes> implements ProductionStepAttributes {
  public id!: number;
  public batchId!: number;
  public stepIndex!: number;
  public stepName!: string;
  public stepType!: string;
  public plannedStartTime!: CreationOptional<Date | null>;
  public plannedEndTime!: CreationOptional<Date | null>;
  public actualStartTime!: CreationOptional<Date | null>;
  public actualEndTime!: CreationOptional<Date | null>;
  public plannedDurationMinutes!: CreationOptional<number | null>;
  public status!: 'pending' | 'ready' | 'in_progress' | 'waiting' | 'completed' | 'skipped' | 'failed';
  public progress!: number;
  public activities!: string[];
  public completedActivities!: string[];
  public conditions!: Array<{ type: string; value: any; unit?: string }>;
  public parameters!: Record<string, any>;
  public actualParameters!: Record<string, any>;
  public assignedStaffIds!: number[];
  public requiredEquipment!: string[];
  public location!: CreationOptional<string | null>;
  public qualityCheckRequired!: boolean;
  public qualityCheckCompleted!: boolean;
  public qualityResults!: Record<string, any>;
  public hasIssues!: boolean;
  public issues!: Array<{ timestamp: string; issue: string; severity: string }>;
  public notes!: CreationOptional<string | null>;
  public workflowNotes!: CreationOptional<string | null>;
  public repeatCount!: number;
  public currentRepeat!: number;
  public metadata!: Record<string, any>;
  public completedBy!: CreationOptional<number | null>;
  
  // timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date | null;

  // Associations
  public readonly batch?: any; // ProductionBatch
  public readonly completedByUser?: any; // User who completed

  public static override associations: {
    batch: Association<ProductionStep, any>;
    completedByUser: Association<ProductionStep, any>;
  };

  // Getter methods
  public get actualDurationMinutes(): number | null {
    if (this.actualStartTime && this.actualEndTime) {
      return Math.round((new Date(this.actualEndTime).getTime() - new Date(this.actualStartTime).getTime()) / (1000 * 60));
    }
    return null;
  }

  public get isOverdue(): boolean {
    if (this.status === 'completed' || this.status === 'skipped' || this.status === 'failed') {
      return false;
    }
    if (!this.plannedEndTime) return false;
    return new Date() > new Date(this.plannedEndTime);
  }

  public get delayMinutes(): number {
    if (!this.isOverdue) return 0;
    return Math.round((new Date().getTime() - new Date(this.plannedEndTime!).getTime()) / (1000 * 60));
  }

  public get activityProgress(): number {
    if (!this.activities || this.activities.length === 0) return 100;
    return Math.round((this.completedActivities.length / this.activities.length) * 100);
  }

  public get needsAttention(): boolean {
    return this.hasIssues || this.isOverdue || 
           (this.qualityCheckRequired && !this.qualityCheckCompleted && this.status === 'completed');
  }

  public get nextActivity(): string | null {
    if (!this.activities || this.activities.length === 0) return null;
    return this.activities.find(activity => !this.completedActivities.includes(activity)) || null;
  }

  public get isReadyToStart(): boolean {
    return this.status === 'ready' || (this.status === 'pending' && this.plannedStartTime !== null && this.plannedStartTime <= new Date());
  }

  public get canComplete(): boolean {
    if (this.status !== 'in_progress') return false;
    if (this.activities && this.activities.length > 0) {
      return this.completedActivities.length === this.activities.length;
    }
    return true;
  }

  // Instance methods
  public async startStep(): Promise<void> {
    this.actualStartTime = new Date();
    this.status = 'in_progress';
    await this.save();
    logger.info(`Production step ${this.id} (${this.stepName}) started`);
  }

  public async completeStep(completedById: number): Promise<void> {
    this.actualEndTime = new Date();
    this.status = 'completed';
    this.completedBy = completedById;
    this.progress = 100;
    await this.save();
    logger.info(`Production step ${this.id} (${this.stepName}) completed by user ${completedById}`);
  }

  public async completeActivity(activity: string): Promise<void> {
    if (!this.completedActivities.includes(activity) && this.activities.includes(activity)) {
      this.completedActivities = [...this.completedActivities, activity];
      this.progress = this.activityProgress;
      await this.save();
      logger.info(`Activity "${activity}" completed for step ${this.id}`);
    }
  }

  public async reportIssue(issue: string, severity: string = 'medium'): Promise<void> {
    this.hasIssues = true;
    this.issues = [...this.issues, {
      timestamp: new Date().toISOString(),
      issue,
      severity
    }];
    await this.save();
    logger.warn(`Issue reported for step ${this.id}: ${issue} (${severity})`);
  }

  public static initModel(sequelize: Sequelize): typeof ProductionStep {
    ProductionStep.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        batchId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          comment: 'Reference to ProductionBatch',
        },
        stepIndex: {
          type: DataTypes.INTEGER,
          allowNull: false,
          comment: 'Order of this step in the workflow (0-based)',
        },
        stepName: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: 'Name of the step from workflow definition',
        },
        stepType: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'active',
          comment: 'Type: active, sleep, quality_check, etc.',
        },
        plannedStartTime: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'When this step should start',
        },
        plannedEndTime: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'When this step should finish',
        },
        actualStartTime: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'When this step actually started',
        },
        actualEndTime: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'When this step actually finished',
        },
        plannedDurationMinutes: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: 'Expected duration in minutes',
        },
        status: {
          type: DataTypes.ENUM('pending', 'ready', 'in_progress', 'waiting', 'completed', 'skipped', 'failed'),
          defaultValue: 'pending',
          allowNull: false,
        },
        progress: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          allowNull: false,
          validate: {
            min: 0,
            max: 100
          },
          comment: 'Progress percentage within this step',
        },
        activities: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'List of activities from workflow definition',
        },
        completedActivities: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'List of completed activities',
        },
        conditions: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'Conditions from workflow (temperature, etc.)',
        },
        parameters: {
          type: DataTypes.JSON,
          defaultValue: {},
          comment: 'Step parameters (temperature, time, etc.)',
        },
        actualParameters: {
          type: DataTypes.JSON,
          defaultValue: {},
          comment: 'Actual recorded parameters',
        },
        assignedStaffIds: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'Staff assigned to this specific step',
        },
        requiredEquipment: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'Equipment needed for this step',
        },
        location: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: 'Where this step takes place',
        },
        qualityCheckRequired: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: 'Whether this step requires quality inspection',
        },
        qualityCheckCompleted: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: 'Whether quality check was completed',
        },
        qualityResults: {
          type: DataTypes.JSON,
          defaultValue: {},
          comment: 'Quality check results and measurements',
        },
        hasIssues: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: 'Whether this step has reported issues',
        },
        issues: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'List of issues encountered during this step',
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Step-specific notes and observations',
        },
        workflowNotes: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Notes from the workflow definition',
        },
        repeatCount: {
          type: DataTypes.INTEGER,
          defaultValue: 1,
          comment: 'How many times this step should repeat',
        },
        currentRepeat: {
          type: DataTypes.INTEGER,
          defaultValue: 1,
          comment: 'Current repetition number',
        },
        metadata: {
          type: DataTypes.JSON,
          defaultValue: {},
          comment: 'Additional step metadata',
        },
        completedBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: 'User ID who marked this step complete',
        },
      },
      {
        sequelize,
        modelName: 'ProductionStep',
        tableName: 'production_steps',
        timestamps: true,
        paranoid: true,
        indexes: [
          {
            unique: true,
            fields: ['batchId', 'stepIndex'],
          },
        ],
      }
    );

    return ProductionStep;
  }

  public static associate(models: any): void {
    // ProductionStep belongs to ProductionBatch
    if (models.ProductionBatch) {
      ProductionStep.belongsTo(models.ProductionBatch, {
        foreignKey: 'batchId',
        as: 'batch',
      });
    }

    // ProductionStep belongs to User (completedBy)
    if (models.User || models.Customer) {
      const UserModel = models.User || models.Customer;
      ProductionStep.belongsTo(UserModel, {
        foreignKey: 'completedBy',
        as: 'completedByUser',
      });
    }
  }
}