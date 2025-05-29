export interface WorkflowActivity {
  name: string
  completed: boolean
}

export interface WorkflowStep {
  id: string
  name: string
  type: string
  duration?: string
  startTime?: Date
  endTime?: Date
  status: 'pending' | 'in-progress' | 'completed' | 'paused' | 'error'
  progress: number
  activities?: WorkflowActivity[]
  notes?: string
  location?: string
  conditions?: Record<string, string>
  params?: Record<string, string | number | boolean>
}

export interface Workflow {
  id: string
  name: string
  version: string
  product: string
  startTime: Date
  estimatedEndTime: Date
  status: 'in-progress' | 'completed' | 'paused' | 'planned'
  steps: WorkflowStep[]
  batchSize: number
  assignedTo: string
}
