// Production API Service
// Handles all backend communication for production planning and monitoring

import {
  ProductionSchedule,
  ProductionBatch,
  ProductionStep,
  ProductionMetrics,
  ProductionStatus,
  CapacityAnalysis,
  ProductionFilters,
  ProductionApiResponse,
  PaginatedResponse,
} from '../types/production'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

class ProductionAPIService {
  private getAuthHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Network error' }))
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
    }
    return response.json()
  }

  // ============================================================================
  // PRODUCTION SCHEDULES
  // ============================================================================

  /**
   * Get production schedules with optional filtering
   */
  async getSchedules(filters: {
    startDate?: string
    endDate?: string
    status?: string
    type?: string
    limit?: number
    offset?: number
    includeMetrics?: boolean
  } = {}): Promise<PaginatedResponse<ProductionSchedule>> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value))
    })

    const response = await fetch(`${API_BASE_URL}/api/production/schedules?${params}`, {
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<PaginatedResponse<ProductionSchedule>>(response)
  }

  /**
   * Get a specific production schedule
   */
  async getSchedule(id: number): Promise<ProductionSchedule> {
    const response = await fetch(`${API_BASE_URL}/api/production/schedules/${id}`, {
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<ProductionSchedule>(response)
  }

  /**
   * Create a new production schedule
   */
  async createSchedule(scheduleData: Partial<ProductionSchedule>): Promise<ProductionSchedule> {
    const response = await fetch(`${API_BASE_URL}/api/production/schedules`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(scheduleData),
    })

    return this.handleResponse<ProductionSchedule>(response)
  }

  /**
   * Update a production schedule
   */
  async updateSchedule(id: number, scheduleData: Partial<ProductionSchedule>): Promise<ProductionSchedule> {
    const response = await fetch(`${API_BASE_URL}/api/production/schedules/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(scheduleData),
    })

    return this.handleResponse<ProductionSchedule>(response)
  }

  /**
   * Delete a production schedule
   */
  async deleteSchedule(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/production/schedules/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to delete schedule: ${response.statusText}`)
    }
  }

  // ============================================================================
  // PRODUCTION BATCHES
  // ============================================================================

  /**
   * Get production batches with optional filtering
   */
  async getBatches(filters: {
    scheduleId?: number
    status?: string
    workflowId?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  } = {}): Promise<PaginatedResponse<ProductionBatch>> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value))
    })

    const response = await fetch(`${API_BASE_URL}/api/production/batches?${params}`, {
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<PaginatedResponse<ProductionBatch>>(response)
  }

  /**
   * Get a specific production batch with steps
   */
  async getBatch(id: number): Promise<ProductionBatch> {
    const response = await fetch(`${API_BASE_URL}/api/production/batches/${id}`, {
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<ProductionBatch>(response)
  }

  /**
   * Create a new production batch
   */
  async createBatch(batchData: Partial<ProductionBatch>): Promise<ProductionBatch> {
    const response = await fetch(`${API_BASE_URL}/api/production/batches`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(batchData),
    })

    return this.handleResponse<ProductionBatch>(response)
  }

  /**
   * Update a production batch
   */
  async updateBatch(id: number, batchData: Partial<ProductionBatch>): Promise<ProductionBatch> {
    const response = await fetch(`${API_BASE_URL}/api/production/batches/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(batchData),
    })

    return this.handleResponse<ProductionBatch>(response)
  }

  /**
   * Start a production batch
   */
  async startBatch(id: number): Promise<ProductionBatch> {
    const response = await fetch(`${API_BASE_URL}/api/production/batches/${id}/start`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<ProductionBatch>(response)
  }

  /**
   * Delete a production batch
   */
  async deleteBatch(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/production/batches/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to delete batch: ${response.statusText}`)
    }
  }

  // ============================================================================
  // PRODUCTION STEPS
  // ============================================================================

  /**
   * Get steps for a production batch
   */
  async getBatchSteps(batchId: number): Promise<ProductionStep[]> {
    const response = await fetch(`${API_BASE_URL}/api/production/batches/${batchId}/steps`, {
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<ProductionStep[]>(response)
  }

  /**
   * Update a production step
   */
  async updateStep(stepId: number, stepData: Partial<ProductionStep>): Promise<ProductionStep> {
    const response = await fetch(`${API_BASE_URL}/api/production/steps/${stepId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(stepData),
    })

    return this.handleResponse<ProductionStep>(response)
  }

  /**
   * Complete a production step
   */
  async completeStep(stepId: number, completionData: {
    actualParameters?: Record<string, any>
    qualityResults?: Record<string, any>
    notes?: string
  }): Promise<ProductionStep> {
    const response = await fetch(`${API_BASE_URL}/api/production/steps/${stepId}/complete`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(completionData),
    })

    return this.handleResponse<ProductionStep>(response)
  }

  // ============================================================================
  // ANALYTICS & METRICS
  // ============================================================================

  /**
   * Get comprehensive production analytics
   */
  async getAnalytics(filters: {
    startDate?: string
    endDate?: string
    workflowId?: string
    includeSteps?: boolean
    groupBy?: 'day' | 'week' | 'month'
  } = {}): Promise<ProductionMetrics> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value))
    })

    const response = await fetch(`${API_BASE_URL}/api/production/analytics?${params}`, {
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<ProductionMetrics>(response)
  }

  /**
   * Get efficiency report
   */
  async getEfficiencyReport(filters: {
    startDate?: string
    endDate?: string
    includeBreakdown?: boolean
    includeBenchmarks?: boolean
  } = {}): Promise<any> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value))
    })

    const response = await fetch(`${API_BASE_URL}/api/production/analytics/efficiency?${params}`, {
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<any>(response)
  }

  /**
   * Get capacity utilization metrics
   */
  async getCapacityUtilization(filters: {
    startDate?: string
    endDate?: string
    includeSchedules?: boolean
  } = {}): Promise<any> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value))
    })

    const response = await fetch(`${API_BASE_URL}/api/production/analytics/capacity?${params}`, {
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<any>(response)
  }

  // ============================================================================
  // REAL-TIME MONITORING
  // ============================================================================

  /**
   * Get real-time production status
   */
  async getProductionStatus(filters: {
    date?: string
    includeCompleted?: boolean
  } = {}): Promise<ProductionStatus> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value))
    })

    const response = await fetch(`${API_BASE_URL}/api/production/status?${params}`, {
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<ProductionStatus>(response)
  }

  /**
   * Start batch monitoring
   */
  async startBatchMonitoring(batchId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/production/monitor/batch/${batchId}/start`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<any>(response)
  }

  /**
   * Update step progress
   */
  async updateStepProgress(stepId: number, progressData: {
    progress?: number
    status?: string
    hasIssues?: boolean
    qualityCheckCompleted?: boolean
    notes?: string
  }): Promise<ProductionStep> {
    const response = await fetch(`${API_BASE_URL}/api/production/steps/${stepId}/progress`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ progressData }),
    })

    return this.handleResponse<ProductionStep>(response)
  }

  /**
   * Report production issue
   */
  async reportIssue(batchId: number, issueData: {
    stepId?: number
    type: string
    severity: string
    description: string
    impact?: string
  }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/production/batches/${batchId}/issues`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ issueData }),
    })

    return this.handleResponse<any>(response)
  }

  /**
   * Perform quality check
   */
  async performQualityCheck(stepId: number, qualityData: {
    checks: Array<{ name: string; score: number; passed: boolean; notes?: string }>
    passingScore?: number
    notes?: string
  }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/production/steps/${stepId}/quality-check`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ qualityData }),
    })

    return this.handleResponse<any>(response)
  }

  /**
   * Pause production batch
   */
  async pauseBatch(batchId: number, reason: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/production/batches/${batchId}/pause`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ reason }),
    })

    return this.handleResponse<any>(response)
  }

  /**
   * Resume production batch
   */
  async resumeBatch(batchId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/production/batches/${batchId}/resume`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<any>(response)
  }

  // ============================================================================
  // CAPACITY PLANNING
  // ============================================================================

  /**
   * Optimize production schedule
   */
  async optimizeSchedule(planningData: {
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
  }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/production/planning/optimize`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(planningData),
    })

    return this.handleResponse<any>(response)
  }

  /**
   * Calculate daily capacity
   */
  async calculateCapacity(capacityData: {
    staffShifts: Record<string, any>
    availableEquipment: any[]
    workdayStart?: string
    workdayEnd?: string
  }): Promise<CapacityAnalysis> {
    const response = await fetch(`${API_BASE_URL}/api/production/planning/capacity`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(capacityData),
    })

    return this.handleResponse<CapacityAnalysis>(response)
  }

  // ============================================================================
  // WORKFLOW INTEGRATION
  // ============================================================================

  /**
   * Get available workflows for production
   */
  async getWorkflows(): Promise<Array<{
    id: string
    name: string
    version: string
    description?: string
    steps: number
  }>> {
    const response = await fetch(`${API_BASE_URL}/api/workflows`, {
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<any[]>(response)
  }

  /**
   * Get workflow details
   */
  async getWorkflow(workflowId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/workflows/${workflowId}`, {
      headers: this.getAuthHeaders(),
    })

    return this.handleResponse<any>(response)
  }
}

// Export singleton instance
export const productionAPI = new ProductionAPIService()
export default productionAPI