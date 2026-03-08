import { DataTypes, Model, Sequelize } from 'sequelize'
import type ProductionBatch from './ProductionBatch'

export interface QualityCheckAttributes {
  name: string
  score: number
  passed: boolean
  notes?: string
}

export interface QualityResultAttributes {
  checkId: string
  performedBy: number
  performedAt: Date
  checks: QualityCheckAttributes[]
  overallScore: number
  passed: boolean
  notes?: string
  status: 'completed' | 'failed' | 'pending'
}

export interface ProductionIssueAttributes {
  id: string
  type: 'quality' | 'equipment' | 'timing' | 'resource' | 'other'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  reportedBy: number
  reportedAt: Date
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  impact?: 'low' | 'medium' | 'high' | 'unknown'
  resolution?: string
  resolvedBy?: number
  resolvedAt?: Date
}

export interface ProductionStepAttributes {
  id: number
  batchId: number
  stepIndex: number
  stepName: string
  stepType: 'active' | 'sleep' | 'manual' | 'quality_check'
  status:
    | 'pending'
    | 'ready'
    | 'in_progress'
    | 'waiting'
    | 'completed'
    | 'skipped'
    | 'failed'
  activities: string[]
  conditions: string[]
  parameters: Record<string, any>
  actualParameters?: Record<string, any>
  workflowNotes?: string
  notes?: string
  location?: string
  repeatCount: number
  requiredEquipment: string[]
  plannedDurationMinutes: number
  actualDurationMinutes?: number
  plannedStartTime?: Date
  plannedEndTime?: Date
  actualStartTime?: Date
  actualEndTime?: Date
  completedActivities?: string[]
  progress: number
  qualityCheckCompleted: boolean
  qualityResults?: Record<string, QualityResultAttributes>
  hasIssues: boolean
  issues?: ProductionIssueAttributes[]
  metadata?: Record<string, any>
  completedBy?: number
  statusChangeTime?: Date
  createdAt?: Date
  updatedAt?: Date
}

export interface ProductionStepCreationAttributes
  extends Omit<ProductionStepAttributes, 'id'> {}

class ProductionStep
  extends Model<ProductionStepAttributes, ProductionStepCreationAttributes>
  implements ProductionStepAttributes
{
  public id!: number
  public batchId!: number
  public stepIndex!: number
  public stepName!: string
  public stepType!: 'active' | 'sleep' | 'manual' | 'quality_check'
  public status!:
    | 'pending'
    | 'ready'
    | 'in_progress'
    | 'waiting'
    | 'completed'
    | 'skipped'
    | 'failed'
  public activities!: string[]
  public conditions!: string[]
  public parameters!: Record<string, any>
  public actualParameters?: Record<string, any>
  public workflowNotes?: string
  public notes?: string
  public location?: string
  public repeatCount!: number
  public requiredEquipment!: string[]
  public plannedDurationMinutes!: number
  public actualDurationMinutes?: number
  public plannedStartTime?: Date
  public plannedEndTime?: Date
  public actualStartTime?: Date
  public actualEndTime?: Date
  public completedActivities?: string[]
  public progress!: number
  public qualityCheckCompleted!: boolean
  public qualityResults?: Record<string, QualityResultAttributes>
  public hasIssues!: boolean
  public issues?: ProductionIssueAttributes[]
  public metadata?: Record<string, any>
  public completedBy?: number
  public statusChangeTime?: Date
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  // Association property (populated via include/eager loading)
  public batch?: ProductionBatch

  // Virtual properties for computed values
  public get isOverdue(): boolean {
    if (
      !this.plannedEndTime ||
      this.status === 'completed' ||
      this.status === 'skipped'
    ) {
      return false
    }
    return new Date() > this.plannedEndTime
  }

  public get activityProgress(): number {
    if (!this.activities || this.activities.length === 0) return 100
    if (!this.completedActivities || this.completedActivities.length === 0)
      return 0
    return Math.round(
      (this.completedActivities.length / this.activities.length) * 100
    )
  }

  public calculateProgress(): number {
    if (this.status === 'completed') return 100
    if (this.status === 'pending' || this.status === 'ready') return 0
    if (this.status === 'skipped' || this.status === 'failed') return 0

    // Calculate based on completed activities
    return this.activityProgress
  }

  public canStart(): boolean {
    return this.status === 'ready' || this.status === 'pending'
  }

  public canComplete(): boolean {
    return this.status === 'in_progress' && this.progress >= 100
  }

  static initModel(sequelize: Sequelize): typeof ProductionStep {
    ProductionStep.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        batchId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'production_batches',
            key: 'id',
          },
        },
        stepIndex: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: 0,
          },
        },
        stepName: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true,
          },
        },
        stepType: {
          type: DataTypes.ENUM('active', 'sleep', 'manual', 'quality_check'),
          allowNull: false,
          defaultValue: 'manual',
        },
        status: {
          type: DataTypes.ENUM(
            'pending',
            'ready',
            'in_progress',
            'waiting',
            'completed',
            'skipped',
            'failed'
          ),
          allowNull: false,
          defaultValue: 'pending',
        },
        activities: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            validateArray(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('activities must be an array')
              }
              if (!value.every((item: any) => typeof item === 'string')) {
                throw new Error('All activities must be strings')
              }
            },
          },
        },
        conditions: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            validateArray(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('conditions must be an array')
              }
              if (!value.every((item: any) => typeof item === 'string')) {
                throw new Error('All conditions must be strings')
              }
            },
          },
        },
        parameters: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: {},
        },
        actualParameters: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        workflowNotes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        location: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        repeatCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
          validate: {
            min: 1,
          },
        },
        requiredEquipment: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            validateArray(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('requiredEquipment must be an array')
              }
              if (!value.every((item: any) => typeof item === 'string')) {
                throw new Error('All equipment items must be strings')
              }
            },
          },
        },
        plannedDurationMinutes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: 0,
          },
        },
        actualDurationMinutes: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: 0,
          },
        },
        plannedStartTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        plannedEndTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        actualStartTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        actualEndTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        completedActivities: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: [],
          validate: {
            validateArray(value: any) {
              if (value && !Array.isArray(value)) {
                throw new Error('completedActivities must be an array')
              }
            },
          },
        },
        progress: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: 0,
            max: 100,
          },
        },
        qualityCheckCompleted: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        qualityResults: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        hasIssues: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        issues: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: [],
        },
        metadata: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: {},
        },
        completedBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        statusChangeTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'ProductionStep',
        tableName: 'production_steps',
        timestamps: true,
        indexes: [
          {
            fields: ['batchId', 'stepIndex'],
            unique: true,
          },
          {
            fields: ['batchId'],
          },
          {
            fields: ['status'],
          },
          {
            fields: ['stepType'],
          },
          {
            fields: ['completedBy'],
          },
          {
            fields: ['hasIssues'],
          },
        ],
        hooks: {
          beforeUpdate: (step: ProductionStep) => {
            // Track status change time
            const changed = step.changed()
            if (changed && changed.includes('status')) {
              step.statusChangeTime = new Date()
            }

            // Update progress based on completed activities
            if (step.activities && step.activities.length > 0) {
              step.progress = step.calculateProgress()
            }

            // Update hasIssues flag
            if (step.issues && Array.isArray(step.issues)) {
              step.hasIssues = step.issues.some(
                (issue: any) =>
                  issue.status === 'open' || issue.status === 'in_progress'
              )
            }
          },
        },
      }
    )
    return ProductionStep
  }
}

export default ProductionStep
