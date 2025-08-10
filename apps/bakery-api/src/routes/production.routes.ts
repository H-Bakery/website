/**
 * Production Routes - Local integration with production domain
 * Bakery Management System
 */

import { Router, Request, Response, NextFunction } from 'express'
import productionService from '../services/production.service'
import productionPlanningService from '../services/productionPlanning.service'
import productionExecutionService from '../services/productionExecution.service'
import productionAnalyticsService from '../services/productionAnalytics.service'
import analyticsService from '../services/analytics.service'

const router = Router()

// ============================================================================
// SCHEDULE ROUTES
// ============================================================================

// Get schedules with filters
router.get('/schedules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      status: req.query.status as string,
      type: req.query.type as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
      includeMetrics: req.query.includeMetrics === 'true',
    }
    
    const result = await productionService.getSchedules(filters)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// Create new schedule
router.post('/schedules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 1 // Get from auth middleware
    const schedule = await productionService.createSchedule(req.body, userId)
    res.status(201).json(schedule)
  } catch (error) {
    next(error)
  }
})

// Update schedule
router.put('/schedules/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scheduleId = parseInt(req.params.id)
    const userId = (req as any).user?.id || 1
    const schedule = await productionService.updateSchedule(scheduleId, req.body, userId)
    res.json(schedule)
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// BATCH ROUTES
// ============================================================================

// Get production status
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      date: req.query.date as string,
      includeCompleted: req.query.includeCompleted === 'true',
    }
    
    const status = await productionExecutionService.getProductionStatus(filters)
    res.json(status)
  } catch (error) {
    next(error)
  }
})

// Create batch
router.post('/batches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 1
    const result = await productionService.createBatch(req.body, userId)
    res.status(201).json(result)
  } catch (error) {
    next(error)
  }
})

// Start batch
router.post('/batches/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchId = parseInt(req.params.id)
    const userId = (req as any).user?.id || 1
    const batch = await productionService.startBatch(batchId, userId)
    res.json(batch)
  } catch (error) {
    next(error)
  }
})

// Pause batch
router.post('/batches/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchId = parseInt(req.params.id)
    const userId = (req as any).user?.id || 1
    const result = await productionExecutionService.pauseBatch(
      batchId,
      req.body.reason || 'Manual pause',
      userId
    )
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// Resume batch
router.post('/batches/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchId = parseInt(req.params.id)
    const userId = (req as any).user?.id || 1
    const result = await productionExecutionService.resumeBatch(batchId, userId)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// STEP ROUTES
// ============================================================================

// Complete step
router.post('/steps/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stepId = parseInt(req.params.id)
    const userId = (req as any).user?.id || 1
    const step = await productionService.completeStep(stepId, req.body, userId)
    res.json(step)
  } catch (error) {
    next(error)
  }
})

// Update step progress
router.patch('/steps/:id/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stepId = parseInt(req.params.id)
    const userId = (req as any).user?.id || 1
    const step = await productionExecutionService.updateStepProgress(
      stepId,
      req.body,
      userId
    )
    res.json(step)
  } catch (error) {
    next(error)
  }
})

// Quality check
router.post('/steps/:id/quality-check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stepId = parseInt(req.params.id)
    const userId = (req as any).user?.id || 1
    const result = await productionExecutionService.performQualityCheck(
      stepId,
      req.body,
      userId
    )
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// PLANNING ROUTES
// ============================================================================

// Optimize production schedule
router.post('/planning/optimize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const optimizedSchedule = await productionPlanningService.optimizeProductionSchedule(req.body)
    res.json(optimizedSchedule)
  } catch (error) {
    next(error)
  }
})

// Calculate capacity
router.post('/planning/capacity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const capacity = await productionPlanningService.calculateDailyCapacity(req.body)
    res.json(capacity)
  } catch (error) {
    next(error)
  }
})

// Analyze demand
router.post('/planning/demand-analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const analysis = await productionPlanningService.analyzeDemand(req.body.productionDemand || [])
    res.json(analysis)
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// MONITORING ROUTES
// ============================================================================

// Start batch monitoring
router.post('/monitoring/batches/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchId = parseInt(req.params.id)
    const userId = (req as any).user?.id || 1
    const session = await productionExecutionService.startBatchMonitoring(batchId, userId)
    res.json(session)
  } catch (error) {
    next(error)
  }
})

// Report issue
router.post('/batches/:id/issues', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchId = parseInt(req.params.id)
    const userId = (req as any).user?.id || 1
    const result = await productionExecutionService.reportProductionIssue(
      batchId,
      req.body,
      userId
    )
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// ANALYTICS ROUTES
// ============================================================================

// Get production metrics
router.get('/analytics/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      workflowId: req.query.workflowId as string,
      includeSteps: req.query.includeSteps === 'true',
      groupBy: (req.query.groupBy as any) || 'day',
    }
    
    const metrics = await productionAnalyticsService.calculateProductionMetrics(filters)
    res.json(metrics)
  } catch (error) {
    next(error)
  }
})

// Generate efficiency report
router.get('/analytics/efficiency-report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      includeBreakdown: req.query.includeBreakdown !== 'false',
      includeBenchmarks: req.query.includeBenchmarks !== 'false',
    }
    
    const report = await productionAnalyticsService.generateEfficiencyReport(filters)
    res.json(report)
  } catch (error) {
    next(error)
  }
})

// Calculate capacity utilization
router.get('/analytics/capacity-utilization', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      includeSchedules: req.query.includeSchedules !== 'false',
    }
    
    const utilization = await productionAnalyticsService.calculateCapacityUtilization(filters)
    res.json(utilization)
  } catch (error) {
    next(error)
  }
})

// Generate forecast
router.post('/analytics/forecast', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const forecast = await productionAnalyticsService.generateProductionForecast(req.body)
    res.json(forecast)
  } catch (error) {
    next(error)
  }
})

// Quality analytics
router.get('/analytics/quality', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      workflowId: req.query.workflowId as string,
    }
    
    const analytics = await productionAnalyticsService.calculateQualityAnalytics(filters)
    res.json(analytics)
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// BUSINESS ANALYTICS ROUTES (Revenue, Product, Customer, Operational)
// ============================================================================

// Revenue analytics
router.get('/analytics/revenue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      groupBy: (req.query.groupBy as any) || 'day',
    }
    
    const analytics = await analyticsService.getRevenueAnalytics(filters)
    res.json(analytics)
  } catch (error) {
    next(error)
  }
})

// Product performance analytics
router.get('/analytics/product-performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      category: req.query.category as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
    }
    
    const analytics = await analyticsService.getProductPerformance(filters)
    res.json(analytics)
  } catch (error) {
    next(error)
  }
})

// Customer analytics
router.get('/analytics/customers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    }
    
    const analytics = await analyticsService.getCustomerAnalytics(filters)
    res.json(analytics)
  } catch (error) {
    next(error)
  }
})

// Operational metrics
router.get('/analytics/operational', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    }
    
    const analytics = await analyticsService.getOperationalMetrics(filters)
    res.json(analytics)
  } catch (error) {
    next(error)
  }
})

// Business summary dashboard
router.get('/analytics/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    }
    
    const summary = await analyticsService.getBusinessSummary(filters)
    res.json(summary)
  } catch (error) {
    next(error)
  }
})

export default router
