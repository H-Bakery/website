// Production WebSocket Hook
// Provides WebSocket integration for production components

import { useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from 'react-query'
import productionSocketService from '../services/productionSocketService'
import {
  ProductionBatch,
  ProductionStep,
  ProductionSchedule,
  ProductionStatus,
} from '../types/production'

interface UseProductionSocketOptions {
  // Subscribe to specific schedule date
  scheduleDate?: string
  // Subscribe to specific batch
  batchId?: number
  // Subscribe to production status
  subscribeToStatus?: boolean
  // Auto-connect on mount
  autoConnect?: boolean
}

interface ProductionSocketCallbacks {
  onBatchUpdate?: (data: { batchId: number } & Partial<ProductionBatch>) => void
  onStepUpdate?: (
    data: { batchId: number; stepId: number } & Partial<ProductionStep>
  ) => void
  onScheduleUpdate?: (
    data: { date: string } & Partial<ProductionSchedule>
  ) => void
  onStatusUpdate?: (data: Partial<ProductionStatus>) => void
  onIssueReported?: (data: { batchId: number; issue: any }) => void
  onQualityCheck?: (data: {
    batchId: number
    stepId: number
    qualityData: any
  }) => void
}

export function useProductionSocket(
  options: UseProductionSocketOptions = {},
  callbacks: ProductionSocketCallbacks = {}
) {
  const queryClient = useQueryClient()
  const {
    scheduleDate,
    batchId,
    subscribeToStatus = false,
    autoConnect = true,
  } = options

  // Keep track of current subscriptions
  const subscriptionsRef = useRef({
    scheduleDate: null as string | null,
    batchId: null as number | null,
    status: false,
  })

  // Default handlers that update React Query cache
  const handleBatchUpdate = useCallback(
    (data: { batchId: number } & Partial<ProductionBatch>) => {
      // Update batch in cache
      queryClient.setQueryData(
        ['production', 'batch', data.batchId],
        (old: any) => {
          if (!old) return old
          return { ...old, ...data }
        }
      )

      // Update batch in lists
      queryClient.setQueriesData(['production', 'batches'], (old: any) => {
        if (!old?.data?.batches) return old
        return {
          ...old,
          data: {
            ...old.data,
            batches: old.data.batches.map((batch: ProductionBatch) =>
              batch.id === data.batchId ? { ...batch, ...data } : batch
            ),
          },
        }
      })

      // Call custom callback if provided
      callbacks.onBatchUpdate?.(data)
    },
    [queryClient, callbacks]
  )

  const handleStepUpdate = useCallback(
    (data: { batchId: number; stepId: number } & Partial<ProductionStep>) => {
      // Update step in batch steps cache
      queryClient.setQueryData(
        ['production', 'batch', data.batchId, 'steps'],
        (old: any) => {
          if (!Array.isArray(old)) return old
          return old.map((step: ProductionStep) =>
            step.id === data.stepId ? { ...step, ...data } : step
          )
        }
      )

      // Update step in batch cache
      queryClient.setQueryData(
        ['production', 'batch', data.batchId],
        (old: any) => {
          if (!old?.steps) return old
          return {
            ...old,
            steps: old.steps.map((step: ProductionStep) =>
              step.id === data.stepId ? { ...step, ...data } : step
            ),
          }
        }
      )

      // Call custom callback if provided
      callbacks.onStepUpdate?.(data)
    },
    [queryClient, callbacks]
  )

  const handleScheduleUpdate = useCallback(
    (data: { date: string } & Partial<ProductionSchedule>) => {
      // Update schedule in cache
      queryClient.setQueriesData(['production', 'schedules'], (old: any) => {
        if (!old?.data?.schedules) return old
        return {
          ...old,
          data: {
            ...old.data,
            schedules: old.data.schedules.map((schedule: ProductionSchedule) =>
              schedule.scheduleDate === data.date
                ? { ...schedule, ...data }
                : schedule
            ),
          },
        }
      })

      // Call custom callback if provided
      callbacks.onScheduleUpdate?.(data)
    },
    [queryClient, callbacks]
  )

  const handleStatusUpdate = useCallback(
    (data: Partial<ProductionStatus>) => {
      // Update status cache
      queryClient.setQueryData(['production', 'status'], (old: any) => {
        if (!old) return old
        return { ...old, ...data }
      })

      // Call custom callback if provided
      callbacks.onStatusUpdate?.(data)
    },
    [queryClient, callbacks]
  )

  const handleIssueReported = useCallback(
    (data: { batchId: number; issue: any }) => {
      // Invalidate batch query to refetch with new issue
      queryClient.invalidateQueries(['production', 'batch', data.batchId])

      // Call custom callback if provided
      callbacks.onIssueReported?.(data)
    },
    [queryClient, callbacks]
  )

  const handleQualityCheck = useCallback(
    (data: { batchId: number; stepId: number; qualityData: any }) => {
      // Invalidate step queries to refetch with quality data
      queryClient.invalidateQueries([
        'production',
        'batch',
        data.batchId,
        'steps',
      ])
      queryClient.invalidateQueries(['production', 'batch', data.batchId])

      // Call custom callback if provided
      callbacks.onQualityCheck?.(data)
    },
    [queryClient, callbacks]
  )

  // Connect to WebSocket
  useEffect(() => {
    if (!autoConnect) return

    const token = localStorage.getItem('token')
    if (!token) return

    productionSocketService.connect(token)
  }, [autoConnect])

  // Setup event handlers
  useEffect(() => {
    productionSocketService.on('production:batch:update', handleBatchUpdate)
    productionSocketService.on('production:step:update', handleStepUpdate)
    productionSocketService.on(
      'production:schedule:update',
      handleScheduleUpdate
    )
    productionSocketService.on('production:status:update', handleStatusUpdate)
    productionSocketService.on('production:issue:reported', handleIssueReported)
    productionSocketService.on('production:quality:check', handleQualityCheck)

    return () => {
      productionSocketService.off('production:batch:update', handleBatchUpdate)
      productionSocketService.off('production:step:update', handleStepUpdate)
      productionSocketService.off(
        'production:schedule:update',
        handleScheduleUpdate
      )
      productionSocketService.off(
        'production:status:update',
        handleStatusUpdate
      )
      productionSocketService.off(
        'production:issue:reported',
        handleIssueReported
      )
      productionSocketService.off(
        'production:quality:check',
        handleQualityCheck
      )
    }
  }, [
    handleBatchUpdate,
    handleStepUpdate,
    handleScheduleUpdate,
    handleStatusUpdate,
    handleIssueReported,
    handleQualityCheck,
  ])

  // Manage subscriptions
  useEffect(() => {
    // Schedule subscription
    if (
      scheduleDate &&
      scheduleDate !== subscriptionsRef.current.scheduleDate
    ) {
      if (subscriptionsRef.current.scheduleDate) {
        productionSocketService.unsubscribeFromSchedule(
          subscriptionsRef.current.scheduleDate
        )
      }
      productionSocketService.subscribeToSchedule(scheduleDate)
      subscriptionsRef.current.scheduleDate = scheduleDate
    }

    // Batch subscription
    if (batchId && batchId !== subscriptionsRef.current.batchId) {
      if (subscriptionsRef.current.batchId) {
        productionSocketService.unsubscribeFromBatch(
          subscriptionsRef.current.batchId
        )
      }
      productionSocketService.subscribeToBatch(batchId)
      subscriptionsRef.current.batchId = batchId
    }

    // Status subscription
    if (subscribeToStatus && !subscriptionsRef.current.status) {
      productionSocketService.subscribeToStatus()
      subscriptionsRef.current.status = true
    } else if (!subscribeToStatus && subscriptionsRef.current.status) {
      productionSocketService.unsubscribeFromStatus()
      subscriptionsRef.current.status = false
    }

    // Cleanup function
    return () => {
      if (subscriptionsRef.current.scheduleDate) {
        productionSocketService.unsubscribeFromSchedule(
          subscriptionsRef.current.scheduleDate
        )
      }
      if (subscriptionsRef.current.batchId) {
        productionSocketService.unsubscribeFromBatch(
          subscriptionsRef.current.batchId
        )
      }
      if (subscriptionsRef.current.status) {
        productionSocketService.unsubscribeFromStatus()
      }
    }
  }, [scheduleDate, batchId, subscribeToStatus])

  return {
    isConnected: productionSocketService.isConnected(),
    subscribeToSchedule: productionSocketService.subscribeToSchedule.bind(
      productionSocketService
    ),
    unsubscribeFromSchedule:
      productionSocketService.unsubscribeFromSchedule.bind(
        productionSocketService
      ),
    subscribeToBatch: productionSocketService.subscribeToBatch.bind(
      productionSocketService
    ),
    unsubscribeFromBatch: productionSocketService.unsubscribeFromBatch.bind(
      productionSocketService
    ),
    subscribeToStatus: productionSocketService.subscribeToStatus.bind(
      productionSocketService
    ),
    unsubscribeFromStatus: productionSocketService.unsubscribeFromStatus.bind(
      productionSocketService
    ),
  }
}
