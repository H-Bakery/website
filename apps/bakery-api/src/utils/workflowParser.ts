export interface WorkflowStep {
  name: string
  type?: string
  timeout?: string
  duration?: string
  activities?: string[]
  conditions?: any[]
  params?: any
  notes?: string
  location?: string
  repeat?: number
  equipment?: string[]
}

export interface Workflow {
  id: string
  name: string
  steps: WorkflowStep[]
  equipment?: string[]
  description?: string
  category?: string
}

class WorkflowParser {
  private workflows: Map<string, Workflow> = new Map()

  constructor() {
    // Initialize with some default workflows
    this.initializeDefaultWorkflows()
  }

  private initializeDefaultWorkflows(): void {
    // Example workflow data - in production this would come from a database or configuration
    const defaultWorkflows: Workflow[] = [
      {
        id: 'bread-standard',
        name: 'Standard Bread Production',
        description: 'Standard workflow for bread production',
        category: 'bread',
        equipment: ['mixer', 'oven', 'proofer'],
        steps: [
          {
            name: 'Mixing',
            type: 'active',
            duration: '20min',
            equipment: ['mixer'],
            activities: ['Add ingredients', 'Mix dough'],
            params: {
              temperature: 24,
              speed: 'medium'
            }
          },
          {
            name: 'First Proofing',
            type: 'passive',
            duration: '90min',
            equipment: ['proofer'],
            activities: ['Rest dough'],
            params: {
              temperature: 28,
              humidity: 75
            }
          },
          {
            name: 'Shaping',
            type: 'active',
            duration: '15min',
            activities: ['Shape loaves'],
            params: {}
          },
          {
            name: 'Second Proofing',
            type: 'passive',
            duration: '60min',
            equipment: ['proofer'],
            activities: ['Final proof'],
            params: {
              temperature: 30,
              humidity: 80
            }
          },
          {
            name: 'Baking',
            type: 'active',
            duration: '45min',
            equipment: ['oven'],
            activities: ['Bake bread'],
            params: {
              temperature: 220,
              steam: true
            }
          },
          {
            name: 'Cooling',
            type: 'passive',
            duration: '30min',
            activities: ['Cool on racks'],
            params: {}
          }
        ]
      },
      {
        id: 'pastry-croissant',
        name: 'Croissant Production',
        description: 'Workflow for croissant production',
        category: 'pastry',
        equipment: ['mixer', 'sheeter', 'proofer', 'oven'],
        steps: [
          {
            name: 'Dough Preparation',
            type: 'active',
            duration: '30min',
            equipment: ['mixer'],
            activities: ['Mix dough'],
            params: {
              temperature: 18
            }
          },
          {
            name: 'Lamination',
            type: 'active',
            duration: '60min',
            equipment: ['sheeter'],
            activities: ['Add butter', 'Fold and roll'],
            repeat: 3,
            params: {
              folds: 3
            }
          },
          {
            name: 'Resting',
            type: 'passive',
            duration: '120min',
            activities: ['Refrigerate'],
            params: {
              temperature: 4
            }
          },
          {
            name: 'Shaping',
            type: 'active',
            duration: '20min',
            activities: ['Cut and shape'],
            params: {}
          },
          {
            name: 'Proofing',
            type: 'passive',
            duration: '120min',
            equipment: ['proofer'],
            activities: ['Proof'],
            params: {
              temperature: 27,
              humidity: 75
            }
          },
          {
            name: 'Baking',
            type: 'active',
            duration: '20min',
            equipment: ['oven'],
            activities: ['Apply egg wash', 'Bake'],
            params: {
              temperature: 190
            }
          }
        ]
      }
    ]

    defaultWorkflows.forEach(workflow => {
      this.workflows.set(workflow.id, workflow)
    })
  }

  async getWorkflowById(workflowId: string): Promise<Workflow | undefined> {
    return this.workflows.get(workflowId)
  }

  async getAllWorkflows(): Promise<Workflow[]> {
    return Array.from(this.workflows.values())
  }

  async getWorkflowsByCategory(category: string): Promise<Workflow[]> {
    return Array.from(this.workflows.values()).filter(
      workflow => workflow.category === category
    )
  }

  async addWorkflow(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.id, workflow)
  }

  async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<void> {
    const existing = this.workflows.get(workflowId)
    if (existing) {
      this.workflows.set(workflowId, { ...existing, ...updates })
    }
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    this.workflows.delete(workflowId)
  }

  calculateWorkflowDuration(workflow: Workflow): number {
    if (!workflow.steps) return 60 // Default 1 hour

    return workflow.steps.reduce((total, step) => {
      const duration = step.timeout || step.duration || '30min'
      return total + this.parseDuration(duration)
    }, 0)
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/(\d+)(min|h|hour|hours)?/)
    if (!match) return 30

    const value = parseInt(match[1])
    const unit = match[2] || 'min'

    return unit.startsWith('h') ? value * 60 : value
  }
}

export default new WorkflowParser()