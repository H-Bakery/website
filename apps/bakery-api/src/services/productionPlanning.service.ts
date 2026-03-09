import { Op } from 'sequelize'
import { ProductionSchedule, ProductionBatch, User, Product } from '../models'
import workflowParser, { Workflow } from '../utils/workflowParser'
import { logger } from '../utils/logger'

export interface ProductionDemand {
  id?: string
  productId: number
  workflowId: string
  quantity: number
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export interface PlanningConstraints {
  workdayStart?: string
  workdayEnd?: string
  maxBatchSize?: number
  batchGap?: number
  scheduleDate?: string
}

export interface StaffShift {
  start: string
  end: string
  role?: string
  skills?: string[]
  hours?: number
}

export interface Equipment {
  id?: string
  name: string
  type?: string
  capacity?: number
}

export interface Worker {
  id: number
  startTime: string
  endTime: string
  hours: number
  role: string
  skills: string[]
}

export interface StaffCapacity {
  workers: Worker[]
  availableWorkers: number
  totalHours: number
  averageHours: number
}

export interface EquipmentCapacity {
  stations: Equipment[]
  totalStations: number
  totalCapacity: number
}

export interface TimeSlot {
  start: Date
  end: Date
  batchId?: string
}

export interface PlanningData {
  scheduleDate: string
  availableStaffIds?: number[]
  staffShifts?: Record<string, StaffShift>
  availableEquipment?: Equipment[]
  productionDemand?: ProductionDemand[]
  constraints?: PlanningConstraints
}

export interface CapacityAnalysis {
  staffCapacity: {
    workers: Array<{
      id: number
      startTime: string
      endTime: string
      hours: number
      role: string
      skills: string[]
    }>
    availableWorkers: number
    totalHours: number
    averageHours: number
  }
  equipmentCapacity: {
    stations: Array<{
      id: string
      name: string
      type: string
      capacity: number
      availableHours: number
    }>
    totalStations: number
    totalCapacity: number
    totalAvailableHours: number
  }
  workdayMinutes: number
  totalStaffHours: number
  availableStations: number
  bottlenecks: Array<{
    type: string
    severity: string
    message: string
  }>
  maxConcurrentBatches: number
}

export interface DemandAnalysis {
  totalItems: number
  totalEstimatedTime: number
  averageTimePerItem: number
  workflowRequirements: Record<string, any>
  priorityDistribution: Record<string, number>
  requiredEquipment: string[]
  complexity: number
}

export interface OptimizedBatch {
  name: string
  workflowId: string
  productId: number
  plannedQuantity: number
  priority: string
  plannedStartTime: Date
  plannedEndTime: Date
  estimatedDuration: number
  requiredEquipment: string[]
  complexity: number
  originalDemandId: string
}

export interface ResourceAllocation {
  staffAllocations: Array<{
    batchId: string
    assignedStaff: number[]
    startTime: Date
    endTime: Date
  }>
  equipmentAllocations: Array<{
    batchId: string
    assignedEquipment: string[]
    startTime: Date
    endTime: Date
  }>
  conflicts: Array<{
    batchId: string
    type: string
    message: string
  }>
  utilization: {
    staff: number
    equipment: number
  }
}

export interface OptimizedSchedule {
  scheduleDate: string
  capacity: CapacityAnalysis
  demandAnalysis: DemandAnalysis
  optimizedBatches: OptimizedBatch[]
  resourceAllocation: ResourceAllocation
  recommendations: Array<{
    type: string
    priority: string
    message: string
    impact: string
  }>
  efficiency: number
}

class ProductionPlanningService {
  // ============================================================================
  // CAPACITY PLANNING
  // ============================================================================

  /**
   * Calculate optimal production schedule based on demand and capacity
   */
  async optimizeProductionSchedule(
    planningData: PlanningData
  ): Promise<OptimizedSchedule> {
    try {
      logger.info('Optimizing production schedule', {
        date: planningData.scheduleDate,
        demand: planningData.productionDemand?.length || 0,
      })

      const {
        scheduleDate,
        availableStaffIds = [],
        staffShifts = {},
        availableEquipment = [],
        productionDemand = [],
        constraints = {},
      } = planningData

      // Calculate available capacity
      const capacity = await this.calculateDailyCapacity({
        staffShifts,
        availableEquipment,
        workdayStart: constraints.workdayStart || '06:00:00',
        workdayEnd: constraints.workdayEnd || '18:00:00',
      })

      // Analyze production demand
      const demandAnalysis = await this.analyzeDemand(productionDemand)

      // Generate optimal batch schedule
      const optimizedBatches = await this.generateOptimalBatches(
        productionDemand,
        capacity,
        constraints
      )

      // Calculate resource allocation
      const resourceAllocation = await this.allocateResources(
        optimizedBatches,
        capacity,
        constraints
      )

      const optimizedSchedule: OptimizedSchedule = {
        scheduleDate,
        capacity,
        demandAnalysis,
        optimizedBatches,
        resourceAllocation,
        recommendations: await this.generateRecommendations(
          capacity,
          demandAnalysis
        ),
        efficiency: this.calculatePlanningEfficiency(capacity, demandAnalysis),
      }

      logger.info('Production schedule optimized successfully', {
        batchCount: optimizedBatches.length,
        efficiency: optimizedSchedule.efficiency,
      })

      return optimizedSchedule
    } catch (error) {
      logger.error('Error optimizing production schedule:', error)
      throw error
    }
  }

  /**
   * Calculate daily production capacity
   */
  async calculateDailyCapacity(capacityData: {
    staffShifts: Record<string, StaffShift>
    availableEquipment: Equipment[]
    workdayStart: string
    workdayEnd: string
  }): Promise<CapacityAnalysis> {
    try {
      const { staffShifts, availableEquipment, workdayStart, workdayEnd } =
        capacityData

      // Calculate staff capacity
      const staffCapacity = this.calculateStaffCapacity(staffShifts)

      // Calculate equipment capacity
      const equipmentCapacity = this.calculateEquipmentCapacity(
        availableEquipment,
        workdayStart,
        workdayEnd
      )

      // Calculate total working hours
      const workdayMinutes = this.calculateWorkdayMinutes(
        workdayStart,
        workdayEnd
      )

      // Determine bottlenecks
      const bottlenecks = this.identifyCapacityBottlenecks(
        staffCapacity,
        equipmentCapacity
      )

      return {
        staffCapacity,
        equipmentCapacity,
        workdayMinutes,
        totalStaffHours: staffCapacity.totalHours,
        availableStations: equipmentCapacity.stations.length,
        bottlenecks,
        maxConcurrentBatches: Math.min(
          staffCapacity.availableWorkers,
          equipmentCapacity.stations.length
        ),
      }
    } catch (error) {
      logger.error('Error calculating daily capacity:', error)
      throw error
    }
  }

  /**
   * Analyze production demand and requirements
   */
  async analyzeDemand(
    productionDemand: ProductionDemand[]
  ): Promise<DemandAnalysis> {
    try {
      let totalItems = 0
      let totalEstimatedTime = 0
      const workflowRequirements = new Map()
      const priorityDistribution: Record<string, number> = {
        high: 0,
        medium: 0,
        low: 0,
        urgent: 0,
      }
      const equipmentNeeds = new Set<string>()

      for (const demand of productionDemand) {
        totalItems += demand.quantity

        // Count priority distribution
        priorityDistribution[demand.priority || 'medium']++

        // Get workflow requirements
        const workflow = await workflowParser.getWorkflowById(demand.workflowId)
        if (workflow) {
          const workflowTime = this.calculateWorkflowDuration(workflow)
          const totalTime = workflowTime * demand.quantity
          totalEstimatedTime += totalTime

          // Track workflow usage
          const currentReq = workflowRequirements.get(demand.workflowId) || {
            count: 0,
            totalTime: 0,
          }
          workflowRequirements.set(demand.workflowId, {
            count: currentReq.count + demand.quantity,
            totalTime: currentReq.totalTime + totalTime,
            workflow,
          })

          // Track equipment needs
          if (workflow.equipment) {
            workflow.equipment.forEach((eq) => equipmentNeeds.add(eq))
          }
        }
      }

      return {
        totalItems,
        totalEstimatedTime,
        averageTimePerItem:
          totalItems > 0 ? totalEstimatedTime / totalItems : 0,
        workflowRequirements: Object.fromEntries(workflowRequirements),
        priorityDistribution,
        requiredEquipment: Array.from(equipmentNeeds),
        complexity: this.calculateDemandComplexity(productionDemand),
      }
    } catch (error) {
      logger.error('Error analyzing production demand:', error)
      throw error
    }
  }

  /**
   * Generate optimal batch schedule
   */
  async generateOptimalBatches(
    productionDemand: ProductionDemand[],
    capacity: CapacityAnalysis,
    constraints: PlanningConstraints
  ): Promise<OptimizedBatch[]> {
    try {
      const batches: OptimizedBatch[] = []
      const sortedDemand = this.sortDemandByPriority(productionDemand)

      let currentTime = this.parseTime(constraints.workdayStart || '06:00:00')
      const endTime = this.parseTime(constraints.workdayEnd || '18:00:00')
      const maxBatchSize = constraints.maxBatchSize || 50

      for (const demand of sortedDemand) {
        const workflow = await workflowParser.getWorkflowById(demand.workflowId)
        if (!workflow) continue

        // Calculate optimal batch size
        const optimalBatchSize = Math.min(demand.quantity, maxBatchSize)
        const batchCount = Math.ceil(demand.quantity / optimalBatchSize)

        for (let i = 0; i < batchCount; i++) {
          const batchQuantity = Math.min(
            optimalBatchSize,
            demand.quantity - i * optimalBatchSize
          )
          const batchDuration =
            this.calculateWorkflowDuration(workflow) *
            (batchQuantity / optimalBatchSize)

          // Check if batch fits in remaining time
          if (currentTime + batchDuration > endTime) {
            logger.warn(
              `Batch ${i + 1} for ${demand.workflowId} cannot fit in schedule`
            )
            break
          }

          const batch: OptimizedBatch = {
            name: `${workflow.name || demand.workflowId} Batch ${i + 1}`,
            workflowId: demand.workflowId,
            productId: demand.productId,
            plannedQuantity: batchQuantity,
            priority: demand.priority,
            plannedStartTime: this.timeToDate(
              currentTime,
              constraints.scheduleDate || new Date().toISOString()
            ),
            plannedEndTime: this.timeToDate(
              currentTime + batchDuration,
              constraints.scheduleDate || new Date().toISOString()
            ),
            estimatedDuration: batchDuration,
            requiredEquipment: workflow.equipment || [],
            complexity: this.calculateBatchComplexity(workflow),
            originalDemandId: demand.id || `demand_${demand.workflowId}_${i}`,
          }

          batches.push(batch)
          currentTime += batchDuration + (constraints.batchGap || 15) // Add gap between batches
        }
      }

      // Optimize batch order for efficiency
      return this.optimizeBatchOrder(batches, capacity)
    } catch (error) {
      logger.error('Error generating optimal batches:', error)
      throw error
    }
  }

  /**
   * Allocate resources to optimized batches
   */
  async allocateResources(
    batches: OptimizedBatch[],
    capacity: CapacityAnalysis,
    constraints: PlanningConstraints
  ): Promise<ResourceAllocation> {
    try {
      const allocation: ResourceAllocation = {
        staffAllocations: [],
        equipmentAllocations: [],
        conflicts: [],
        utilization: {
          staff: 0,
          equipment: 0,
        },
      }

      const staffSchedule = new Map<
        number,
        Array<{ start: Date; end: Date; batchId: string }>
      >()
      const equipmentSchedule = new Map<
        string,
        Array<{ start: Date; end: Date; batchId: string }>
      >()

      // Initialize schedules
      capacity.staffCapacity.workers.forEach((worker) => {
        staffSchedule.set(worker.id, [])
      })
      capacity.equipmentCapacity.stations.forEach((station) => {
        equipmentSchedule.set(station.id, [])
      })

      for (const batch of batches) {
        const batchStart = new Date(batch.plannedStartTime)
        const batchEnd = new Date(batch.plannedEndTime)

        // Allocate staff
        const assignedStaff = this.assignOptimalStaff(
          batch,
          capacity.staffCapacity.workers,
          staffSchedule,
          batchStart,
          batchEnd
        )

        // Allocate equipment
        const assignedEquipment = this.assignOptimalEquipment(
          batch,
          capacity.equipmentCapacity.stations,
          equipmentSchedule,
          batchStart,
          batchEnd
        )

        if (assignedStaff.length === 0) {
          allocation.conflicts.push({
            batchId: batch.originalDemandId,
            type: 'staff',
            message: 'No available staff for this batch',
          })
        }

        if (
          batch.requiredEquipment.length > 0 &&
          assignedEquipment.length === 0
        ) {
          allocation.conflicts.push({
            batchId: batch.originalDemandId,
            type: 'equipment',
            message: 'Required equipment not available',
          })
        }

        allocation.staffAllocations.push({
          batchId: batch.originalDemandId,
          assignedStaff: assignedStaff.map((s) => s.id),
          startTime: batchStart,
          endTime: batchEnd,
        })

        allocation.equipmentAllocations.push({
          batchId: batch.originalDemandId,
          assignedEquipment: assignedEquipment.map((e) => e.id),
          startTime: batchStart,
          endTime: batchEnd,
        })
      }

      // Calculate utilization
      allocation.utilization = this.calculateResourceUtilization(
        allocation,
        capacity,
        constraints.workdayStart || '06:00:00',
        constraints.workdayEnd || '18:00:00'
      )

      return allocation
    } catch (error) {
      logger.error('Error allocating resources:', error)
      throw error
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Calculate staff capacity
   */
  private calculateStaffCapacity(staffShifts: Record<string, StaffShift>) {
    const workers: Worker[] = []
    let totalHours = 0

    for (const [staffId, shift] of Object.entries(staffShifts)) {
      if (shift.start && shift.end) {
        const shiftHours = this.calculateShiftHours(shift.start, shift.end)
        totalHours += shiftHours

        workers.push({
          id: parseInt(staffId),
          startTime: shift.start,
          endTime: shift.end,
          hours: shiftHours,
          role: shift.role || 'baker',
          skills: shift.skills || ['general'],
        })
      }
    }

    return {
      workers,
      availableWorkers: workers.length,
      totalHours,
      averageHours: workers.length > 0 ? totalHours / workers.length : 0,
    }
  }

  /**
   * Calculate equipment capacity
   */
  private calculateEquipmentCapacity(
    availableEquipment: Equipment[],
    workdayStart: string,
    workdayEnd: string
  ) {
    const workdayHours = this.calculateShiftHours(workdayStart, workdayEnd)

    const stations = availableEquipment.map((equipment, index) => ({
      id: equipment.id || `eq_${index}`,
      name: equipment.name || (equipment as any),
      type: equipment.type || 'general',
      capacity: equipment.capacity || 1,
      availableHours: workdayHours,
    }))

    return {
      stations,
      totalStations: stations.length,
      totalCapacity: stations.reduce(
        (sum, station) => sum + station.capacity,
        0
      ),
      totalAvailableHours: stations.reduce(
        (sum, station) => sum + station.availableHours,
        0
      ),
    }
  }

  /**
   * Identify capacity bottlenecks
   */
  private identifyCapacityBottlenecks(
    staffCapacity: StaffCapacity,
    equipmentCapacity: EquipmentCapacity
  ) {
    const bottlenecks = []

    // Check staff bottlenecks
    if (staffCapacity.availableWorkers < 2) {
      bottlenecks.push({
        type: 'staff',
        severity: 'high',
        message: 'Insufficient staff members available',
      })
    }

    // Check equipment bottlenecks
    if (equipmentCapacity.totalStations < 2) {
      bottlenecks.push({
        type: 'equipment',
        severity: 'high',
        message: 'Limited equipment stations available',
      })
    }

    // Check balance between staff and equipment
    const staffToEquipmentRatio =
      staffCapacity.availableWorkers / equipmentCapacity.totalStations
    if (staffToEquipmentRatio > 2) {
      bottlenecks.push({
        type: 'equipment',
        severity: 'medium',
        message: 'Equipment may become a bottleneck with current staff levels',
      })
    } else if (staffToEquipmentRatio < 0.5) {
      bottlenecks.push({
        type: 'staff',
        severity: 'medium',
        message:
          'Staff may become a bottleneck with current equipment availability',
      })
    }

    return bottlenecks
  }

  /**
   * Calculate workflow duration in minutes
   */
  private calculateWorkflowDuration(workflow: Workflow): number {
    if (!workflow.steps) return 60 // Default 1 hour

    return workflow.steps.reduce((total, step) => {
      const duration = step.timeout || step.duration || '30min'
      return total + this.parseDuration(duration)
    }, 0)
  }

  /**
   * Parse duration string to minutes
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/(\d+)(min|h|hour|hours)?/)
    if (!match) return 30

    const value = parseInt(match[1])
    const unit = match[2] || 'min'

    return unit.startsWith('h') ? value * 60 : value
  }

  /**
   * Calculate shift hours
   */
  private calculateShiftHours(start: string, end: string): number {
    const startTime = new Date(`1970-01-01T${start}`)
    const endTime = new Date(`1970-01-01T${end}`)
    return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
  }

  /**
   * Calculate workday minutes
   */
  private calculateWorkdayMinutes(start: string, end: string): number {
    return this.calculateShiftHours(start, end) * 60
  }

  /**
   * Parse time string to minutes from midnight
   */
  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  /**
   * Convert minutes from midnight to Date object
   */
  private timeToDate(minutes: number, dateString: string): Date {
    const date = new Date(dateString)
    date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
    return date
  }

  /**
   * Sort demand by priority and complexity
   */
  private sortDemandByPriority(
    productionDemand: ProductionDemand[]
  ): ProductionDemand[] {
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    }

    return [...productionDemand].sort((a, b) => {
      const priorityDiff =
        (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
      if (priorityDiff !== 0) return priorityDiff

      // Secondary sort by quantity (larger batches first for efficiency)
      return b.quantity - a.quantity
    })
  }

  /**
   * Calculate demand complexity
   */
  private calculateDemandComplexity(
    productionDemand: ProductionDemand[]
  ): number {
    let complexity = 0

    // Factor in number of different workflows
    const uniqueWorkflows = new Set(productionDemand.map((d) => d.workflowId))
    complexity += uniqueWorkflows.size * 0.2

    // Factor in total quantity
    const totalQuantity = productionDemand.reduce(
      (sum, d) => sum + d.quantity,
      0
    )
    complexity += Math.log10(totalQuantity + 1) * 0.3

    // Factor in priority distribution
    const priorityCounts = productionDemand.reduce(
      (counts, d) => {
        counts[d.priority || 'medium']++
        return counts
      },
      { urgent: 0, high: 0, medium: 0, low: 0 } as Record<string, number>
    )

    complexity += priorityCounts.urgent * 0.4 + priorityCounts.high * 0.2

    return Math.min(complexity, 10) // Cap at 10
  }

  /**
   * Calculate batch complexity
   */
  private calculateBatchComplexity(workflow: Workflow): number {
    let complexity = 1

    if (workflow.steps) {
      complexity += workflow.steps.length * 0.1

      // Add complexity for special step types
      const specialSteps = workflow.steps.filter(
        (step) => step.type && !['active', 'manual'].includes(step.type)
      )
      complexity += specialSteps.length * 0.2
    }

    if (workflow.equipment && workflow.equipment.length > 2) {
      complexity += 0.3
    }

    return Math.min(complexity, 5) // Cap at 5
  }

  /**
   * Optimize batch order for efficiency
   */
  private optimizeBatchOrder(
    batches: OptimizedBatch[],
    capacity: CapacityAnalysis
  ): OptimizedBatch[] {
    // Sort by start time first
    const sortedBatches = [...batches].sort(
      (a, b) =>
        new Date(a.plannedStartTime).getTime() -
        new Date(b.plannedStartTime).getTime()
    )

    // Group similar workflows together for efficiency
    const workflowGroups = new Map<string, OptimizedBatch[]>()
    sortedBatches.forEach((batch) => {
      if (!workflowGroups.has(batch.workflowId)) {
        workflowGroups.set(batch.workflowId, [])
      }
      workflowGroups.get(batch.workflowId)!.push(batch)
    })

    // Reorder within time slots to minimize equipment changes
    return sortedBatches // For now, return sorted by time - could implement more complex optimization
  }

  /**
   * Assign optimal staff to batch
   */
  private assignOptimalStaff(
    batch: OptimizedBatch,
    workers: Worker[],
    staffSchedule: Map<number, TimeSlot[]>,
    batchStart: Date,
    batchEnd: Date
  ): Worker[] {
    const assignedStaff = []
    const requiredStaff = Math.min(batch.complexity || 1, 2) // Max 2 staff per batch

    for (const worker of workers) {
      if (assignedStaff.length >= requiredStaff) break

      // Check if worker is available during batch time
      const workerSchedule = staffSchedule.get(worker.id) || []
      const isAvailable = workerSchedule.every(
        (slot) =>
          batchEnd <= new Date(slot.start) || batchStart >= new Date(slot.end)
      )

      if (isAvailable) {
        assignedStaff.push(worker)
        workerSchedule.push({
          start: batchStart,
          end: batchEnd,
          batchId: batch.originalDemandId,
        })
      }
    }

    return assignedStaff
  }

  /**
   * Assign optimal equipment to batch
   */
  private assignOptimalEquipment(
    batch: OptimizedBatch,
    stations: Equipment[],
    equipmentSchedule: Map<string, TimeSlot[]>,
    batchStart: Date,
    batchEnd: Date
  ): Equipment[] {
    const assignedEquipment = []
    const requiredEquipment = batch.requiredEquipment || []

    // If no specific equipment required, assign any available station
    if (requiredEquipment.length === 0) {
      for (const station of stations) {
        const stationSchedule = equipmentSchedule.get(station.id) || []
        const isAvailable = stationSchedule.every(
          (slot) =>
            batchEnd <= new Date(slot.start) || batchStart >= new Date(slot.end)
        )

        if (isAvailable) {
          assignedEquipment.push(station)
          stationSchedule.push({
            start: batchStart,
            end: batchEnd,
            batchId: batch.originalDemandId,
          })
          break // Only need one station
        }
      }
    } else {
      // Assign specific required equipment
      for (const requiredEq of requiredEquipment) {
        const station = stations.find(
          (s) =>
            s.name === requiredEq ||
            s.type === requiredEq ||
            s.id === requiredEq
        )

        if (station) {
          const stationSchedule = equipmentSchedule.get(station.id) || []
          const isAvailable = stationSchedule.every(
            (slot) =>
              batchEnd <= new Date(slot.start) ||
              batchStart >= new Date(slot.end)
          )

          if (isAvailable) {
            assignedEquipment.push(station)
            stationSchedule.push({
              start: batchStart,
              end: batchEnd,
              batchId: batch.originalDemandId,
            })
          }
        }
      }
    }

    return assignedEquipment
  }

  /**
   * Calculate resource utilization
   */
  private calculateResourceUtilization(
    allocation: ResourceAllocation,
    capacity: CapacityAnalysis,
    workdayStart: string,
    workdayEnd: string
  ): { staff: number; equipment: number } {
    const workdayMinutes = this.calculateWorkdayMinutes(
      workdayStart,
      workdayEnd
    )
    const totalStaffMinutes = capacity.staffCapacity.totalHours * 60
    const totalEquipmentMinutes =
      capacity.equipmentCapacity.totalAvailableHours * 60

    // Calculate actual usage
    let usedStaffMinutes = 0
    let usedEquipmentMinutes = 0

    allocation.staffAllocations.forEach((alloc) => {
      const duration =
        (new Date(alloc.endTime).getTime() -
          new Date(alloc.startTime).getTime()) /
        (1000 * 60)
      usedStaffMinutes += duration * alloc.assignedStaff.length
    })

    allocation.equipmentAllocations.forEach((alloc) => {
      const duration =
        (new Date(alloc.endTime).getTime() -
          new Date(alloc.startTime).getTime()) /
        (1000 * 60)
      usedEquipmentMinutes += duration * alloc.assignedEquipment.length
    })

    return {
      staff:
        totalStaffMinutes > 0
          ? (usedStaffMinutes / totalStaffMinutes) * 100
          : 0,
      equipment:
        totalEquipmentMinutes > 0
          ? (usedEquipmentMinutes / totalEquipmentMinutes) * 100
          : 0,
    }
  }

  /**
   * Generate planning recommendations
   */
  private async generateRecommendations(
    capacity: CapacityAnalysis,
    demandAnalysis: DemandAnalysis
  ): Promise<
    Array<{ type: string; priority: string; message: string; impact: string }>
  > {
    const recommendations = []

    // Check capacity vs demand
    const demandVsCapacity =
      demandAnalysis.totalEstimatedTime / (capacity.totalStaffHours * 60)

    if (demandVsCapacity > 0.9) {
      recommendations.push({
        type: 'capacity',
        priority: 'high',
        message:
          'Production demand is near capacity limits. Consider adding staff or extending hours.',
        impact: 'high',
      })
    }

    // Check equipment bottlenecks
    if (capacity.bottlenecks.length > 0) {
      recommendations.push({
        type: 'equipment',
        priority: 'medium',
        message: `Identified bottlenecks: ${capacity.bottlenecks
          .map((b) => b.type)
          .join(', ')}`,
        impact: 'medium',
      })
    }

    // Check workflow diversity
    const workflowCount = Object.keys(
      demandAnalysis.workflowRequirements
    ).length
    if (workflowCount > 5) {
      recommendations.push({
        type: 'complexity',
        priority: 'medium',
        message:
          'High workflow diversity may reduce efficiency. Consider batching similar products.',
        impact: 'medium',
      })
    }

    return recommendations
  }

  /**
   * Calculate planning efficiency score
   */
  private calculatePlanningEfficiency(
    capacity: CapacityAnalysis,
    demandAnalysis: DemandAnalysis
  ): number {
    let efficiency = 100

    // Reduce efficiency for capacity constraints
    const utilization =
      demandAnalysis.totalEstimatedTime / (capacity.totalStaffHours * 60)
    if (utilization > 1) {
      efficiency -= (utilization - 1) * 50 // Heavily penalize over-capacity
    } else if (utilization < 0.6) {
      efficiency -= (0.6 - utilization) * 20 // Lightly penalize under-utilization
    }

    // Reduce efficiency for bottlenecks
    efficiency -= capacity.bottlenecks.length * 10

    // Reduce efficiency for complexity
    efficiency -= Math.max(0, (demandAnalysis.complexity - 3) * 5)

    return Math.max(0, Math.min(100, Math.round(efficiency)))
  }
}

export default new ProductionPlanningService()
