import { DataTypes, Model, Sequelize } from 'sequelize'

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

export interface ProductionBatchAttributes {
  id: number
  scheduleId?: number
  recipeId?: number
  name: string
  workflowId: string
  productId: number
  status: 'planned' | 'ready' | 'in_progress' | 'waiting' | 'completed' | 'failed' | 'cancelled'
  plannedQuantity: number
  actualQuantity?: number
  unit: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  plannedStartTime: Date
  plannedEndTime: Date
  actualStartTime?: Date
  actualEndTime?: Date
  estimatedDurationMinutes: number
  actualDurationMinutes?: number
  currentStepIndex: number
  assignedStaffIds: number[]
  assignedStaffId?: number
  requiredEquipment: string[]
  qualityResults?: QualityResultAttributes[]
  issues?: ProductionIssueAttributes[]
  metadata?: Record<string, any>
  notes?: string
  createdBy: number
  updatedBy?: number
  createdAt?: Date
  updatedAt?: Date
}

export interface ProductionBatchCreationAttributes
  extends Omit<ProductionBatchAttributes, 'id'> {}

class ProductionBatch
  extends Model<ProductionBatchAttributes, ProductionBatchCreationAttributes>
  implements ProductionBatchAttributes
{
  public id!: number
  public scheduleId?: number
  public recipeId?: number
  public name!: string
  public workflowId!: string
  public productId!: number
  public status!: 'planned' | 'ready' | 'in_progress' | 'waiting' | 'completed' | 'failed' | 'cancelled'
  public plannedQuantity!: number
  public actualQuantity?: number
  public unit!: string
  public priority!: 'low' | 'medium' | 'high' | 'urgent'
  public plannedStartTime!: Date
  public plannedEndTime!: Date
  public actualStartTime?: Date
  public actualEndTime?: Date
  public estimatedDurationMinutes!: number
  public actualDurationMinutes?: number
  public currentStepIndex!: number
  public assignedStaffIds!: number[]
  public assignedStaffId?: number
  public requiredEquipment!: string[]
  public qualityResults?: QualityResultAttributes[]
  public issues?: ProductionIssueAttributes[]
  public metadata?: Record<string, any>
  public notes?: string
  public createdBy!: number
  public updatedBy?: number
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  // Virtual properties for computed values
  public get progress(): number {
    if (this.status === 'completed') return 100
    if (this.status === 'planned' || this.status === 'ready') return 0
    if (this.status === 'cancelled' || this.status === 'failed') return 0
    // Calculate based on current step if available
    return Math.min(100, Math.round((this.currentStepIndex / 10) * 100))
  }

  public get isDelayed(): boolean {
    if (!this.plannedEndTime || !this.actualStartTime) return false
    const now = new Date()
    return this.status === 'in_progress' && now > this.plannedEndTime
  }

  public get delayMinutes(): number {
    if (!this.isDelayed) return 0
    const now = new Date()
    return Math.round((now.getTime() - this.plannedEndTime.getTime()) / (1000 * 60))
  }

  static initModel(sequelize: Sequelize): typeof ProductionBatch {
    ProductionBatch.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        scheduleId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'production_schedules',
            key: 'id',
          },
        },
        recipeId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'recipes',
            key: 'id',
          },
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true,
          },
        },
        workflowId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        productId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'products',
            key: 'id',
          },
        },
        status: {
          type: DataTypes.ENUM(
            'planned',
            'ready',
            'in_progress',
            'waiting',
            'completed',
            'failed',
            'cancelled'
          ),
          allowNull: false,
          defaultValue: 'planned',
        },
        plannedQuantity: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: 0,
          },
        },
        actualQuantity: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          validate: {
            min: 0,
          },
        },
        unit: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'units',
        },
        priority: {
          type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
          allowNull: false,
          defaultValue: 'medium',
        },
        plannedStartTime: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        plannedEndTime: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        actualStartTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        actualEndTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        estimatedDurationMinutes: {
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
        currentStepIndex: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        assignedStaffIds: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            isArray(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('assignedStaffIds must be an array')
              }
              if (!value.every((id: any) => typeof id === 'number')) {
                throw new Error('All staff IDs must be numbers')
              }
            },
          },
        },
        assignedStaffId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        requiredEquipment: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            isArray(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('requiredEquipment must be an array')
              }
              if (!value.every((item: any) => typeof item === 'string')) {
                throw new Error('All equipment items must be strings')
              }
            },
          },
        },
        qualityResults: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: [],
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
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        createdBy: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        updatedBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
        },
      },
      {
        sequelize,
        modelName: 'ProductionBatch',
        tableName: 'production_batches',
        timestamps: true,
        indexes: [
          {
            fields: ['scheduleId'],
          },
          {
            fields: ['recipeId'],
          },
          {
            fields: ['productId'],
          },
          {
            fields: ['status'],
          },
          {
            fields: ['priority'],
          },
          {
            fields: ['plannedStartTime'],
          },
          {
            fields: ['workflowId'],
          },
          {
            fields: ['assignedStaffId'],
          },
        ],
      }
    )
    return ProductionBatch
  }
}

export default ProductionBatch