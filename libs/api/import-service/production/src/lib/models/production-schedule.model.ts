import { Model, DataTypes, Sequelize, CreationOptional, Association } from 'sequelize';
import { logger } from '@bakery/api/core';

export interface ProductionScheduleAttributes {
  id: number;
  scheduleDate: string; // DATEONLY stored as string
  scheduleType: 'daily' | 'weekly' | 'special';
  workdayStartTime: string; // TIME stored as string
  workdayEndTime: string; // TIME stored as string
  availableStaffIds: number[];
  staffShifts: Record<string, { start: string; end: string; role: string }>;
  totalStaffHours: number | null;
  availableEquipment: string[];
  equipmentSchedule: Record<string, Array<{ start: string; end: string; batchId: number }>>;
  plannedBatches: number[];
  totalPlannedItems: number;
  estimatedProductionTime: number | null;
  status: 'draft' | 'planned' | 'active' | 'completed' | 'cancelled';
  actualStartTime: string | null; // TIME stored as string
  actualEndTime: string | null; // TIME stored as string
  completedBatches: number[];
  dailyTargets: Record<string, number>;
  actualProduction: Record<string, number>;
  qualityIssues: Array<{ time: string; issue: string; severity: string }>;
  efficiencyMetrics: Record<string, number>;
  environmentalConditions: Record<string, any>;
  specialRequests: Array<{ request: string; priority: string }>;
  holidays: string[];
  planningNotes: string | null;
  dailyNotes: string | null;
  alerts: Array<{ type: string; message: string; timestamp: string }>;
  notificationsSent: Array<{ type: string; recipient: string; timestamp: string }>;
  metadata: Record<string, any>;
  createdBy: number | null;
  approvedBy: number | null;
  approvedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export interface ProductionScheduleCreationAttributes extends Omit<ProductionScheduleAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  id?: number;
}

export class ProductionSchedule extends Model<ProductionScheduleAttributes, ProductionScheduleCreationAttributes> implements ProductionScheduleAttributes {
  public id!: number;
  public scheduleDate!: string;
  public scheduleType!: 'daily' | 'weekly' | 'special';
  public workdayStartTime!: string;
  public workdayEndTime!: string;
  public availableStaffIds!: number[];
  public staffShifts!: Record<string, { start: string; end: string; role: string }>;
  public totalStaffHours!: CreationOptional<number | null>;
  public availableEquipment!: string[];
  public equipmentSchedule!: Record<string, Array<{ start: string; end: string; batchId: number }>>;
  public plannedBatches!: number[];
  public totalPlannedItems!: number;
  public estimatedProductionTime!: CreationOptional<number | null>;
  public status!: 'draft' | 'planned' | 'active' | 'completed' | 'cancelled';
  public actualStartTime!: CreationOptional<string | null>;
  public actualEndTime!: CreationOptional<string | null>;
  public completedBatches!: number[];
  public dailyTargets!: Record<string, number>;
  public actualProduction!: Record<string, number>;
  public qualityIssues!: Array<{ time: string; issue: string; severity: string }>;
  public efficiencyMetrics!: Record<string, number>;
  public environmentalConditions!: Record<string, any>;
  public specialRequests!: Array<{ request: string; priority: string }>;
  public holidays!: string[];
  public planningNotes!: CreationOptional<string | null>;
  public dailyNotes!: CreationOptional<string | null>;
  public alerts!: Array<{ type: string; message: string; timestamp: string }>;
  public notificationsSent!: Array<{ type: string; recipient: string; timestamp: string }>;
  public metadata!: Record<string, any>;
  public createdBy!: CreationOptional<number | null>;
  public approvedBy!: CreationOptional<number | null>;
  public approvedAt!: CreationOptional<Date | null>;
  
  // timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date | null;

  // Associations
  public readonly creator?: any; // User who created
  public readonly approver?: any; // User who approved
  public readonly batches?: any[]; // ProductionBatch instances

  public static override associations: {
    creator: Association<ProductionSchedule, any>;
    approver: Association<ProductionSchedule, any>;
    batches: Association<ProductionSchedule, any>;
  };

  // Getter methods
  public get plannedWorkdayMinutes(): number {
    if (!this.workdayStartTime || !this.workdayEndTime) return 0;
    
    const start = new Date(`1970-01-01T${this.workdayStartTime}`);
    const end = new Date(`1970-01-01T${this.workdayEndTime}`);
    
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  public get actualWorkdayMinutes(): number | null {
    if (!this.actualStartTime || !this.actualEndTime) return null;
    
    const start = new Date(`1970-01-01T${this.actualStartTime}`);
    const end = new Date(`1970-01-01T${this.actualEndTime}`);
    
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  public get staffUtilization(): number {
    if (!this.totalStaffHours || this.totalStaffHours === 0) return 0;
    const plannedMinutes = this.plannedWorkdayMinutes;
    if (!plannedMinutes) return 0;
    
    return Math.round((this.totalStaffHours * 60 / plannedMinutes) * 100);
  }

  public get completionPercentage(): number {
    if (!this.plannedBatches || this.plannedBatches.length === 0) return 0;
    if (!this.completedBatches) return 0;
    
    return Math.round((this.completedBatches.length / this.plannedBatches.length) * 100);
  }

  public get isOverrun(): boolean {
    if (this.status !== 'active') return false;
    if (!this.workdayEndTime) return false;
    
    const now = new Date();
    const endTime = new Date(`${this.scheduleDate}T${this.workdayEndTime}`);
    
    return now > endTime;
  }

  public get capacityUtilization(): number {
    if (!this.estimatedProductionTime || !this.totalStaffHours) return 0;
    
    const totalCapacityMinutes = this.totalStaffHours * 60;
    return Math.round((this.estimatedProductionTime / totalCapacityMinutes) * 100);
  }

  public get activeBatches(): number[] {
    if (!this.plannedBatches || !this.completedBatches) return this.plannedBatches || [];
    
    return this.plannedBatches.filter(batchId => !this.completedBatches.includes(batchId));
  }

  public get needsAttention(): boolean {
    return this.isOverrun || 
           this.alerts.length > 0 || 
           (this.qualityIssues && this.qualityIssues.length > 0) ||
           (this.status === 'active' && this.completionPercentage < 50 && this.isOverrun);
  }

  public get efficiencyScore(): number | null {
    if (this.status !== 'completed') return null;
    
    let score = 100;
    
    // Deduct for delays
    if (this.isOverrun) score -= 20;
    
    // Deduct for quality issues
    if (this.qualityIssues && this.qualityIssues.length > 0) {
      score -= Math.min(this.qualityIssues.length * 10, 30);
    }
    
    // Adjust for completion rate
    score = Math.round(score * (this.completionPercentage / 100));
    
    return Math.max(score, 0);
  }

  public get isPast(): boolean {
    return new Date(this.scheduleDate) < new Date(new Date().toISOString().split('T')[0]);
  }

  public get isToday(): boolean {
    const today = new Date().toISOString().split('T')[0];
    return this.scheduleDate === today;
  }

  public get isFuture(): boolean {
    return new Date(this.scheduleDate) > new Date(new Date().toISOString().split('T')[0]);
  }

  // Instance methods
  public async startProduction(): Promise<void> {
    this.actualStartTime = new Date().toTimeString().split(' ')[0];
    this.status = 'active';
    await this.save();
    logger.info(`Production schedule for ${this.scheduleDate} started`);
  }

  public async completeProduction(): Promise<void> {
    this.actualEndTime = new Date().toTimeString().split(' ')[0];
    this.status = 'completed';
    await this.save();
    logger.info(`Production schedule for ${this.scheduleDate} completed`);
  }

  public async addAlert(type: string, message: string): Promise<void> {
    this.alerts.push({
      type,
      message,
      timestamp: new Date().toISOString()
    });
    await this.save();
    logger.warn(`Alert added to schedule ${this.scheduleDate}: ${type} - ${message}`);
  }

  public static initModel(sequelize: Sequelize): typeof ProductionSchedule {
    ProductionSchedule.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        scheduleDate: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          unique: true,
          comment: 'Date for this production schedule',
        },
        scheduleType: {
          type: DataTypes.ENUM('daily', 'weekly', 'special'),
          defaultValue: 'daily',
          allowNull: false,
        },
        workdayStartTime: {
          type: DataTypes.TIME,
          allowNull: false,
          defaultValue: '06:00:00',
          comment: 'Start of production day',
        },
        workdayEndTime: {
          type: DataTypes.TIME,
          allowNull: false,
          defaultValue: '18:00:00',
          comment: 'End of production day',
        },
        availableStaffIds: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'Staff members available for this schedule',
        },
        staffShifts: {
          type: DataTypes.JSON,
          defaultValue: {},
          comment: 'Staff shift assignments {staffId: {start, end, role}}',
        },
        totalStaffHours: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: true,
          comment: 'Total available staff hours for the day',
        },
        availableEquipment: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'Available equipment/stations for the day',
        },
        equipmentSchedule: {
          type: DataTypes.JSON,
          defaultValue: {},
          comment: 'Equipment booking schedule {equipment: [{start, end, batchId}]}',
        },
        plannedBatches: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'List of planned batch IDs for this schedule',
        },
        totalPlannedItems: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          comment: 'Total number of items planned for production',
        },
        estimatedProductionTime: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: 'Estimated total production time in minutes',
        },
        status: {
          type: DataTypes.ENUM('draft', 'planned', 'active', 'completed', 'cancelled'),
          defaultValue: 'draft',
          allowNull: false,
        },
        actualStartTime: {
          type: DataTypes.TIME,
          allowNull: true,
          comment: 'When production actually started',
        },
        actualEndTime: {
          type: DataTypes.TIME,
          allowNull: true,
          comment: 'When production actually ended',
        },
        completedBatches: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'List of completed batch IDs',
        },
        dailyTargets: {
          type: DataTypes.JSON,
          defaultValue: {},
          comment: 'Daily production targets by product category',
        },
        actualProduction: {
          type: DataTypes.JSON,
          defaultValue: {},
          comment: 'Actual production numbers by category',
        },
        qualityIssues: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'Quality issues encountered during the day',
        },
        efficiencyMetrics: {
          type: DataTypes.JSON,
          defaultValue: {},
          comment: 'Efficiency metrics (utilization, waste, delays)',
        },
        environmentalConditions: {
          type: DataTypes.JSON,
          defaultValue: {},
          comment: 'Temperature, humidity, etc. that affect production',
        },
        specialRequests: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'Special orders or requirements for this date',
        },
        holidays: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'Holidays or special events affecting production',
        },
        planningNotes: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Notes from production planning',
        },
        dailyNotes: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Notes from actual production day',
        },
        alerts: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'Active alerts for this schedule',
        },
        notificationsSent: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: 'Log of notifications sent',
        },
        metadata: {
          type: DataTypes.JSON,
          defaultValue: {},
          comment: 'Additional schedule metadata',
        },
        createdBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: 'User who created this schedule',
        },
        approvedBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: 'User who approved this schedule',
        },
        approvedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'When this schedule was approved',
        },
      },
      {
        sequelize,
        modelName: 'ProductionSchedule',
        tableName: 'production_schedules',
        timestamps: true,
        paranoid: true,
      }
    );

    return ProductionSchedule;
  }

  public static associate(models: any): void {
    // ProductionSchedule belongs to User (creator)
    if (models.User || models.Customer) {
      const UserModel = models.User || models.Customer;
      ProductionSchedule.belongsTo(UserModel, {
        foreignKey: 'createdBy',
        as: 'creator',
      });
      ProductionSchedule.belongsTo(UserModel, {
        foreignKey: 'approvedBy',
        as: 'approver',
      });
    }

    // ProductionSchedule has many ProductionBatches (through plannedBatches)
    // This would be a virtual association based on the plannedBatches array
  }
}