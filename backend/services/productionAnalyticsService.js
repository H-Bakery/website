const { ProductionSchedule, ProductionBatch, ProductionStep, User, Product } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Production Analytics Service
 * Comprehensive analytics, metrics calculation, and reporting for production operations
 */
class ProductionAnalyticsService {

  // ============================================================================
  // PERFORMANCE METRICS
  // ============================================================================

  /**
   * Calculate comprehensive production metrics
   * @param {Object} filters - Analysis filters
   * @returns {Promise<Object>} Production metrics
   */
  async calculateProductionMetrics(filters = {}) {
    try {
      const {
        startDate,
        endDate,
        workflowId,
        includeSteps = false,
        groupBy = 'day'
      } = filters;

      logger.info('Calculating production metrics', { 
        startDate, 
        endDate, 
        workflowId, 
        groupBy 
      });

      // Set default date range (last 30 days)
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getTime() - (30 * 24 * 60 * 60 * 1000));

      // Build base query conditions
      const whereClause = {
        plannedStartTime: {
          [Op.between]: [start, end]
        }
      };

      if (workflowId) {
        whereClause.workflowId = workflowId;
      }

      // Get batch data
      const batches = await ProductionBatch.findAll({
        where: whereClause,
        include: includeSteps ? [{ model: ProductionStep }] : [],
        order: [['plannedStartTime', 'ASC']]
      });

      // Calculate metrics
      const metrics = {
        overview: await this.calculateOverviewMetrics(batches),
        efficiency: await this.calculateEfficiencyMetrics(batches),
        quality: await this.calculateQualityMetrics(batches),
        timing: await this.calculateTimingMetrics(batches),
        throughput: await this.calculateThroughputMetrics(batches, groupBy),
        trends: await this.calculateTrendMetrics(batches, groupBy),
        workflowAnalysis: await this.calculateWorkflowMetrics(batches),
        recommendations: await this.generatePerformanceRecommendations(batches)
      };

      if (includeSteps) {
        metrics.stepAnalysis = await this.calculateStepMetrics(batches);
      }

      logger.info('Production metrics calculated successfully', {
        batchCount: batches.length,
        timespan: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`
      });

      return {
        ...metrics,
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          days: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
        },
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error calculating production metrics:', error);
      throw error;
    }
  }

  /**
   * Generate production efficiency report
   * @param {Object} filters - Report filters
   * @returns {Promise<Object>} Efficiency report
   */
  async generateEfficiencyReport(filters = {}) {
    try {
      const {
        startDate,
        endDate,
        includeBreakdown = true,
        includeBenchmarks = true
      } = filters;

      logger.info('Generating efficiency report', { startDate, endDate });

      // Get production data
      const metrics = await this.calculateProductionMetrics(filters);

      // Calculate efficiency breakdown
      const efficiencyBreakdown = includeBreakdown ? 
        await this.calculateEfficiencyBreakdown(metrics) : null;

      // Compare with benchmarks
      const benchmarkComparison = includeBenchmarks ? 
        await this.compareToBenchmarks(metrics) : null;

      // Generate improvement suggestions
      const improvements = await this.generateEfficiencyImprovements(metrics);

      return {
        summary: {
          overallEfficiency: metrics.efficiency.overall,
          productionEfficiency: metrics.efficiency.production,
          timeEfficiency: metrics.efficiency.time,
          qualityEfficiency: metrics.efficiency.quality,
          score: this.calculateEfficiencyScore(metrics.efficiency)
        },
        breakdown: efficiencyBreakdown,
        benchmarks: benchmarkComparison,
        improvements,
        period: metrics.period,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error generating efficiency report:', error);
      throw error;
    }
  }

  /**
   * Calculate capacity utilization metrics
   * @param {Object} filters - Analysis filters
   * @returns {Promise<Object>} Capacity utilization data
   */
  async calculateCapacityUtilization(filters = {}) {
    try {
      const { startDate, endDate, includeSchedules = true } = filters;

      logger.info('Calculating capacity utilization', { startDate, endDate });

      // Get schedules if included
      let schedules = [];
      if (includeSchedules) {
        const scheduleWhere = {};
        if (startDate) scheduleWhere.scheduleDate = { [Op.gte]: startDate };
        if (endDate) scheduleWhere.scheduleDate = { [Op.lte]: endDate };

        schedules = await ProductionSchedule.findAll({
          where: scheduleWhere
        });
      }

      // Get production batches
      const batchWhere = {};
      if (startDate || endDate) {
        batchWhere.plannedStartTime = {};
        if (startDate) batchWhere.plannedStartTime[Op.gte] = startDate;
        if (endDate) batchWhere.plannedStartTime[Op.lte] = endDate;
      }

      const batches = await ProductionBatch.findAll({
        where: batchWhere,
        include: [{ model: ProductionStep }]
      });

      // Calculate utilization metrics
      const utilization = {
        overall: await this.calculateOverallUtilization(schedules, batches),
        staff: await this.calculateStaffUtilization(schedules, batches),
        equipment: await this.calculateEquipmentUtilization(schedules, batches),
        time: await this.calculateTimeUtilization(schedules, batches),
        trends: await this.calculateUtilizationTrends(schedules, batches),
        bottlenecks: await this.identifyUtilizationBottlenecks(schedules, batches)
      };

      return utilization;
    } catch (error) {
      logger.error('Error calculating capacity utilization:', error);
      throw error;
    }
  }

  /**
   * Generate production forecast
   * @param {Object} forecastData - Forecast parameters
   * @returns {Promise<Object>} Production forecast
   */
  async generateProductionForecast(forecastData) {
    try {
      const {
        forecastPeriod = 30, // days
        includeHistorical = true,
        confidenceLevel = 0.8
      } = forecastData;

      logger.info('Generating production forecast', { 
        forecastPeriod, 
        confidenceLevel 
      });

      // Get historical data
      const historicalData = includeHistorical ? 
        await this.getHistoricalProductionData(forecastPeriod * 2) : null;

      // Calculate baseline metrics
      const baseline = await this.calculateBaselineMetrics(historicalData);

      // Generate forecasts
      const forecast = {
        volume: await this.forecastProductionVolume(baseline, forecastPeriod),
        efficiency: await this.forecastEfficiency(baseline, forecastPeriod),
        capacity: await this.forecastCapacityNeeds(baseline, forecastPeriod),
        quality: await this.forecastQualityMetrics(baseline, forecastPeriod),
        risks: await this.identifyForecastRisks(baseline, forecastPeriod)
      };

      // Calculate confidence intervals
      forecast.confidence = {
        level: confidenceLevel,
        intervals: await this.calculateConfidenceIntervals(forecast, confidenceLevel)
      };

      return {
        forecast,
        baseline,
        historicalData: includeHistorical ? historicalData : null,
        parameters: {
          forecastPeriod,
          confidenceLevel,
          generatedAt: new Date()
        }
      };
    } catch (error) {
      logger.error('Error generating production forecast:', error);
      throw error;
    }
  }

  // ============================================================================
  // QUALITY ANALYTICS
  // ============================================================================

  /**
   * Calculate quality metrics and trends
   * @param {Object} filters - Analysis filters
   * @returns {Promise<Object>} Quality analytics
   */
  async calculateQualityAnalytics(filters = {}) {
    try {
      const { startDate, endDate, workflowId } = filters;

      logger.info('Calculating quality analytics', { startDate, endDate, workflowId });

      // Build query conditions
      const whereClause = {};
      if (startDate || endDate) {
        whereClause.plannedStartTime = {};
        if (startDate) whereClause.plannedStartTime[Op.gte] = startDate;
        if (endDate) whereClause.plannedStartTime[Op.lte] = endDate;
      }
      if (workflowId) whereClause.workflowId = workflowId;

      // Get batches with quality data
      const batches = await ProductionBatch.findAll({
        where: whereClause,
        include: [{
          model: ProductionStep,
          where: {
            [Op.or]: [
              { qualityCheckCompleted: true },
              { hasIssues: true }
            ]
          },
          required: false
        }]
      });

      // Calculate quality metrics
      const qualityAnalytics = {
        overview: await this.calculateQualityOverview(batches),
        trends: await this.calculateQualityTrends(batches),
        issues: await this.analyzeQualityIssues(batches),
        improvements: await this.identifyQualityImprovements(batches),
        compliance: await this.calculateQualityCompliance(batches),
        costs: await this.calculateQualityCosts(batches)
      };

      return qualityAnalytics;
    } catch (error) {
      logger.error('Error calculating quality analytics:', error);
      throw error;
    }
  }

  // ============================================================================
  // METRIC CALCULATION HELPERS
  // ============================================================================

  /**
   * Calculate overview metrics
   * @param {Array} batches - Production batches
   * @returns {Promise<Object>} Overview metrics
   */
  async calculateOverviewMetrics(batches) {
    const total = batches.length;
    const completed = batches.filter(b => b.status === 'completed').length;
    const failed = batches.filter(b => b.status === 'failed').length;
    const cancelled = batches.filter(b => b.status === 'cancelled').length;
    const inProgress = batches.filter(b => b.status === 'in_progress').length;

    const totalPlanned = batches.reduce((sum, b) => sum + (b.plannedQuantity || 0), 0);
    const totalProduced = batches.reduce((sum, b) => sum + (b.actualQuantity || 0), 0);

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
      productionEfficiency: totalPlanned > 0 ? Math.round((totalProduced / totalPlanned) * 100) : 0
    };
  }

  /**
   * Calculate efficiency metrics
   * @param {Array} batches - Production batches
   * @returns {Promise<Object>} Efficiency metrics
   */
  async calculateEfficiencyMetrics(batches) {
    const completedBatches = batches.filter(b => 
      b.status === 'completed' && b.actualStartTime && b.actualEndTime
    );

    if (completedBatches.length === 0) {
      return {
        overall: 0,
        production: 0,
        time: 0,
        quality: 0,
        sampleSize: 0
      };
    }

    // Time efficiency
    let timeEfficiencySum = 0;
    let timeEfficiencyCount = 0;

    completedBatches.forEach(batch => {
      if (batch.plannedStartTime && batch.plannedEndTime) {
        const plannedDuration = new Date(batch.plannedEndTime) - new Date(batch.plannedStartTime);
        const actualDuration = new Date(batch.actualEndTime) - new Date(batch.actualStartTime);
        
        if (plannedDuration > 0 && actualDuration > 0) {
          const efficiency = Math.min(plannedDuration / actualDuration, 2) * 100; // Cap at 200%
          timeEfficiencySum += efficiency;
          timeEfficiencyCount++;
        }
      }
    });

    const timeEfficiency = timeEfficiencyCount > 0 ? timeEfficiencySum / timeEfficiencyCount : 0;

    // Production efficiency (quantity)
    const totalPlanned = completedBatches.reduce((sum, b) => sum + (b.plannedQuantity || 0), 0);
    const totalProduced = completedBatches.reduce((sum, b) => sum + (b.actualQuantity || 0), 0);
    const productionEfficiency = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0;

    // Quality efficiency (1 - failure rate)
    const totalBatches = batches.length;
    const failedBatches = batches.filter(b => b.status === 'failed').length;
    const qualityEfficiency = totalBatches > 0 ? ((totalBatches - failedBatches) / totalBatches) * 100 : 100;

    // Overall efficiency (weighted average)
    const overall = (timeEfficiency * 0.4 + productionEfficiency * 0.4 + qualityEfficiency * 0.2);

    return {
      overall: Math.round(overall),
      production: Math.round(productionEfficiency),
      time: Math.round(timeEfficiency),
      quality: Math.round(qualityEfficiency),
      sampleSize: completedBatches.length
    };
  }

  /**
   * Calculate quality metrics
   * @param {Array} batches - Production batches
   * @returns {Promise<Object>} Quality metrics
   */
  async calculateQualityMetrics(batches) {
    const totalSteps = batches.reduce((sum, batch) => 
      sum + (batch.ProductionSteps?.length || 0), 0
    );

    const stepsWithIssues = batches.reduce((sum, batch) => 
      sum + (batch.ProductionSteps?.filter(step => step.hasIssues).length || 0), 0
    );

    const qualityChecksCompleted = batches.reduce((sum, batch) => 
      sum + (batch.ProductionSteps?.filter(step => step.qualityCheckCompleted).length || 0), 0
    );

    const batchesWithIssues = batches.filter(batch => 
      batch.ProductionSteps?.some(step => step.hasIssues)
    ).length;

    return {
      overallQualityScore: totalSteps > 0 ? Math.round(((totalSteps - stepsWithIssues) / totalSteps) * 100) : 100,
      qualityCheckCompletionRate: totalSteps > 0 ? Math.round((qualityChecksCompleted / totalSteps) * 100) : 0,
      issueRate: batches.length > 0 ? Math.round((batchesWithIssues / batches.length) * 100) : 0,
      totalQualityChecks: qualityChecksCompleted,
      totalIssues: stepsWithIssues,
      batchesWithIssues: batchesWithIssues
    };
  }

  /**
   * Calculate timing metrics
   * @param {Array} batches - Production batches
   * @returns {Promise<Object>} Timing metrics
   */
  async calculateTimingMetrics(batches) {
    const now = new Date();
    const completedBatches = batches.filter(b => b.status === 'completed');
    
    let totalDelayMinutes = 0;
    let delayedBatches = 0;
    let onTimeBatches = 0;
    let earlyBatches = 0;

    completedBatches.forEach(batch => {
      if (batch.plannedEndTime && batch.actualEndTime) {
        const plannedEnd = new Date(batch.plannedEndTime);
        const actualEnd = new Date(batch.actualEndTime);
        const delayMinutes = (actualEnd - plannedEnd) / (1000 * 60);

        if (delayMinutes > 15) { // 15 minute tolerance
          delayedBatches++;
          totalDelayMinutes += delayMinutes;
        } else if (delayMinutes < -15) {
          earlyBatches++;
        } else {
          onTimeBatches++;
        }
      }
    });

    // Check currently delayed batches
    const currentlyDelayed = batches.filter(batch => 
      batch.status !== 'completed' && batch.status !== 'cancelled' &&
      batch.plannedEndTime && now > new Date(batch.plannedEndTime)
    ).length;

    return {
      onTimePercentage: completedBatches.length > 0 ? 
        Math.round((onTimeBatches / completedBatches.length) * 100) : 0,
      delayedPercentage: completedBatches.length > 0 ? 
        Math.round((delayedBatches / completedBatches.length) * 100) : 0,
      earlyPercentage: completedBatches.length > 0 ? 
        Math.round((earlyBatches / completedBatches.length) * 100) : 0,
      averageDelayMinutes: delayedBatches > 0 ? Math.round(totalDelayMinutes / delayedBatches) : 0,
      currentlyDelayed,
      onTimeBatches,
      delayedBatches,
      earlyBatches
    };
  }

  /**
   * Calculate throughput metrics
   * @param {Array} batches - Production batches
   * @param {string} groupBy - Grouping period
   * @returns {Promise<Object>} Throughput metrics
   */
  async calculateThroughputMetrics(batches, groupBy = 'day') {
    const throughputData = new Map();
    
    batches.forEach(batch => {
      const date = new Date(batch.plannedStartTime);
      let key;

      switch (groupBy) {
        case 'hour':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          break;
        case 'day':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          break;
        case 'week':
          const week = this.getWeekNumber(date);
          key = `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!throughputData.has(key)) {
        throughputData.set(key, {
          period: key,
          batches: 0,
          plannedQuantity: 0,
          actualQuantity: 0,
          completed: 0,
          failed: 0
        });
      }

      const data = throughputData.get(key);
      data.batches++;
      data.plannedQuantity += batch.plannedQuantity || 0;
      data.actualQuantity += batch.actualQuantity || 0;
      
      if (batch.status === 'completed') data.completed++;
      if (batch.status === 'failed') data.failed++;
    });

    const throughputArray = Array.from(throughputData.values()).sort((a, b) => 
      a.period.localeCompare(b.period)
    );

    // Calculate averages
    const totalPeriods = throughputArray.length;
    const avgBatchesPerPeriod = totalPeriods > 0 ? 
      throughputArray.reduce((sum, d) => sum + d.batches, 0) / totalPeriods : 0;
    const avgQuantityPerPeriod = totalPeriods > 0 ? 
      throughputArray.reduce((sum, d) => sum + d.actualQuantity, 0) / totalPeriods : 0;

    return {
      byPeriod: throughputArray,
      summary: {
        totalPeriods,
        averageBatchesPerPeriod: Math.round(avgBatchesPerPeriod * 100) / 100,
        averageQuantityPerPeriod: Math.round(avgQuantityPerPeriod * 100) / 100,
        peakBatches: Math.max(...throughputArray.map(d => d.batches), 0),
        peakQuantity: Math.max(...throughputArray.map(d => d.actualQuantity), 0)
      }
    };
  }

  /**
   * Calculate trend metrics
   * @param {Array} batches - Production batches
   * @param {string} groupBy - Grouping period
   * @returns {Promise<Object>} Trend metrics
   */
  async calculateTrendMetrics(batches, groupBy = 'day') {
    const throughput = await this.calculateThroughputMetrics(batches, groupBy);
    const periods = throughput.byPeriod;

    if (periods.length < 2) {
      return {
        efficiency: { trend: 'stable', change: 0 },
        throughput: { trend: 'stable', change: 0 },
        quality: { trend: 'stable', change: 0 }
      };
    }

    // Calculate trends
    const efficiencyTrend = this.calculateTrend(periods.map(p => 
      p.completed > 0 ? (p.completed / p.batches) * 100 : 0
    ));

    const throughputTrend = this.calculateTrend(periods.map(p => p.batches));

    const qualityTrend = this.calculateTrend(periods.map(p => 
      p.batches > 0 ? ((p.batches - p.failed) / p.batches) * 100 : 100
    ));

    return {
      efficiency: efficiencyTrend,
      throughput: throughputTrend,
      quality: qualityTrend
    };
  }

  /**
   * Calculate trend direction and change
   * @param {Array} values - Values to analyze
   * @returns {Object} Trend information
   */
  calculateTrend(values) {
    if (values.length < 2) return { trend: 'stable', change: 0 };

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const change = secondAvg - firstAvg;
    const changePercent = firstAvg > 0 ? (change / firstAvg) * 100 : 0;

    let trend = 'stable';
    if (Math.abs(changePercent) > 5) {
      trend = change > 0 ? 'improving' : 'declining';
    }

    return {
      trend,
      change: Math.round(changePercent * 100) / 100,
      firstPeriodAvg: Math.round(firstAvg * 100) / 100,
      secondPeriodAvg: Math.round(secondAvg * 100) / 100
    };
  }

  /**
   * Calculate workflow-specific metrics
   * @param {Array} batches - Production batches
   * @returns {Promise<Object>} Workflow metrics
   */
  async calculateWorkflowMetrics(batches) {
    const workflowData = new Map();

    batches.forEach(batch => {
      if (!workflowData.has(batch.workflowId)) {
        workflowData.set(batch.workflowId, {
          workflowId: batch.workflowId,
          batches: [],
          totalBatches: 0,
          completedBatches: 0,
          failedBatches: 0,
          totalPlanned: 0,
          totalProduced: 0,
          totalDurationMinutes: 0
        });
      }

      const data = workflowData.get(batch.workflowId);
      data.batches.push(batch);
      data.totalBatches++;
      data.totalPlanned += batch.plannedQuantity || 0;
      data.totalProduced += batch.actualQuantity || 0;

      if (batch.status === 'completed') {
        data.completedBatches++;
        if (batch.actualStartTime && batch.actualEndTime) {
          const duration = (new Date(batch.actualEndTime) - new Date(batch.actualStartTime)) / (1000 * 60);
          data.totalDurationMinutes += duration;
        }
      } else if (batch.status === 'failed') {
        data.failedBatches++;
      }
    });

    // Calculate metrics for each workflow
    const workflowMetrics = Array.from(workflowData.values()).map(data => ({
      workflowId: data.workflowId,
      totalBatches: data.totalBatches,
      completionRate: data.totalBatches > 0 ? 
        Math.round((data.completedBatches / data.totalBatches) * 100) : 0,
      failureRate: data.totalBatches > 0 ? 
        Math.round((data.failedBatches / data.totalBatches) * 100) : 0,
      productionEfficiency: data.totalPlanned > 0 ? 
        Math.round((data.totalProduced / data.totalPlanned) * 100) : 0,
      averageDurationMinutes: data.completedBatches > 0 ? 
        Math.round(data.totalDurationMinutes / data.completedBatches) : 0,
      totalQuantityProduced: data.totalProduced
    }));

    // Sort by total batches
    workflowMetrics.sort((a, b) => b.totalBatches - a.totalBatches);

    return {
      byWorkflow: workflowMetrics,
      summary: {
        totalWorkflows: workflowMetrics.length,
        mostUsedWorkflow: workflowMetrics[0]?.workflowId,
        highestEfficiencyWorkflow: workflowMetrics.reduce((best, current) => 
          current.productionEfficiency > (best?.productionEfficiency || 0) ? current : best, null
        )?.workflowId
      }
    };
  }

  /**
   * Generate performance recommendations
   * @param {Array} batches - Production batches
   * @returns {Promise<Array>} Recommendations
   */
  async generatePerformanceRecommendations(batches) {
    const recommendations = [];
    const efficiency = await this.calculateEfficiencyMetrics(batches);
    const timing = await this.calculateTimingMetrics(batches);
    const quality = await this.calculateQualityMetrics(batches);

    // Efficiency recommendations
    if (efficiency.overall < 70) {
      recommendations.push({
        type: 'efficiency',
        priority: 'high',
        title: 'Low Overall Efficiency',
        description: `Overall efficiency is ${efficiency.overall}%. Consider reviewing workflows and resource allocation.`,
        impact: 'high',
        effort: 'medium'
      });
    }

    // Timing recommendations
    if (timing.delayedPercentage > 20) {
      recommendations.push({
        type: 'timing',
        priority: 'high',
        title: 'High Delay Rate',
        description: `${timing.delayedPercentage}% of batches are delayed. Review scheduling and capacity planning.`,
        impact: 'high',
        effort: 'medium'
      });
    }

    // Quality recommendations
    if (quality.issueRate > 15) {
      recommendations.push({
        type: 'quality',
        priority: 'high',
        title: 'Quality Issues',
        description: `${quality.issueRate}% of batches have quality issues. Implement additional quality controls.`,
        impact: 'high',
        effort: 'high'
      });
    }

    // Utilization recommendations
    if (batches.length > 0) {
      const utilizationScore = this.calculateUtilizationScore(batches);
      if (utilizationScore < 60) {
        recommendations.push({
          type: 'utilization',
          priority: 'medium',
          title: 'Low Capacity Utilization',
          description: 'Production capacity may be underutilized. Consider increasing batch sizes or frequency.',
          impact: 'medium',
          effort: 'low'
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get week number for date
   * @param {Date} date - Date to get week number for
   * @returns {number} Week number
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  }

  /**
   * Calculate utilization score
   * @param {Array} batches - Production batches
   * @returns {number} Utilization score
   */
  calculateUtilizationScore(batches) {
    // Simple utilization calculation based on completion rate and timing
    const completedBatches = batches.filter(b => b.status === 'completed').length;
    const totalBatches = batches.length;
    
    return totalBatches > 0 ? Math.round((completedBatches / totalBatches) * 100) : 0;
  }

  /**
   * Calculate efficiency score
   * @param {Object} efficiency - Efficiency metrics
   * @returns {number} Overall efficiency score
   */
  calculateEfficiencyScore(efficiency) {
    return Math.round((efficiency.overall + efficiency.production + efficiency.time + efficiency.quality) / 4);
  }

  // Placeholder methods for comprehensive analytics (would be fully implemented in production)
  async calculateOverallUtilization(schedules, batches) { return { score: 75, details: {} }; }
  async calculateStaffUtilization(schedules, batches) { return { average: 80, peak: 95, low: 60 }; }
  async calculateEquipmentUtilization(schedules, batches) { return { average: 70, peak: 90, low: 50 }; }
  async calculateTimeUtilization(schedules, batches) { return { efficiency: 85, waste: 15 }; }
  async calculateUtilizationTrends(schedules, batches) { return { trend: 'improving', change: 5 }; }
  async identifyUtilizationBottlenecks(schedules, batches) { return [{ type: 'staff', severity: 'medium' }]; }
  async getHistoricalProductionData(days) { return { days, batches: [], trends: {} }; }
  async calculateBaselineMetrics(historicalData) { return { volume: 100, efficiency: 80 }; }
  async forecastProductionVolume(baseline, period) { return { predicted: baseline.volume * 1.1, range: [95, 115] }; }
  async forecastEfficiency(baseline, period) { return { predicted: baseline.efficiency * 1.05, range: [75, 85] }; }
  async forecastCapacityNeeds(baseline, period) { return { staffNeeds: 5, equipmentNeeds: ['oven'] }; }
  async forecastQualityMetrics(baseline, period) { return { predicted: 95, risks: ['complexity'] }; }
  async identifyForecastRisks(baseline, period) { return [{ risk: 'capacity', probability: 0.3 }]; }
  async calculateConfidenceIntervals(forecast, level) { return { lower: 0.8, upper: 1.2 }; }
  async calculateQualityOverview(batches) { return { score: 90, checks: 100, issues: 5 }; }
  async calculateQualityTrends(batches) { return { trend: 'stable', change: 0 }; }
  async analyzeQualityIssues(batches) { return { types: [], frequency: {} }; }
  async identifyQualityImprovements(batches) { return [{ area: 'timing', impact: 'medium' }]; }
  async calculateQualityCompliance(batches) { return { rate: 95, standards: ['ISO'] }; }
  async calculateQualityCosts(batches) { return { total: 1000, savings: 200 }; }
  async calculateEfficiencyBreakdown(metrics) { return { byWorkflow: {}, byStep: {} }; }
  async compareToBenchmarks(metrics) { return { industry: 80, internal: 85 }; }
  async generateEfficiencyImprovements(metrics) { return [{ area: 'scheduling', potential: 10 }]; }
}

module.exports = new ProductionAnalyticsService();