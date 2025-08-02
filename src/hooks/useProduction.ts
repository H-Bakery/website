// Production Data Hooks
// React Query hooks for production data management with caching and real-time updates

import { useQuery, useMutation, useQueryClient } from 'react-query'
import { productionAPI } from '../services/productionAPI'
import {
  ProductionSchedule,
  ProductionBatch,
  ProductionStep,
  ProductionMetrics,
  ProductionStatus,
  CapacityAnalysis,
  ProductionFilters,
} from '../types/production'
import { useAuth } from '../context/AuthContext'

// Query Keys
export const productionQueryKeys = {
  all: ['production'] as const,
  schedules: () => [...productionQueryKeys.all, 'schedules'] as const,
  schedule: (id: number) => [...productionQueryKeys.schedules(), id] as const,
  batches: () => [...productionQueryKeys.all, 'batches'] as const,
  batch: (id: number) => [...productionQueryKeys.batches(), id] as const,
  batchSteps: (batchId: number) => [...productionQueryKeys.batch(batchId), 'steps'] as const,
  analytics: () => [...productionQueryKeys.all, 'analytics'] as const,
  status: () => [...productionQueryKeys.all, 'status'] as const,
  workflows: () => [...productionQueryKeys.all, 'workflows'] as const,
  capacity: () => [...productionQueryKeys.all, 'capacity'] as const,
}

// ============================================================================
// PRODUCTION SCHEDULES
// ============================================================================

/**
 * Get production schedules with filtering and pagination
 */
export function useProductionSchedules(filters: {
  startDate?: string
  endDate?: string
  status?: string
  type?: string
  limit?: number
  offset?: number
  includeMetrics?: boolean
} = {}) {
  const { token } = useAuth()

  return useQuery(
    [...productionQueryKeys.schedules(), filters],
    () => productionAPI.getSchedules(filters),
    {
      enabled: !!token,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  )
}

/**
 * Get a specific production schedule
 */
export function useProductionSchedule(id: number) {
  const { token } = useAuth()

  return useQuery(
    productionQueryKeys.schedule(id),
    () => productionAPI.getSchedule(id),
    {
      enabled: !!token && !!id,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  )
}

/**
 * Create production schedule mutation
 */
export function useCreateSchedule() {
  const queryClient = useQueryClient()

  return useMutation(
    (scheduleData: Partial<ProductionSchedule>) =>
      productionAPI.createSchedule(scheduleData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(productionQueryKeys.schedules())
      },
    }
  )
}

/**
 * Update production schedule mutation
 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient()

  return useMutation(
    ({ id, data }: { id: number; data: Partial<ProductionSchedule> }) =>
      productionAPI.updateSchedule(id, data),
    {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries(productionQueryKeys.schedule(id))
        queryClient.invalidateQueries(productionQueryKeys.schedules())
      },
    }
  )
}

/**
 * Delete production schedule mutation
 */
export function useDeleteSchedule() {
  const queryClient = useQueryClient()

  return useMutation(
    (id: number) => productionAPI.deleteSchedule(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(productionQueryKeys.schedules())
      },
    }
  )
}

// ============================================================================
// PRODUCTION BATCHES
// ============================================================================

/**
 * Get production batches with filtering
 */
export function useProductionBatches(filters: {
  scheduleId?: number
  status?: string
  workflowId?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
} = {}) {
  const { token } = useAuth()

  return useQuery(
    [...productionQueryKeys.batches(), filters],
    () => productionAPI.getBatches(filters),
    {
      enabled: !!token,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  )
}

/**
 * Get a specific production batch
 */
export function useProductionBatch(id: number) {
  const { token } = useAuth()

  return useQuery(
    productionQueryKeys.batch(id),
    () => productionAPI.getBatch(id),
    {
      enabled: !!token && !!id,
      staleTime: 1 * 60 * 1000, // 1 minute for active batches
    }
  )
}

/**
 * Get production batch steps
 */
export function useBatchSteps(batchId: number) {
  const { token } = useAuth()

  return useQuery(
    productionQueryKeys.batchSteps(batchId),
    () => productionAPI.getBatchSteps(batchId),
    {
      enabled: !!token && !!batchId,
      staleTime: 30 * 1000, // 30 seconds for real-time tracking
    }
  )
}

/**
 * Create production batch mutation
 */
export function useCreateBatch() {
  const queryClient = useQueryClient()

  return useMutation(
    (batchData: Partial<ProductionBatch>) =>
      productionAPI.createBatch(batchData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(productionQueryKeys.batches())
        queryClient.invalidateQueries(productionQueryKeys.status())
      },
    }
  )
}

/**
 * Update production batch mutation
 */
export function useUpdateBatch() {
  const queryClient = useQueryClient()

  return useMutation(
    ({ id, data }: { id: number; data: Partial<ProductionBatch> }) =>
      productionAPI.updateBatch(id, data),
    {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries(productionQueryKeys.batch(id))
        queryClient.invalidateQueries(productionQueryKeys.batches())
        queryClient.invalidateQueries(productionQueryKeys.status())
      },
    }
  )
}

/**
 * Start production batch mutation
 */
export function useStartBatch() {
  const queryClient = useQueryClient()

  return useMutation(
    (id: number) => productionAPI.startBatch(id),
    {
      onSuccess: (_, id) => {
        queryClient.invalidateQueries(productionQueryKeys.batch(id))
        queryClient.invalidateQueries(productionQueryKeys.batches())
        queryClient.invalidateQueries(productionQueryKeys.status())
      },
    }
  )
}

/**
 * Delete production batch mutation
 */
export function useDeleteBatch() {
  const queryClient = useQueryClient()

  return useMutation(
    (id: number) => productionAPI.deleteBatch(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(productionQueryKeys.batches())
        queryClient.invalidateQueries(productionQueryKeys.status())
      },
    }
  )
}

// ============================================================================
// PRODUCTION STEPS
// ============================================================================

/**
 * Update production step mutation
 */
export function useUpdateStep() {
  const queryClient = useQueryClient()

  return useMutation(
    ({ stepId, data }: { stepId: number; data: Partial<ProductionStep> }) =>
      productionAPI.updateStep(stepId, data),
    {
      onSuccess: (updatedStep) => {
        // Update batch steps cache
        queryClient.invalidateQueries(
          productionQueryKeys.batchSteps(updatedStep.batchId)
        )
        // Update batch cache
        queryClient.invalidateQueries(
          productionQueryKeys.batch(updatedStep.batchId)
        )
        // Update status cache
        queryClient.invalidateQueries(productionQueryKeys.status())
      },
    }
  )
}

/**
 * Complete production step mutation
 */
export function useCompleteStep() {
  const queryClient = useQueryClient()

  return useMutation(
    ({ stepId, completionData }: {
      stepId: number
      completionData: {
        actualParameters?: Record<string, any>
        qualityResults?: Record<string, any>
        notes?: string
      }
    }) => productionAPI.completeStep(stepId, completionData),
    {
      onSuccess: (updatedStep) => {
        queryClient.invalidateQueries(
          productionQueryKeys.batchSteps(updatedStep.batchId)
        )
        queryClient.invalidateQueries(
          productionQueryKeys.batch(updatedStep.batchId)
        )
        queryClient.invalidateQueries(productionQueryKeys.status())
      },
    }
  )
}

// ============================================================================
// REAL-TIME MONITORING
// ============================================================================

/**
 * Get real-time production status
 */
export function useProductionStatus(filters: {
  date?: string
  includeCompleted?: boolean
} = {}) {
  const { token } = useAuth()

  return useQuery(
    [...productionQueryKeys.status(), filters],
    () => productionAPI.getProductionStatus(filters),
    {
      enabled: !!token,
      staleTime: 15 * 1000, // 15 seconds for real-time data
      refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
    }
  )
}

/**
 * Start batch monitoring mutation
 */
export function useStartBatchMonitoring() {
  const queryClient = useQueryClient()

  return useMutation(
    (batchId: number) => productionAPI.startBatchMonitoring(batchId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(productionQueryKeys.status())
      },
    }
  )
}

/**
 * Update step progress mutation
 */
export function useUpdateStepProgress() {
  const queryClient = useQueryClient()

  return useMutation(
    ({ stepId, progressData }: {
      stepId: number
      progressData: {
        progress?: number
        status?: string
        hasIssues?: boolean
        qualityCheckCompleted?: boolean
        notes?: string
      }
    }) => productionAPI.updateStepProgress(stepId, progressData),
    {
      onSuccess: (updatedStep) => {
        queryClient.invalidateQueries(
          productionQueryKeys.batchSteps(updatedStep.batchId)
        )
        queryClient.invalidateQueries(productionQueryKeys.status())
      },
    }
  )
}

/**
 * Report production issue mutation
 */
export function useReportIssue() {
  const queryClient = useQueryClient()

  return useMutation(
    ({ batchId, issueData }: {
      batchId: number
      issueData: {
        stepId?: number
        type: string
        severity: string
        description: string
        impact?: string
      }
    }) => productionAPI.reportIssue(batchId, issueData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(productionQueryKeys.status())
        queryClient.invalidateQueries(productionQueryKeys.batches())
      },
    }
  )
}

/**
 * Perform quality check mutation
 */
export function usePerformQualityCheck() {
  const queryClient = useQueryClient()

  return useMutation(
    ({ stepId, qualityData }: {
      stepId: number
      qualityData: {
        checks: Array<{ name: string; score: number; passed: boolean; notes?: string }>
        passingScore?: number
        notes?: string
      }
    }) => productionAPI.performQualityCheck(stepId, qualityData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(productionQueryKeys.status())
      },
    }
  )
}

/**
 * Pause batch mutation
 */
export function usePauseBatch() {
  const queryClient = useQueryClient()

  return useMutation(
    ({ batchId, reason }: { batchId: number; reason: string }) =>
      productionAPI.pauseBatch(batchId, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(productionQueryKeys.status())
        queryClient.invalidateQueries(productionQueryKeys.batches())
      },
    }
  )
}

/**
 * Resume batch mutation
 */
export function useResumeBatch() {
  const queryClient = useQueryClient()

  return useMutation(
    (batchId: number) => productionAPI.resumeBatch(batchId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(productionQueryKeys.status())
        queryClient.invalidateQueries(productionQueryKeys.batches())
      },
    }
  )
}

// ============================================================================
// ANALYTICS & METRICS
// ============================================================================

/**
 * Get production analytics
 */
export function useProductionAnalytics(filters: {
  startDate?: string
  endDate?: string
  workflowId?: string
  includeSteps?: boolean
  groupBy?: 'day' | 'week' | 'month'
} = {}) {
  const { token } = useAuth()

  return useQuery(
    [...productionQueryKeys.analytics(), filters],
    () => productionAPI.getAnalytics(filters),
    {
      enabled: !!token,
      staleTime: 5 * 60 * 1000, // 5 minutes for analytics
    }
  )
}

/**
 * Get efficiency report
 */
export function useEfficiencyReport(filters: {
  startDate?: string
  endDate?: string
  includeBreakdown?: boolean
  includeBenchmarks?: boolean
} = {}) {
  const { token } = useAuth()

  return useQuery(
    [...productionQueryKeys.analytics(), 'efficiency', filters],
    () => productionAPI.getEfficiencyReport(filters),
    {
      enabled: !!token,
      staleTime: 10 * 60 * 1000, // 10 minutes
    }
  )
}

/**
 * Get capacity utilization
 */
export function useCapacityUtilization(filters: {
  startDate?: string
  endDate?: string
  includeSchedules?: boolean
} = {}) {
  const { token } = useAuth()

  return useQuery(
    [...productionQueryKeys.analytics(), 'capacity', filters],
    () => productionAPI.getCapacityUtilization(filters),
    {
      enabled: !!token,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  )
}

// ============================================================================
// CAPACITY PLANNING
// ============================================================================

/**
 * Optimize production schedule mutation
 */
export function useOptimizeSchedule() {
  return useMutation(
    (planningData: {
      scheduleDate: string
      availableStaffIds?: number[]
      staffShifts?: Record<string, any>
      availableEquipment?: any[]
      productionDemand?: Array<{
        productId: number
        workflowId: string
        quantity: number
        priority: string
      }>
      constraints?: Record<string, any>
    }) => productionAPI.optimizeSchedule(planningData)
  )
}

/**
 * Calculate capacity mutation
 */
export function useCalculateCapacity() {
  return useMutation(
    (capacityData: {
      staffShifts: Record<string, any>
      availableEquipment: any[]
      workdayStart?: string
      workdayEnd?: string
    }) => productionAPI.calculateCapacity(capacityData)
  )
}

/**
 * Get capacity analysis for a specific date
 */
export function useCapacityAnalysis(filters: {
  date: string
} = { date: new Date().toISOString().split('T')[0] }) {
  const { token } = useAuth()

  return useQuery(
    [...productionQueryKeys.capacity(), filters.date],
    () => productionAPI.calculateCapacity({
      // Mock data for now - in real implementation would fetch from backend
      staffShifts: {
        '1': { start: '06:00', end: '14:00', role: 'baker' },
        '2': { start: '06:00', end: '14:00', role: 'baker' },
        '3': { start: '08:00', end: '16:00', role: 'assistant' },
        '4': { start: '10:00', end: '18:00', role: 'sales' },
      },
      availableEquipment: [
        { id: 'oven_1', type: 'oven', capacity: 50 },
        { id: 'oven_2', type: 'oven', capacity: 50 },
        { id: 'mixer_large', type: 'mixer', capacity: 100 },
        { id: 'proofer_1', type: 'proofer', capacity: 200 },
      ],
      workdayStart: '06:00',
      workdayEnd: '18:00',
    }),
    {
      enabled: !!token,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  )
}

// ============================================================================
// WORKFLOWS
// ============================================================================

/**
 * Get available workflows
 */
export function useWorkflows() {
  const { token } = useAuth()

  return useQuery(
    productionQueryKeys.workflows(),
    () => productionAPI.getWorkflows(),
    {
      enabled: !!token,
      staleTime: 15 * 60 * 1000, // 15 minutes - workflows don't change often
    }
  )
}

/**
 * Get specific workflow details
 */
export function useWorkflow(workflowId: string) {
  const { token } = useAuth()

  return useQuery(
    [...productionQueryKeys.workflows(), workflowId],
    () => productionAPI.getWorkflow(workflowId),
    {
      enabled: !!token && !!workflowId,
      staleTime: 15 * 60 * 1000, // 15 minutes
    }
  )
}