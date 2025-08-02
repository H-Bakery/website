/**
 * ProductionBatch Model
 * Represents a planned production batch for a specific product/workflow
 */
module.exports = (sequelize, DataTypes) => {
  const ProductionBatch = sequelize.define('ProductionBatch', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  
  // Basic Information
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
  
  // Scheduling
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
  
  // Production Details
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
  
  // Status Tracking
  status: {
    type: DataTypes.ENUM,
    values: ['planned', 'ready', 'in_progress', 'waiting', 'completed', 'failed', 'cancelled'],
    defaultValue: 'planned',
    allowNull: false,
  },
  
  currentStepIndex: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Current step in the workflow (0-based index)',
  },
  
  // Priority and Planning
  priority: {
    type: DataTypes.ENUM,
    values: ['low', 'medium', 'high', 'urgent'],
    defaultValue: 'medium',
    allowNull: false,
  },
  
  // Staff Assignment
  assignedStaffIds: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of staff member IDs assigned to this batch',
  },
  
  // Equipment and Resources
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
  
  // Notes and Comments
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
  
  // Metadata
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Additional metadata (temperatures, conditions, etc.)',
  },
  
  // Audit fields
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
}, {
  tableName: 'production_batches',
  timestamps: true,
  paranoid: true, // Soft deletes
  
  // indexes: [
  //   {
  //     fields: ['plannedStartTime'],
  //     name: 'idx_planned_start_time'
  //   },
  //   {
  //     fields: ['status'],
  //     name: 'idx_status'
  //   },
  //   {
  //     fields: ['workflowId'],
  //     name: 'idx_workflow_id'
  //   },
  //   {
  //     fields: ['productId'],
  //     name: 'idx_product_id'
  //   },
  //   {
  //     fields: ['plannedStartTime', 'status'],
  //     name: 'idx_schedule_status'
  //   },
  //   {
  //     fields: ['createdAt'],
  //     name: 'idx_created_at'
  //   }
  // ],
  
  // Virtual fields
  getterMethods: {
    // Calculate duration
    plannedDuration() {
      if (this.plannedStartTime && this.plannedEndTime) {
        return Math.round((new Date(this.plannedEndTime) - new Date(this.plannedStartTime)) / (1000 * 60)); // minutes
      }
      return null;
    },
    
    actualDuration() {
      if (this.actualStartTime && this.actualEndTime) {
        return Math.round((new Date(this.actualEndTime) - new Date(this.actualStartTime)) / (1000 * 60)); // minutes
      }
      return null;
    },
    
    // Progress calculation
    progress() {
      if (this.status === 'completed') return 100;
      if (this.status === 'failed' || this.status === 'cancelled') return 0;
      if (this.status === 'planned' || this.status === 'ready') return 0;
      
      // For in_progress, calculate based on current step
      // This would need to be enhanced with actual workflow step data
      return Math.min(Math.round((this.currentStepIndex / 10) * 100), 90); // Rough estimate
    },
    
    // Status helpers
    isActive() {
      return ['ready', 'in_progress', 'waiting'].includes(this.status);
    },
    
    isCompleted() {
      return ['completed', 'failed', 'cancelled'].includes(this.status);
    },
    
    // Delay calculation
    isDelayed() {
      if (this.status === 'completed' || this.status === 'failed' || this.status === 'cancelled') {
        return false;
      }
      const now = new Date();
      return now > new Date(this.plannedEndTime);
    },
    
    delayMinutes() {
      if (!this.isDelayed) return 0;
      const now = new Date();
      return Math.round((now - new Date(this.plannedEndTime)) / (1000 * 60));
    }
  },
});

  return ProductionBatch;
};