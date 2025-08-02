// Production Planning TypeScript Definitions
// Aligns with backend service layer models and APIs

export interface ProductionSchedule {
  id: number
  scheduleDate: string
  scheduleType: 'daily' | 'weekly' | 'special'
  status: 'draft' | 'planned' | 'active' | 'completed' | 'cancelled'
  staffShifts: Record<string, StaffShift>
  availableEquipment: EquipmentItem[]
  plannedBatches: PlannedBatchSummary[]
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
  createdAt: string
  updatedAt: string
  approvedBy?: number
  approvedAt?: string
}

export interface ProductionBatch {
  id: number
  name: string
  workflowId: string
  productId: number
  status: 'planned' | 'ready' | 'in_progress' | 'waiting' | 'completed' | 'failed' | 'cancelled'
  plannedQuantity: number
  actualQuantity?: number
  unit: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  plannedStartTime: string
  plannedEndTime: string
  actualStartTime?: string
  actualEndTime?: string
  estimatedDurationMinutes: number
  actualDurationMinutes?: number
  currentStepIndex: number
  assignedStaffIds: number[]
  requiredEquipment: string[]
  qualityResults?: QualityResult[]
  issues?: ProductionIssue[]
  metadata?: Record<string, any>
  notes?: string
  createdBy: number
  createdAt: string
  updatedAt: string
  updatedBy?: number
  // Enhanced properties for UI
  progress?: number
  currentStep?: ProductionStep
  isDelayed?: boolean
  delayMinutes?: number
}

export interface ProductionStep {
  id: number
  batchId: number
  stepIndex: number
  stepName: string
  stepType: 'active' | 'sleep' | 'manual' | 'quality_check'
  status: 'pending' | 'ready' | 'in_progress' | 'waiting' | 'completed' | 'skipped' | 'failed'
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
  plannedStartTime?: string
  plannedEndTime?: string
  actualStartTime?: string
  actualEndTime?: string
  completedActivities?: string[]
  progress: number
  qualityCheckCompleted: boolean
  qualityResults?: Record<string, QualityResult>
  hasIssues: boolean
  issues?: ProductionIssue[]
  metadata?: Record<string, any>
  completedBy?: number
  statusChangeTime?: string
  // Enhanced properties for UI
  isOverdue?: boolean
  activityProgress?: number
}

export interface StaffShift {
  start: string
  end: string
  role?: string
  skills?: string[]
  hours?: number
}

export interface EquipmentItem {
  id: string
  name: string
  type: string
  capacity?: number
  availableHours?: number
}

export interface PlannedBatchSummary {
  id: string
  name: string
  workflowId: string
  productId: number
  quantity: number
  startTime: string
  endTime: string
  priority: string
}

export interface QualityResult {
  checkId: string
  performedBy: number
  performedAt: string
  checks: QualityCheck[]
  overallScore: number
  passed: boolean
  notes?: string
  status: 'completed' | 'failed' | 'pending'
}

export interface QualityCheck {
  name: string
  score: number
  passed: boolean
  notes?: string
}

export interface ProductionIssue {
  id: string
  type: 'quality' | 'equipment' | 'timing' | 'resource' | 'other'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  reportedBy: number
  reportedAt: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  impact?: 'low' | 'medium' | 'high' | 'unknown'
  resolution?: string
  resolvedBy?: number
  resolvedAt?: string
}

// Analytics and Metrics Types
export interface ProductionMetrics {
  overview: ProductionOverview
  efficiency: EfficiencyMetrics
  quality: QualityMetrics
  timing: TimingMetrics
  throughput: ThroughputMetrics
  trends: TrendMetrics
  workflowAnalysis: WorkflowMetrics
  stepAnalysis?: StepMetrics
  recommendations: PerformanceRecommendation[]
  period: {
    start: string
    end: string
    days: number
  }
  generatedAt: string
}

export interface ProductionOverview {
  totalBatches: number
  completedBatches: number
  failedBatches: number
  cancelledBatches: number
  inProgressBatches: number
  completionRate: number
  failureRate: number
  totalPlannedQuantity: number
  totalProducedQuantity: number
  productionEfficiency: number
}

export interface EfficiencyMetrics {
  overall: number
  production: number
  time: number
  quality: number
  sampleSize: number
}

export interface QualityMetrics {
  overallQualityScore: number
  qualityCheckCompletionRate: number
  issueRate: number
  totalQualityChecks: number
  totalIssues: number
  batchesWithIssues: number
}

export interface TimingMetrics {
  onTimePercentage: number
  delayedPercentage: number
  earlyPercentage: number
  averageDelayMinutes: number
  currentlyDelayed: number
  onTimeBatches: number
  delayedBatches: number
  earlyBatches: number
}

export interface ThroughputMetrics {
  byPeriod: ThroughputPeriod[]
  summary: {
    totalPeriods: number
    averageBatchesPerPeriod: number
    averageQuantityPerPeriod: number
    peakBatches: number
    peakQuantity: number
  }
}

export interface ThroughputPeriod {
  period: string
  batches: number
  plannedQuantity: number
  actualQuantity: number
  completed: number
  failed: number
}

export interface TrendMetrics {
  efficiency: TrendData
  throughput: TrendData
  quality: TrendData
}

export interface TrendData {
  trend: 'improving' | 'declining' | 'stable'
  change: number
  firstPeriodAvg?: number
  secondPeriodAvg?: number
}

export interface WorkflowMetrics {
  byWorkflow: WorkflowPerformance[]
  summary: {
    totalWorkflows: number
    mostUsedWorkflow?: string
    highestEfficiencyWorkflow?: string
  }
}

export interface WorkflowPerformance {
  workflowId: string
  totalBatches: number
  completionRate: number
  failureRate: number
  productionEfficiency: number
  averageDurationMinutes: number
  totalQuantityProduced: number
}

export interface StepMetrics {
  byStep: StepPerformance[]
  summary: {
    totalSteps: number
    averageStepDuration: number
    mostProblematicStep?: string
  }
}

export interface StepPerformance {
  stepName: string
  totalExecutions: number
  averageDuration: number
  failureRate: number
  qualityScore: number
}

export interface PerformanceRecommendation {
  type: 'efficiency' | 'timing' | 'quality' | 'utilization' | 'capacity' | 'complexity'
  priority: 'low' | 'medium' | 'high'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  effort: 'low' | 'medium' | 'high'
}

// Capacity Planning Types
export interface CapacityAnalysis {
  staffCapacity: StaffCapacity
  equipmentCapacity: EquipmentCapacity
  workdayMinutes: number
  totalStaffHours: number
  availableStations: number
  bottlenecks: CapacityBottleneck[]
  maxConcurrentBatches: number
}

export interface StaffCapacity {
  workers: WorkerCapacity[]
  availableWorkers: number
  totalHours: number
  averageHours: number
}

export interface WorkerCapacity {
  id: number
  startTime: string
  endTime: string
  hours: number
  role: string
  skills: string[]
}

export interface EquipmentCapacity {
  stations: EquipmentStation[]
  totalStations: number
  totalCapacity: number
  totalAvailableHours: number
}

export interface EquipmentStation {
  id: string
  name: string
  type: string
  capacity: number
  availableHours: number
}

export interface CapacityBottleneck {
  type: 'staff' | 'equipment'
  severity: 'low' | 'medium' | 'high'
  message: string
}

// Real-time Monitoring Types
export interface ProductionStatus {
  overview: ProductionStatusOverview
  activeBatches: ProductionBatch[]
  pendingBatches: ProductionBatch[]
  waitingBatches: ProductionBatch[]
  completedBatches?: ProductionBatch[]
  alerts: ProductionAlert[]
  timeline: TimelineEvent[]
  lastUpdated: string
}

export interface ProductionStatusOverview {
  totalBatches: number
  activeBatches: number
  pendingBatches: number
  completedBatches: number
  delayedBatches: number
  totalItems: number
  completedItems: number
  efficiency: number
  alerts: string[]
}

export interface ProductionAlert {
  type: 'delay' | 'quality' | 'issue' | 'equipment' | 'resource'
  severity: 'low' | 'medium' | 'high' | 'critical'
  batchId?: number
  stepId?: number
  batchName?: string
  stepName?: string
  message: string
  timestamp: string
}

export interface TimelineEvent {
  type: 'batch_started' | 'batch_completed' | 'step_completed' | 'issue_reported' | 'quality_check'
  batchId: number
  stepId?: number
  batchName: string
  stepName?: string
  timestamp: string
  details?: Record<string, any>
}

// UI Component Types
export interface ProductionFilters {
  dateRange?: {
    start: string
    end: string
  }
  status?: string[]
  workflowId?: string[]
  priority?: string[]
  assignedStaff?: number[]
}

export interface ScheduleViewMode {
  type: 'calendar' | 'timeline' | 'kanban'
  period: 'day' | 'week' | 'month'
}

export interface DragDropBatch {
  id: number
  name: string
  duration: number
  workflowId: string
  priority: string
  requiredEquipment: string[]
  assignedStaff: number[]
}

// WebSocket Event Types
export interface ProductionWebSocketEvent {
  type: 'batch_status_update' | 'step_progress_updated' | 'production_issue_reported' | 
        'quality_check_completed' | 'workflow_advanced' | 'batch_paused' | 'batch_resumed'
  batchId?: number
  stepId?: number
  data: any
  timestamp: string
}

// API Response Types
export interface ProductionApiResponse<T> {
  success: boolean
  data: T
  message?: string
  errors?: string[]
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}