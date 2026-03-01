import { DataTypes, Model, Sequelize } from 'sequelize'

export interface StaffShiftAttributes {
  start: string
  end: string
  role?: string
  skills?: string[]
  hours?: number
}

export interface EquipmentItemAttributes {
  id: string
  name: string
  type: string
  capacity?: number
  availableHours?: number
}

export interface PlannedBatchSummaryAttributes {
  id: string
  name: string
  workflowId: string
  productId: number
  quantity: number
  startTime: string
  endTime: string
  priority: string
}

export interface ProductionScheduleAttributes {
  id: number
  scheduleDate: Date
  scheduleType: 'daily' | 'weekly' | 'special'
  status: 'draft' | 'planned' | 'active' | 'completed' | 'cancelled'
  staffShifts: Record<string, StaffShiftAttributes>
  availableEquipment: EquipmentItemAttributes[]
  plannedBatches: PlannedBatchSummaryAttributes[]
  workdayStartTime: string
  workdayEndTime: string
  totalStaffHours: number
  estimatedProductionTime: number
  workdayMinutes: number
  efficiencyScore?: number
  capacityUtilization?: number
  completionPercentage?: number
  notes?: string
  createdBy: number
  approvedBy?: number
  approvedAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

export interface ProductionScheduleCreationAttributes
  extends Omit<ProductionScheduleAttributes, 'id'> {}

class ProductionSchedule
  extends Model<
    ProductionScheduleAttributes,
    ProductionScheduleCreationAttributes
  >
  implements ProductionScheduleAttributes
{
  public id!: number
  public scheduleDate!: Date
  public scheduleType!: 'daily' | 'weekly' | 'special'
  public status!: 'draft' | 'planned' | 'active' | 'completed' | 'cancelled'
  public staffShifts!: Record<string, StaffShiftAttributes>
  public availableEquipment!: EquipmentItemAttributes[]
  public plannedBatches!: PlannedBatchSummaryAttributes[]
  public workdayStartTime!: string
  public workdayEndTime!: string
  public totalStaffHours!: number
  public estimatedProductionTime!: number
  public workdayMinutes!: number
  public efficiencyScore?: number
  public capacityUtilization?: number
  public completionPercentage?: number
  public notes?: string
  public createdBy!: number
  public approvedBy?: number
  public approvedAt?: Date
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  // Helper methods for schedule management
  public calculateEfficiency(): number {
    if (this.workdayMinutes === 0) return 0
    return Math.round(
      (this.estimatedProductionTime / this.workdayMinutes) * 100
    )
  }

  public calculateCapacityUtilization(): number {
    if (this.totalStaffHours === 0) return 0
    const productionHours = this.estimatedProductionTime / 60
    return Math.round((productionHours / this.totalStaffHours) * 100)
  }

  public calculateCompletionPercentage(): number {
    if (this.status === 'completed') return 100
    if (this.status === 'draft' || this.status === 'planned') return 0
    if (this.status === 'cancelled') return 0

    // Could be calculated based on batch completion status
    // This would require joining with ProductionBatch table
    return 0
  }

  public getTotalPlannedQuantity(): number {
    return this.plannedBatches.reduce(
      (total, batch) => total + batch.quantity,
      0
    )
  }

  public getAvailableWorkers(): number {
    return Object.keys(this.staffShifts).length
  }

  static initModel(sequelize: Sequelize): typeof ProductionSchedule {
    ProductionSchedule.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        scheduleDate: {
          type: DataTypes.DATEONLY,
          allowNull: false,
        },
        scheduleType: {
          type: DataTypes.ENUM('daily', 'weekly', 'special'),
          allowNull: false,
          defaultValue: 'daily',
        },
        status: {
          type: DataTypes.ENUM(
            'draft',
            'planned',
            'active',
            'completed',
            'cancelled'
          ),
          allowNull: false,
          defaultValue: 'draft',
        },
        staffShifts: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: {},
          validate: {
            isValidShifts(value: any) {
              if (!value || typeof value !== 'object') {
                throw new Error('staffShifts must be an object')
              }
              Object.keys(value).forEach((staffId) => {
                const shift = value[staffId]
                if (!shift.start || !shift.end) {
                  throw new Error('Each shift must have start and end times')
                }
                const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
                if (
                  !timeRegex.test(shift.start) ||
                  !timeRegex.test(shift.end)
                ) {
                  throw new Error('Shift times must be in HH:MM format')
                }
              })
            },
          },
        },
        availableEquipment: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            validateArray(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('availableEquipment must be an array')
              }
              value.forEach((item: any) => {
                if (!item.id || !item.name || !item.type) {
                  throw new Error(
                    'Each equipment item must have id, name, and type'
                  )
                }
              })
            },
          },
        },
        plannedBatches: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            validateArray(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('plannedBatches must be an array')
              }
              value.forEach((batch: any) => {
                if (
                  !batch.id ||
                  !batch.name ||
                  !batch.workflowId ||
                  !batch.productId
                ) {
                  throw new Error('Each batch must have required fields')
                }
                if (typeof batch.quantity !== 'number' || batch.quantity <= 0) {
                  throw new Error('Batch quantity must be a positive number')
                }
              })
            },
          },
        },
        workdayStartTime: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '06:00',
          validate: {
            is: /^([01]\d|2[0-3]):([0-5]\d)$/,
          },
        },
        workdayEndTime: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '18:00',
          validate: {
            is: /^([01]\d|2[0-3]):([0-5]\d)$/,
          },
        },
        totalStaffHours: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: 0,
          },
        },
        estimatedProductionTime: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: 0,
          },
        },
        workdayMinutes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 720, // 12 hours default
          validate: {
            min: 0,
            max: 1440, // 24 hours max
          },
        },
        efficiencyScore: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: true,
          validate: {
            min: 0,
            max: 100,
          },
        },
        capacityUtilization: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: true,
          validate: {
            min: 0,
            max: 100,
          },
        },
        completionPercentage: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: true,
          validate: {
            min: 0,
            max: 100,
          },
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
        approvedBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        approvedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'ProductionSchedule',
        tableName: 'production_schedules',
        timestamps: true,
        indexes: [
          {
            unique: true,
            fields: ['scheduleDate', 'scheduleType'],
          },
          {
            fields: ['status'],
          },
          {
            fields: ['scheduleType'],
          },
          {
            fields: ['createdBy'],
          },
          {
            fields: ['approvedBy'],
          },
        ],
        hooks: {
          beforeSave: (schedule: ProductionSchedule) => {
            // Calculate workday minutes based on start and end times
            const [startHour, startMin] = schedule.workdayStartTime
              .split(':')
              .map(Number)
            const [endHour, endMin] = schedule.workdayEndTime
              .split(':')
              .map(Number)
            schedule.workdayMinutes =
              endHour * 60 + endMin - (startHour * 60 + startMin)

            // Calculate total staff hours
            let totalHours = 0
            Object.values(schedule.staffShifts).forEach((shift) => {
              if (shift.hours) {
                totalHours += shift.hours
              } else {
                const [shiftStartHour, shiftStartMin] = shift.start
                  .split(':')
                  .map(Number)
                const [shiftEndHour, shiftEndMin] = shift.end
                  .split(':')
                  .map(Number)
                const shiftMinutes =
                  shiftEndHour * 60 +
                  shiftEndMin -
                  (shiftStartHour * 60 + shiftStartMin)
                totalHours += shiftMinutes / 60
              }
            })
            schedule.totalStaffHours = totalHours

            // Update efficiency and capacity scores
            schedule.efficiencyScore = schedule.calculateEfficiency()
            schedule.capacityUtilization =
              schedule.calculateCapacityUtilization()
          },
        },
      }
    )
    return ProductionSchedule
  }
}

export default ProductionSchedule
