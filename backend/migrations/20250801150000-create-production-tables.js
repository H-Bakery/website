'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ProductionSchedules table
    await queryInterface.createTable('production_schedules', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      scheduleDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Date for this production schedule'
      },
      scheduleType: {
        type: Sequelize.ENUM('daily', 'weekly', 'special'),
        defaultValue: 'daily',
        allowNull: false
      },
      workdayStartTime: {
        type: Sequelize.TIME,
        allowNull: false,
        defaultValue: '06:00:00',
        comment: 'Start of production day'
      },
      workdayEndTime: {
        type: Sequelize.TIME,
        allowNull: false,
        defaultValue: '18:00:00',
        comment: 'End of production day'
      },
      availableStaffIds: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Staff members available for this schedule'
      },
      staffShifts: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Staff shift assignments'
      },
      totalStaffHours: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Total available staff hours for the day'
      },
      availableEquipment: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Available equipment/stations for the day'
      },
      equipmentSchedule: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Equipment booking schedule'
      },
      plannedBatches: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'List of planned batch IDs for this schedule'
      },
      totalPlannedItems: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Total number of items planned for production'
      },
      estimatedProductionTime: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Estimated total production time in minutes'
      },
      status: {
        type: Sequelize.ENUM('draft', 'planned', 'active', 'completed', 'cancelled'),
        defaultValue: 'draft',
        allowNull: false
      },
      actualStartTime: {
        type: Sequelize.TIME,
        allowNull: true,
        comment: 'When production actually started'
      },
      actualEndTime: {
        type: Sequelize.TIME,
        allowNull: true,
        comment: 'When production actually ended'
      },
      completedBatches: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'List of completed batch IDs'
      },
      dailyTargets: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Daily production targets by product category'
      },
      actualProduction: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Actual production numbers by category'
      },
      qualityIssues: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Quality issues encountered during the day'
      },
      efficiencyMetrics: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Efficiency metrics'
      },
      environmentalConditions: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Temperature, humidity, etc. that affect production'
      },
      specialRequests: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Special orders or requirements for this date'
      },
      holidays: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Holidays or special events affecting production'
      },
      planningNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notes from production planning'
      },
      dailyNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notes from actual production day'
      },
      alerts: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Active alerts for this schedule'
      },
      notificationsSent: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Log of notifications sent'
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Additional schedule metadata'
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'User who created this schedule'
      },
      approvedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'User who approved this schedule'
      },
      approvedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this schedule was approved'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deletedAt: {
        type: Sequelize.DATE
      }
    });

    // Create ProductionBatches table
    await queryInterface.createTable('production_batches', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Human-readable name for the batch'
      },
      workflowId: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Reference to the YAML workflow definition'
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Optional reference to specific product'
      },
      plannedStartTime: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When this batch should start'
      },
      plannedEndTime: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Expected completion time'
      },
      actualStartTime: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When production actually started'
      },
      actualEndTime: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When production actually finished'
      },
      plannedQuantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Number of units planned to produce'
      },
      actualQuantity: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Actual number of units produced'
      },
      unit: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pieces',
        comment: 'Unit of measurement'
      },
      status: {
        type: Sequelize.ENUM('planned', 'ready', 'in_progress', 'waiting', 'completed', 'failed', 'cancelled'),
        defaultValue: 'planned',
        allowNull: false
      },
      currentStepIndex: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Current step in the workflow'
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium',
        allowNull: false
      },
      assignedStaffIds: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Array of staff member IDs assigned to this batch'
      },
      requiredEquipment: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'List of required equipment/stations'
      },
      allocatedEquipment: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Actually allocated equipment/stations'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'General notes about this batch'
      },
      qualityNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Quality control notes and observations'
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Additional metadata'
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'User ID who created this batch'
      },
      updatedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'User ID who last updated this batch'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deletedAt: {
        type: Sequelize.DATE
      }
    });

    // Create ProductionSteps table
    await queryInterface.createTable('production_steps', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      batchId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Reference to ProductionBatch'
      },
      stepIndex: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Order of this step in the workflow'
      },
      stepName: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Name of the step from workflow definition'
      },
      stepType: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'active',
        comment: 'Type: active, sleep, quality_check, etc.'
      },
      plannedStartTime: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this step should start'
      },
      plannedEndTime: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this step should finish'
      },
      actualStartTime: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this step actually started'
      },
      actualEndTime: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this step actually finished'
      },
      plannedDurationMinutes: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Expected duration in minutes'
      },
      status: {
        type: Sequelize.ENUM('pending', 'ready', 'in_progress', 'waiting', 'completed', 'skipped', 'failed'),
        defaultValue: 'pending',
        allowNull: false
      },
      progress: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Progress percentage within this step'
      },
      activities: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'List of activities from workflow definition'
      },
      completedActivities: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'List of completed activities'
      },
      conditions: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Conditions from workflow'
      },
      parameters: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Step parameters'
      },
      actualParameters: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Actual recorded parameters'
      },
      assignedStaffIds: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Staff assigned to this specific step'
      },
      requiredEquipment: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Equipment needed for this step'
      },
      location: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Where this step takes place'
      },
      qualityCheckRequired: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this step requires quality inspection'
      },
      qualityCheckCompleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether quality check was completed'
      },
      qualityResults: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Quality check results and measurements'
      },
      hasIssues: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this step has reported issues'
      },
      issues: {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'List of issues encountered during this step'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Step-specific notes and observations'
      },
      workflowNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notes from the workflow definition'
      },
      repeatCount: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        comment: 'How many times this step should repeat'
      },
      currentRepeat: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        comment: 'Current repetition number'
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Additional step metadata'
      },
      completedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'User ID who marked this step complete'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deletedAt: {
        type: Sequelize.DATE
      }
    });

    // Add indexes for ProductionSchedules
    await queryInterface.addIndex('production_schedules', ['scheduleDate'], {
      name: 'idx_schedule_date',
      unique: true
    });
    await queryInterface.addIndex('production_schedules', ['status'], {
      name: 'idx_schedule_status'
    });
    await queryInterface.addIndex('production_schedules', ['scheduleType'], {
      name: 'idx_schedule_type'
    });
    await queryInterface.addIndex('production_schedules', ['scheduleDate', 'status'], {
      name: 'idx_date_status'
    });
    await queryInterface.addIndex('production_schedules', ['createdBy'], {
      name: 'idx_created_by'
    });
    await queryInterface.addIndex('production_schedules', ['approvedBy'], {
      name: 'idx_approved_by'
    });

    // Add indexes for ProductionBatches
    await queryInterface.addIndex('production_batches', ['plannedStartTime'], {
      name: 'idx_planned_start_time'
    });
    await queryInterface.addIndex('production_batches', ['status'], {
      name: 'idx_status'
    });
    await queryInterface.addIndex('production_batches', ['workflowId'], {
      name: 'idx_workflow_id'
    });
    await queryInterface.addIndex('production_batches', ['productId'], {
      name: 'idx_product_id'
    });
    await queryInterface.addIndex('production_batches', ['plannedStartTime', 'status'], {
      name: 'idx_schedule_status'
    });
    await queryInterface.addIndex('production_batches', ['createdAt'], {
      name: 'idx_created_at'
    });

    // Add indexes for ProductionSteps
    await queryInterface.addIndex('production_steps', ['batchId'], {
      name: 'idx_batch_id'
    });
    await queryInterface.addIndex('production_steps', ['batchId', 'stepIndex'], {
      name: 'idx_batch_step_order',
      unique: true
    });
    await queryInterface.addIndex('production_steps', ['status'], {
      name: 'idx_step_status'
    });
    await queryInterface.addIndex('production_steps', ['plannedStartTime'], {
      name: 'idx_planned_start'
    });
    await queryInterface.addIndex('production_steps', ['actualStartTime'], {
      name: 'idx_actual_start'
    });
    await queryInterface.addIndex('production_steps', ['qualityCheckRequired'], {
      name: 'idx_quality_check'
    });
    await queryInterface.addIndex('production_steps', ['hasIssues'], {
      name: 'idx_has_issues'
    });

    // Add foreign key constraints
    await queryInterface.addConstraint('production_batches', {
      fields: ['productId'],
      type: 'foreign key',
      name: 'fk_production_batch_product',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('production_batches', {
      fields: ['createdBy'],
      type: 'foreign key',
      name: 'fk_production_batch_creator',
      references: {
        table: 'Users',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('production_batches', {
      fields: ['updatedBy'],
      type: 'foreign key',
      name: 'fk_production_batch_updater',
      references: {
        table: 'Users',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('production_steps', {
      fields: ['batchId'],
      type: 'foreign key',
      name: 'fk_production_step_batch',
      references: {
        table: 'production_batches',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('production_steps', {
      fields: ['completedBy'],
      type: 'foreign key',
      name: 'fk_production_step_completer',
      references: {
        table: 'Users',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('production_schedules', {
      fields: ['createdBy'],
      type: 'foreign key',
      name: 'fk_production_schedule_creator',
      references: {
        table: 'Users',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('production_schedules', {
      fields: ['approvedBy'],
      type: 'foreign key',
      name: 'fk_production_schedule_approver',
      references: {
        table: 'Users',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop foreign key constraints first
    await queryInterface.removeConstraint('production_steps', 'fk_production_step_batch');
    await queryInterface.removeConstraint('production_steps', 'fk_production_step_completer');
    await queryInterface.removeConstraint('production_batches', 'fk_production_batch_product');
    await queryInterface.removeConstraint('production_batches', 'fk_production_batch_creator');
    await queryInterface.removeConstraint('production_batches', 'fk_production_batch_updater');
    await queryInterface.removeConstraint('production_schedules', 'fk_production_schedule_creator');
    await queryInterface.removeConstraint('production_schedules', 'fk_production_schedule_approver');
    
    // Drop tables
    await queryInterface.dropTable('production_steps');
    await queryInterface.dropTable('production_batches');
    await queryInterface.dropTable('production_schedules');
  }
};