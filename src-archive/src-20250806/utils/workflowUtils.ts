import { Workflow } from '../types/workflow'
import { format } from 'date-fns'

export const calculateProgress = (workflow: Workflow): number => {
  const totalSteps = workflow.steps.length
  const completedSteps = workflow.steps.filter(
    (step) => step.status === 'completed'
  ).length
  const inProgressStep = workflow.steps.find(
    (step) => step.status === 'in-progress'
  )

  let progress = (completedSteps / totalSteps) * 100
  if (inProgressStep) {
    progress += (inProgressStep.progress / 100) * (1 / totalSteps) * 100
  }

  return Math.round(progress)
}

export const getTimeRemaining = (workflow: Workflow): string => {
  const now = new Date()
  const diff = workflow.estimatedEndTime.getTime() - now.getTime()

  if (diff <= 0) {
    return 'Fällig'
  }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

export const getStatusColor = (
  status: string
): 'success' | 'primary' | 'warning' | 'info' | 'default' => {
  switch (status) {
    case 'completed':
      return 'success'
    case 'in-progress':
      return 'primary'
    case 'paused':
      return 'warning'
    case 'planned':
      return 'info'
    default:
      return 'default'
  }
}

// Parse workflow definition language from YAML
export const parseWorkflowDefinition = (yaml: string): any => {
  // In a real app, you would use a library like js-yaml
  // This is a simple placeholder
  return { parsed: true, yaml }
}

// Generate workflow execution plan from workflow definition
export const generateWorkflowPlan = (
  definition: any,
  startTime: Date = new Date()
): Workflow => {
  // This would generate a new workflow from a definition
  // Simplified placeholder implementation
  return {
    id: `wf-${Date.now()}`,
    name: definition.name || 'new_workflow',
    version: definition.version || '1.0',
    product: 'New Product',
    startTime,
    estimatedEndTime: new Date(startTime.getTime() + 3600000), // +1 hour placeholder
    status: 'planned',
    batchSize: 0,
    assignedTo: '',
    steps: [],
  }
}

export const formatDate = (
  date: Date | string | undefined,
  formatStr: string = 'dd MMM yyyy HH:mm'
): string => {
  if (!date) return 'n/a'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return format(dateObj, formatStr)
  } catch (error) {
    console.error('Error formatting date:', error)
    return String(date)
  }
}
