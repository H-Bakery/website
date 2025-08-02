/**
 * ProductionSchedule Model
 * Represents daily/weekly production schedules with capacity planning
 */
module.exports = (sequelize, DataTypes) => {
  const ProductionSchedule = sequelize.define('ProductionSchedule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  
  // Date and Time
  scheduleDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Date for this production schedule',
  },
  
  scheduleType: {
    type: DataTypes.ENUM,
    values: ['daily', 'weekly', 'special'],
    defaultValue: 'daily',
    allowNull: false,
  },
  
  // Working Hours
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
  
  // Staff Capacity
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
  
  // Equipment and Stations
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
  
  // Capacity Planning
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
  
  // Status and Progress
  status: {
    type: DataTypes.ENUM,
    values: ['draft', 'planned', 'active', 'completed', 'cancelled'],
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
  
  // Production Targets
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
  
  // Quality and Efficiency
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
  
  // Environmental Conditions
  environmentalConditions: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Temperature, humidity, etc. that affect production',
  },
  
  // Special Events
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
  
  // Notes and Comments
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
  
  // Alerts and Notifications
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
  
  // Metadata
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Additional schedule metadata',
  },
  
  // Audit
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
  
}, {
  tableName: 'production_schedules',
  timestamps: true,
  paranoid: true,
  
  // indexes: [
  //   {
  //     fields: ['scheduleDate'],
  //     name: 'idx_schedule_date',
  //     unique: true
  //   },
  //   {
  //     fields: ['status'],
  //     name: 'idx_schedule_status'
  //   },
  //   {
  //     fields: ['scheduleType'],
  //     name: 'idx_schedule_type'
  //   },
  //   {
  //     fields: ['scheduleDate', 'status'],
  //     name: 'idx_date_status'
  //   },
  //   {
  //     fields: ['createdBy'],
  //     name: 'idx_created_by'
  //   },
  //   {
  //     fields: ['approvedBy'],
  //     name: 'idx_approved_by'
  //   }
  // ],
  
  getterMethods: {
    // Calculate planned workday duration in minutes
    plannedWorkdayMinutes() {
      if (!this.workdayStartTime || !this.workdayEndTime) return 0;
      
      const start = new Date(`1970-01-01T${this.workdayStartTime}`);
      const end = new Date(`1970-01-01T${this.workdayEndTime}`);
      
      return Math.round((end - start) / (1000 * 60));
    },
    
    // Calculate actual workday duration
    actualWorkdayMinutes() {
      if (!this.actualStartTime || !this.actualEndTime) return null;
      
      const start = new Date(`1970-01-01T${this.actualStartTime}`);
      const end = new Date(`1970-01-01T${this.actualEndTime}`);
      
      return Math.round((end - start) / (1000 * 60));
    },
    
    // Staff utilization percentage
    staffUtilization() {
      if (!this.totalStaffHours || this.totalStaffHours === 0) return 0;
      const plannedMinutes = this.plannedWorkdayMinutes;
      if (!plannedMinutes) return 0;
      
      return Math.round((this.totalStaffHours * 60 / plannedMinutes) * 100);
    },
    
    // Production completion percentage
    completionPercentage() {
      if (!this.plannedBatches || this.plannedBatches.length === 0) return 0;
      if (!this.completedBatches) return 0;
      
      return Math.round((this.completedBatches.length / this.plannedBatches.length) * 100);
    },
    
    // Check if schedule is overrun
    isOverrun() {
      if (this.status !== 'active') return false;
      if (!this.workdayEndTime) return false;
      
      const now = new Date();
      const endTime = new Date(`${this.scheduleDate}T${this.workdayEndTime}`);
      
      return now > endTime;
    },
    
    // Calculate capacity utilization
    capacityUtilization() {
      if (!this.estimatedProductionTime || !this.totalStaffHours) return 0;
      
      const totalCapacityMinutes = this.totalStaffHours * 60;
      return Math.round((this.estimatedProductionTime / totalCapacityMinutes) * 100);
    },
    
    // Get active batches
    activeBatches() {
      if (!this.plannedBatches || !this.completedBatches) return this.plannedBatches || [];
      
      return this.plannedBatches.filter(batchId => !this.completedBatches.includes(batchId));
    },
    
    // Check if schedule needs attention
    needsAttention() {
      return this.isOverrun || 
             this.alerts.length > 0 || 
             (this.qualityIssues && this.qualityIssues.length > 0) ||
             (this.status === 'active' && this.completionPercentage < 50 && this.isOverrun);
    },
    
    // Get efficiency score (0-100)
    efficiencyScore() {
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
    },
    
    // Check if date is in the past
    isPast() {
      return new Date(this.scheduleDate) < new Date().setHours(0, 0, 0, 0);
    },
    
    // Check if date is today
    isToday() {
      const today = new Date().toISOString().split('T')[0];
      return this.scheduleDate === today;
    },
    
    // Check if date is in the future
    isFuture() {
      return new Date(this.scheduleDate) > new Date().setHours(23, 59, 59, 999);
    }
  },
});

  return ProductionSchedule;
};