import { Op } from 'sequelize'
import {
  ProductionSchedule,
  ProductionBatch,
  ProductionStep,
  User,
  Product,
} from '../models'
import { logger } from '../utils/logger'

export interface AnalyticsFilters {
  startDate?: Date | string
  endDate?: Date | string
  workflowId?: string
  includeSteps?: boolean
  groupBy?: 'day' | 'week' | 'month'
}

export interface EfficiencyReportFilters {
  startDate?: Date | string
  endDate?: Date | string
  includeBreakdown?: boolean
  includeBenchmarks?: boolean
}

export interface CapacityFilters {
  startDate?: Date | string
  endDate?: Date | string
  includeSchedules?: boolean
}

export interface ForecastData {
  forecastPeriod?: number
  includeHistorical?: boolean
  confidenceLevel?: number
}

export interface OverviewMetrics {
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
  averageDuration: number
  averageDelay: number
  onTimeRate: number
  totalDelayMinutes: number
  delayedBatches: number
}

export interface ProductionMetricsResult {
  overview: OverviewMetrics
  efficiency: EfficiencyMetrics
  quality: QualityMetrics
  timing: TimingMetrics
  throughput: any
  trends: any
  workflowAnalysis: any
  recommendations: any[]
  stepAnalysis?: any
  period: {
    start: string
    end: string
    days: number
  }
  generatedAt: Date
}

class ProductionAnalyticsService {
  // ============================================================================
  // PERFORMANCE METRICS
  // ============================================================================

  /**
   * Calculate comprehensive production metrics
   */
  async calculateProductionMetrics(
    filters: AnalyticsFilters = {}
  ): Promise<ProductionMetricsResult> {
    try {
      const {
        startDate,
        endDate,
        workflowId,
        includeSteps = false,
        groupBy = 'day',
      } = filters

      logger.info('Calculating production metrics', {
        startDate,
        endDate,
        workflowId,
        groupBy,
      })

      // Set default date range (last 30 days)
      const end = endDate ? new Date(endDate) : new Date()
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

      // Build base query conditions
      const whereClause: any = {
        plannedStartTime: {
          [Op.between]: [start, end],
        },
      }

      if (workflowId) {
        whereClause.workflowId = workflowId
      }

      // Get batch data
      const batches = await ProductionBatch.findAll({
        where: whereClause,
        include: includeSteps ? [{ model: ProductionStep, as: 'steps' }] : [],
        order: [['plannedStartTime', 'ASC']],
      })

      // Calculate metrics
      const metrics: ProductionMetricsResult = {
        overview: await this.calculateOverviewMetrics(batches),
        efficiency: await this.calculateEfficiencyMetrics(batches),
        quality: await this.calculateQualityMetrics(batches),
        timing: await this.calculateTimingMetrics(batches),
        throughput: await this.calculateThroughputMetrics(batches, groupBy),
        trends: await this.calculateTrendMetrics(batches, groupBy),
        workflowAnalysis: await this.calculateWorkflowMetrics(batches),
        recommendations: await this.generatePerformanceRecommendations(batches),
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          days: Math.ceil(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          ),
        },
        generatedAt: new Date(),
      }

      if (includeSteps) {
        metrics.stepAnalysis = await this.calculateStepMetrics(batches)
      }

      logger.info('Production metrics calculated successfully', {
        batchCount: batches.length,
        timespan: `${start.toISOString().split('T')[0]} to ${
          end.toISOString().split('T')[0]
        }`,
      })

      return metrics
    } catch (error) {
      logger.error('Error calculating production metrics:', error)
      throw error
    }
  }

  /**
   * Generate production efficiency report
   */
  async generateEfficiencyReport(filters: EfficiencyReportFilters = {}) {
    try {
      const {
        startDate,
        endDate,
        includeBreakdown = true,
        includeBenchmarks = true,
      } = filters

      logger.info('Generating efficiency report', { startDate, endDate })

      // Get production data
      const metrics = await this.calculateProductionMetrics({
        startDate,
        endDate,
      })

      // Calculate efficiency breakdown
      const efficiencyBreakdown = includeBreakdown
        ? await this.calculateEfficiencyBreakdown(metrics)
        : null

      // Compare with benchmarks
      const benchmarkComparison = includeBenchmarks
        ? await this.compareToBenchmarks(metrics)
        : null

      // Generate improvement suggestions
      const improvements = await this.generateEfficiencyImprovements(metrics)

      return {
        summary: {
          overallEfficiency: metrics.efficiency.overall,
          productionEfficiency: metrics.efficiency.production,
          timeEfficiency: metrics.efficiency.time,
          qualityEfficiency: metrics.efficiency.quality,
          score: this.calculateEfficiencyScore(metrics.efficiency),
        },
        breakdown: efficiencyBreakdown,
        benchmarks: benchmarkComparison,
        improvements,
        period: metrics.period,
        generatedAt: new Date(),
      }
    } catch (error) {
      logger.error('Error generating efficiency report:', error)
      throw error
    }
  }

  /**
   * Calculate capacity utilization metrics
   */
  async calculateCapacityUtilization(filters: CapacityFilters = {}) {
    try {
      const { startDate, endDate, includeSchedules = true } = filters

      logger.info('Calculating capacity utilization', { startDate, endDate })

      // Get schedules if included
      let schedules: ProductionSchedule[] = []
      if (includeSchedules) {
        const scheduleWhere: any = {}
        if (startDate) scheduleWhere.scheduleDate = { [Op.gte]: startDate }
        if (endDate) scheduleWhere.scheduleDate = { [Op.lte]: endDate }

        schedules = await ProductionSchedule.findAll({
          where: scheduleWhere,
        })
      }

      // Get production batches
      const batchWhere: any = {}
      if (startDate || endDate) {
        batchWhere.plannedStartTime = {}
        if (startDate) batchWhere.plannedStartTime[Op.gte] = startDate
        if (endDate) batchWhere.plannedStartTime[Op.lte] = endDate
      }

      const batches = await ProductionBatch.findAll({
        where: batchWhere,
        include: [{ model: ProductionStep, as: 'steps' }],
      })

      // Calculate utilization metrics
      const utilization = {
        overall: await this.calculateOverallUtilization(schedules, batches),
        staff: await this.calculateStaffUtilization(schedules, batches),
        equipment: await this.calculateEquipmentUtilization(schedules, batches),
        time: await this.calculateTimeUtilization(schedules, batches),
        trends: await this.calculateUtilizationTrends(schedules, batches),
        bottlenecks: await this.identifyUtilizationBottlenecks(
          schedules,
          batches
        ),
      }

      return utilization
    } catch (error) {
      logger.error('Error calculating capacity utilization:', error)
      throw error
    }
  }

  /**
   * Generate production forecast
   */
  async generateProductionForecast(forecastData: ForecastData) {
    try {
      const {
        forecastPeriod = 30, // days
        includeHistorical = true,
        confidenceLevel = 0.8,
      } = forecastData

      logger.info('Generating production forecast', {
        forecastPeriod,
        confidenceLevel,
      })

      // Get historical data
      const historicalData = includeHistorical
        ? await this.getHistoricalProductionData(forecastPeriod * 2)
        : null

      // Calculate baseline metrics
      const baseline = await this.calculateBaselineMetrics(historicalData)

      // Generate forecasts
      const forecast: Record<string, any> = {
        volume: await this.forecastProductionVolume(baseline, forecastPeriod),
        efficiency: await this.forecastEfficiency(baseline, forecastPeriod),
        capacity: await this.forecastCapacityNeeds(baseline, forecastPeriod),
        quality: await this.forecastQualityMetrics(baseline, forecastPeriod),
        risks: await this.identifyForecastRisks(baseline, forecastPeriod),
      }

      // Calculate confidence intervals
      forecast.confidence = {
        level: confidenceLevel,
        intervals: await this.calculateConfidenceIntervals(
          forecast,
          confidenceLevel
        ),
      }

      return {
        forecast,
        baseline,
        historicalData: includeHistorical ? historicalData : null,
        parameters: {
          forecastPeriod,
          confidenceLevel,
          generatedAt: new Date(),
        },
      }
    } catch (error) {
      logger.error('Error generating production forecast:', error)
      throw error
    }
  }

  // ============================================================================
  // QUALITY ANALYTICS
  // ============================================================================

  /**
   * Calculate quality metrics and trends
   */
  async calculateQualityAnalytics(filters: AnalyticsFilters = {}) {
    try {
      const { startDate, endDate, workflowId } = filters

      logger.info('Calculating quality analytics', {
        startDate,
        endDate,
        workflowId,
      })

      // Build query conditions
      const whereClause: any = {}
      if (startDate || endDate) {
        whereClause.plannedStartTime = {}
        if (startDate) whereClause.plannedStartTime[Op.gte] = startDate
        if (endDate) whereClause.plannedStartTime[Op.lte] = endDate
      }
      if (workflowId) whereClause.workflowId = workflowId

      // Get batches with quality data
      const batches = await ProductionBatch.findAll({
        where: whereClause,
        include: [
          {
            model: ProductionStep,
            as: 'steps',
            where: {
              [Op.or]: [{ qualityCheckCompleted: true }, { hasIssues: true }],
            },
            required: false,
          },
        ],
      })

      // Calculate quality metrics
      const qualityAnalytics = {
        overview: await this.calculateQualityOverview(batches),
        trends: await this.calculateQualityTrends(batches),
        issues: await this.analyzeQualityIssues(batches),
        improvements: await this.identifyQualityImprovements(batches),
        compliance: await this.calculateQualityCompliance(batches),
        costs: await this.calculateQualityCosts(batches),
      }

      return qualityAnalytics
    } catch (error) {
      logger.error('Error calculating quality analytics:', error)
      throw error
    }
  }

  // ============================================================================
  // METRIC CALCULATION HELPERS
  // ============================================================================

  /**
   * Calculate overview metrics
   */
  private async calculateOverviewMetrics(
    batches: ProductionBatch[]
  ): Promise<OverviewMetrics> {
    const total = batches.length
    const completed = batches.filter((b) => b.status === 'completed').length
    const failed = batches.filter((b) => b.status === 'failed').length
    const cancelled = batches.filter((b) => b.status === 'cancelled').length
    const inProgress = batches.filter((b) => b.status === 'in_progress').length

    const totalPlanned = batches.reduce(
      (sum, b) => sum + (b.plannedQuantity || 0),
      0
    )
    const totalProduced = batches.reduce(
      (sum, b) => sum + (b.actualQuantity || 0),
      0
    )

    return {
      totalBatches: total,
      completedBatches: completed,
      failedBatches: failed,
      cancelledBatches: cancelled,
      inProgressBatches: inProgress,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      failureRate: total > 0 ? Math.round((failed / total) * 100) : 0,
      totalPlannedQuantity: totalPlanned,
      totalProducedQuantity: totalProduced,
      productionEfficiency:
        totalPlanned > 0 ? Math.round((totalProduced / totalPlanned) * 100) : 0,
    }
  }

  /**
   * Calculate efficiency metrics
   */
  private async calculateEfficiencyMetrics(
    batches: ProductionBatch[]
  ): Promise<EfficiencyMetrics> {
    const completedBatches = batches.filter(
      (b) => b.status === 'completed' && b.actualStartTime && b.actualEndTime
    )

    if (completedBatches.length === 0) {
      return {
        overall: 0,
        production: 0,
        time: 0,
        quality: 0,
        sampleSize: 0,
      }
    }

    // Time efficiency
    let timeEfficiencySum = 0
    let timeEfficiencyCount = 0

    completedBatches.forEach((batch) => {
      if (batch.plannedStartTime && batch.plannedEndTime) {
        const plannedDuration =
          new Date(batch.plannedEndTime).getTime() -
          new Date(batch.plannedStartTime).getTime()
        const actualDuration =
          new Date(batch.actualEndTime!).getTime() -
          new Date(batch.actualStartTime!).getTime()

        if (plannedDuration > 0 && actualDuration > 0) {
          const efficiency = Math.min(plannedDuration / actualDuration, 2) * 100 // Cap at 200%
          timeEfficiencySum += efficiency
          timeEfficiencyCount++
        }
      }
    })

    const timeEfficiency =
      timeEfficiencyCount > 0 ? timeEfficiencySum / timeEfficiencyCount : 0

    // Production efficiency (quantity)
    const totalPlanned = completedBatches.reduce(
      (sum, b) => sum + (b.plannedQuantity || 0),
      0
    )
    const totalProduced = completedBatches.reduce(
      (sum, b) => sum + (b.actualQuantity || 0),
      0
    )
    const productionEfficiency =
      totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0

    // Quality efficiency (1 - failure rate)
    const totalBatches = batches.length
    const failedBatches = batches.filter((b) => b.status === 'failed').length
    const qualityEfficiency =
      totalBatches > 0
        ? ((totalBatches - failedBatches) / totalBatches) * 100
        : 100

    // Overall efficiency (weighted average)
    const overall =
      timeEfficiency * 0.4 +
      productionEfficiency * 0.4 +
      qualityEfficiency * 0.2

    return {
      overall: Math.round(overall),
      production: Math.round(productionEfficiency),
      time: Math.round(timeEfficiency),
      quality: Math.round(qualityEfficiency),
      sampleSize: completedBatches.length,
    }
  }

  /**
   * Calculate quality metrics
   */
  private async calculateQualityMetrics(
    batches: ProductionBatch[]
  ): Promise<QualityMetrics> {
    const totalSteps = batches.reduce(
      (sum, batch) => sum + (batch.steps?.length || 0),
      0
    )

    const stepsWithIssues = batches.reduce(
      (sum, batch) =>
        sum + (batch.steps?.filter((step: any) => step.hasIssues).length || 0),
      0
    )

    const qualityChecksCompleted = batches.reduce(
      (sum, batch) =>
        sum +
        (batch.steps?.filter((step: any) => step.qualityCheckCompleted)
          .length || 0),
      0
    )

    const batchesWithIssues = batches.filter((batch) =>
      batch.steps?.some((step: any) => step.hasIssues)
    ).length

    return {
      overallQualityScore:
        totalSteps > 0
          ? Math.round(((totalSteps - stepsWithIssues) / totalSteps) * 100)
          : 100,
      qualityCheckCompletionRate:
        totalSteps > 0
          ? Math.round((qualityChecksCompleted / totalSteps) * 100)
          : 0,
      issueRate:
        batches.length > 0
          ? Math.round((batchesWithIssues / batches.length) * 100)
          : 0,
      totalQualityChecks: qualityChecksCompleted,
      totalIssues: stepsWithIssues,
      batchesWithIssues: batchesWithIssues,
    }
  }

  /**
   * Calculate timing metrics
   */
  private async calculateTimingMetrics(
    batches: ProductionBatch[]
  ): Promise<TimingMetrics> {
    const completedBatches = batches.filter(
      (b) => b.status === 'completed' && b.actualStartTime && b.actualEndTime
    )

    if (completedBatches.length === 0) {
      return {
        averageDuration: 0,
        averageDelay: 0,
        onTimeRate: 0,
        totalDelayMinutes: 0,
        delayedBatches: 0,
      }
    }

    let totalDuration = 0
    let totalDelay = 0
    let delayedCount = 0

    completedBatches.forEach((batch) => {
      // Calculate duration
      const duration =
        new Date(batch.actualEndTime!).getTime() -
        new Date(batch.actualStartTime!).getTime()
      totalDuration += duration

      // Calculate delay
      if (batch.plannedEndTime) {
        const plannedEnd = new Date(batch.plannedEndTime).getTime()
        const actualEnd = new Date(batch.actualEndTime!).getTime()
        if (actualEnd > plannedEnd) {
          const delay = actualEnd - plannedEnd
          totalDelay += delay
          delayedCount++
        }
      }
    })

    const averageDuration =
      totalDuration / completedBatches.length / (1000 * 60) // in minutes
    const averageDelay =
      delayedCount > 0 ? totalDelay / delayedCount / (1000 * 60) : 0
    const onTimeRate = Math.round(
      ((completedBatches.length - delayedCount) / completedBatches.length) * 100
    )

    return {
      averageDuration: Math.round(averageDuration),
      averageDelay: Math.round(averageDelay),
      onTimeRate,
      totalDelayMinutes: Math.round(totalDelay / (1000 * 60)),
      delayedBatches: delayedCount,
    }
  }

  // ============================================================================
  // ADDITIONAL HELPER METHODS (STUBS)
  // ============================================================================

  private async calculateThroughputMetrics(
    batches: ProductionBatch[],
    groupBy: string
  ): Promise<any> {
    // Implementation would calculate throughput by time period
    return {}
  }

  private async calculateTrendMetrics(
    batches: ProductionBatch[],
    groupBy: string
  ): Promise<any> {
    // Implementation would calculate trend data
    return {}
  }

  private async calculateWorkflowMetrics(
    batches: ProductionBatch[]
  ): Promise<any> {
    // Implementation would analyze workflow performance
    return {}
  }

  private async generatePerformanceRecommendations(
    batches: ProductionBatch[]
  ): Promise<any[]> {
    // Implementation would generate recommendations based on metrics
    return []
  }

  private async calculateStepMetrics(batches: ProductionBatch[]): Promise<any> {
    // Implementation would analyze individual step performance
    return {}
  }

  private async calculateEfficiencyBreakdown(
    metrics: ProductionMetricsResult
  ): Promise<any> {
    // Implementation would break down efficiency by various factors
    return {}
  }

  private async compareToBenchmarks(
    metrics: ProductionMetricsResult
  ): Promise<any> {
    // Implementation would compare metrics to industry benchmarks
    return {}
  }

  private async generateEfficiencyImprovements(
    metrics: ProductionMetricsResult
  ): Promise<any[]> {
    // Implementation would suggest efficiency improvements
    return []
  }

  private calculateEfficiencyScore(efficiency: EfficiencyMetrics): number {
    // Simple weighted score calculation
    return Math.round(
      efficiency.overall * 0.5 +
        efficiency.production * 0.2 +
        efficiency.time * 0.2 +
        efficiency.quality * 0.1
    )
  }

  private async calculateOverallUtilization(
    schedules: ProductionSchedule[],
    batches: ProductionBatch[]
  ): Promise<any> {
    // Implementation would calculate overall utilization
    return {}
  }

  private async calculateStaffUtilization(
    schedules: ProductionSchedule[],
    batches: ProductionBatch[]
  ): Promise<any> {
    // Implementation would calculate staff utilization
    return {}
  }

  private async calculateEquipmentUtilization(
    schedules: ProductionSchedule[],
    batches: ProductionBatch[]
  ): Promise<any> {
    // Implementation would calculate equipment utilization
    return {}
  }

  private async calculateTimeUtilization(
    schedules: ProductionSchedule[],
    batches: ProductionBatch[]
  ): Promise<any> {
    // Implementation would calculate time utilization
    return {}
  }

  private async calculateUtilizationTrends(
    schedules: ProductionSchedule[],
    batches: ProductionBatch[]
  ): Promise<any> {
    // Implementation would calculate utilization trends
    return {}
  }

  private async identifyUtilizationBottlenecks(
    schedules: ProductionSchedule[],
    batches: ProductionBatch[]
  ): Promise<any[]> {
    // Implementation would identify bottlenecks
    return []
  }

  private async getHistoricalProductionData(days: number): Promise<any> {
    // Implementation would fetch historical data
    return {}
  }

  private async calculateBaselineMetrics(historicalData: any): Promise<any> {
    // Implementation would calculate baseline from historical data
    return {}
  }

  private async forecastProductionVolume(
    baseline: any,
    period: number
  ): Promise<any> {
    // Implementation would forecast production volume
    return {}
  }

  private async forecastEfficiency(
    baseline: any,
    period: number
  ): Promise<any> {
    // Implementation would forecast efficiency
    return {}
  }

  private async forecastCapacityNeeds(
    baseline: any,
    period: number
  ): Promise<any> {
    // Implementation would forecast capacity needs
    return {}
  }

  private async forecastQualityMetrics(
    baseline: any,
    period: number
  ): Promise<any> {
    // Implementation would forecast quality metrics
    return {}
  }

  private async identifyForecastRisks(
    baseline: any,
    period: number
  ): Promise<any[]> {
    // Implementation would identify risks
    return []
  }

  private async calculateConfidenceIntervals(
    forecast: any,
    level: number
  ): Promise<any> {
    // Implementation would calculate confidence intervals
    return {}
  }

  private async calculateQualityOverview(
    batches: ProductionBatch[]
  ): Promise<any> {
    // Implementation would calculate quality overview
    return {}
  }

  private async calculateQualityTrends(
    batches: ProductionBatch[]
  ): Promise<any> {
    // Implementation would calculate quality trends
    return {}
  }

  private async analyzeQualityIssues(batches: ProductionBatch[]): Promise<any> {
    // Implementation would analyze quality issues
    return {}
  }

  private async identifyQualityImprovements(
    batches: ProductionBatch[]
  ): Promise<any[]> {
    // Implementation would identify quality improvements
    return []
  }

  private async calculateQualityCompliance(
    batches: ProductionBatch[]
  ): Promise<any> {
    // Implementation would calculate compliance metrics
    return {}
  }

  private async calculateQualityCosts(
    batches: ProductionBatch[]
  ): Promise<any> {
    // Implementation would calculate quality-related costs
    return {}
  }
}

export default new ProductionAnalyticsService()
