/**
 * ProductionStep Model
 * Represents individual steps within a production batch
 * Tracks real-time progress through workflow steps
 */
module.exports = (sequelize, DataTypes) => {
  const ProductionStep = sequelize.define('ProductionStep', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  
  // Relationships
  batchId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Reference to ProductionBatch',
  },
  
  // Step Information from Workflow
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
  
  // Timing
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
  
  // Duration (from workflow or actual)
  plannedDurationMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Expected duration in minutes',
  },
  
  // Status
  status: {
    type: DataTypes.ENUM,
    values: ['pending', 'ready', 'in_progress', 'waiting', 'completed', 'skipped', 'failed'],
    defaultValue: 'pending',
    allowNull: false,
  },
  
  // Progress within step (0-100)
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
  
  // Activities and Tasks
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
  
  // Conditions and Parameters
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
  
  // Staff and Resources
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
  
  // Quality Control
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
  
  // Alerts and Issues
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
  
  // Notes
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
  
  // Repeat handling (for steps that repeat)
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
  
  // Metadata
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Additional step metadata',
  },
  
  // Audit
  completedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'User ID who marked this step complete',
  },
  
}, {
  tableName: 'production_steps',
  timestamps: true,
  paranoid: true,
  
  // indexes: [
  //   {
  //     fields: ['batchId'],
  //     name: 'idx_batch_id'
  //   },
  //   {
  //     fields: ['batchId', 'stepIndex'],
  //     name: 'idx_batch_step_order',
  //     unique: true
  //   },
  //   {
  //     fields: ['status'],
  //     name: 'idx_step_status'
  //   },
  //   {
  //     fields: ['plannedStartTime'],
  //     name: 'idx_planned_start'
  //   },
  //   {
  //     fields: ['actualStartTime'],
  //     name: 'idx_actual_start'
  //   },
  //   {
  //     fields: ['qualityCheckRequired'],
  //     name: 'idx_quality_check'
  //   },
  //   {
  //     fields: ['hasIssues'],
  //     name: 'idx_has_issues'
  //   }
  // ],
  
  getterMethods: {
    // Calculate actual duration
    actualDurationMinutes() {
      if (this.actualStartTime && this.actualEndTime) {
        return Math.round((new Date(this.actualEndTime) - new Date(this.actualStartTime)) / (1000 * 60));
      }
      return null;
    },
    
    // Check if step is overdue
    isOverdue() {
      if (this.status === 'completed' || this.status === 'skipped' || this.status === 'failed') {
        return false;
      }
      if (!this.plannedEndTime) return false;
      return new Date() > new Date(this.plannedEndTime);
    },
    
    // Calculate delay
    delayMinutes() {
      if (!this.isOverdue) return 0;
      return Math.round((new Date() - new Date(this.plannedEndTime)) / (1000 * 60));
    },
    
    // Activity completion percentage
    activityProgress() {
      if (!this.activities || this.activities.length === 0) return 100;
      return Math.round((this.completedActivities.length / this.activities.length) * 100);
    },
    
    // Check if step needs attention
    needsAttention() {
      return this.hasIssues || this.isOverdue || 
             (this.qualityCheckRequired && !this.qualityCheckCompleted && this.status === 'completed');
    },
    
    // Get next activity to complete
    nextActivity() {
      if (!this.activities || this.activities.length === 0) return null;
      return this.activities.find(activity => !this.completedActivities.includes(activity));
    },
    
    // Check if ready to start
    isReadyToStart() {
      return this.status === 'ready' || (this.status === 'pending' && this.plannedStartTime <= new Date());
    },
    
    // Check if step can be completed
    canComplete() {
      if (this.status !== 'in_progress') return false;
      if (this.activities && this.activities.length > 0) {
        return this.completedActivities.length === this.activities.length;
      }
      return true;
    }
  },
});

  return ProductionStep;
};