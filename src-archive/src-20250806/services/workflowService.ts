import { Workflow, WorkflowStep } from '../types/workflow'

export const getWorkflows = async (): Promise<Workflow[]> => {
  // In a real app, this would be a fetch call to your API
  // return fetch('/api/workflows').then(res => res.json());

  // Mock data for demonstration
  return [
    {
      id: 'wf-001',
      name: 'croissant_production',
      version: '1.2',
      product: 'Butter Croissants',
      startTime: new Date(new Date().getTime() - 3600000), // 1 hour ago
      estimatedEndTime: new Date(new Date().getTime() + 7200000), // 2 hours from now
      status: 'in-progress',
      batchSize: 48,
      assignedTo: 'Franz Müller',
      steps: [
        {
          id: 'step-001',
          name: 'teig_vorbereiten',
          type: 'manual',
          status: 'completed',
          progress: 100,
          activities: [
            { name: 'mixen', completed: true },
            { name: 'kneten', completed: true },
            { name: 'buttereinschlagen', completed: true },
          ],
          notes: 'Kühlen Sie die Butter auf 8°C herunter',
          startTime: new Date(new Date().getTime() - 3600000),
          endTime: new Date(new Date().getTime() - 3000000),
        },
        {
          id: 'step-002',
          name: 'erste_gehzeit',
          type: 'sleep',
          duration: '2h',
          status: 'completed',
          progress: 100,
          location: 'Kühlraum',
          conditions: { 'temp > 22°C': '1.5h', 'temp < 18°C': '2.5h' },
          startTime: new Date(new Date().getTime() - 3000000),
          endTime: new Date(new Date().getTime() - 1800000),
        },
        {
          id: 'step-003',
          name: 'laminieren',
          type: 'manual',
          status: 'in-progress',
          progress: 65,
          activities: [
            { name: 'ausrollen', completed: true },
            { name: 'falten', completed: true },
            { name: 'kühlen', completed: false },
          ],
          notes: 'Nach jedem Durchgang 20 Minuten kühlen',
          startTime: new Date(new Date().getTime() - 1800000),
        },
        {
          id: 'step-004',
          name: 'zweite_gehzeit',
          type: 'sleep',
          duration: '1h',
          status: 'pending',
          progress: 0,
          location: 'Kühlraum',
        },
        {
          id: 'step-005',
          name: 'formen',
          type: 'manual',
          status: 'pending',
          progress: 0,
          activities: [
            { name: 'ausrollen', completed: false },
            { name: 'schneiden', completed: false },
            { name: 'rollen', completed: false },
          ],
        },
        {
          id: 'step-006',
          name: 'final_proofing',
          type: 'sleep',
          duration: '1.5h',
          status: 'pending',
          progress: 0,
          conditions: { 'temp > 25°C': '1h' },
        },
        {
          id: 'step-007',
          name: 'backen',
          type: 'manual',
          status: 'pending',
          progress: 0,
          notes: 'Vorher mit Ei bestreichen',
          params: { temp: '190°C' },
        },
      ],
    },
    {
      id: 'wf-002',
      name: 'sourdough_bread',
      version: '1.0',
      product: 'Sauerteigbrot',
      startTime: new Date(new Date().getTime() - 28800000), // 8 hours ago
      estimatedEndTime: new Date(new Date().getTime() + 21600000), // 6 hours from now
      status: 'in-progress',
      batchSize: 12,
      assignedTo: 'Maria Schmidt',
      steps: [
        {
          id: 'step-101',
          name: 'starter_füttern',
          type: 'manual',
          status: 'completed',
          progress: 100,
          activities: [{ name: 'mischen', completed: true }],
          notes: 'Sauerteig im Verhältnis 1:1:1 (Starter:Mehl:Wasser) füttern',
          startTime: new Date(new Date().getTime() - 28800000),
          endTime: new Date(new Date().getTime() - 28200000),
        },
        {
          id: 'step-102',
          name: 'starter_reifen',
          type: 'sleep',
          duration: '8h',
          status: 'completed',
          progress: 100,
          conditions: { 'temp < 20°C': '10h' },
          notes: 'Starter sollte sich verdoppeln',
          startTime: new Date(new Date().getTime() - 28200000),
          endTime: new Date(new Date().getTime() - 10800000),
        },
        {
          id: 'step-103',
          name: 'teig_mischen',
          type: 'manual',
          status: 'completed',
          progress: 100,
          activities: [
            { name: 'mehl_wiegen', completed: true },
            { name: 'wasser_zugeben', completed: true },
            { name: 'salz_zugeben', completed: true },
            { name: 'mischen', completed: true },
          ],
          startTime: new Date(new Date().getTime() - 10800000),
          endTime: new Date(new Date().getTime() - 10500000),
        },
        {
          id: 'step-104',
          name: 'autolyse',
          type: 'sleep',
          duration: '1h',
          status: 'completed',
          progress: 100,
          startTime: new Date(new Date().getTime() - 10500000),
          endTime: new Date(new Date().getTime() - 6900000),
        },
        {
          id: 'step-105',
          name: 'kneten_und_falten',
          type: 'manual',
          status: 'completed',
          progress: 100,
          activities: [
            { name: 'kneten', completed: true },
            { name: 'stretch_and_fold', completed: true },
          ],
          startTime: new Date(new Date().getTime() - 6900000),
          endTime: new Date(new Date().getTime() - 6600000),
        },
        {
          id: 'step-106',
          name: 'erste_gehzeit',
          type: 'sleep',
          duration: '4h',
          status: 'in-progress',
          progress: 40,
          conditions: { 'temp > 26°C': '3h' },
          startTime: new Date(new Date().getTime() - 6600000),
        },
      ],
    },
    {
      id: 'wf-003',
      name: 'croissant_production',
      version: '1.2',
      product: 'Schokoladen Croissants',
      startTime: new Date(new Date().getTime() + 3600000), // 1 hour in future
      estimatedEndTime: new Date(new Date().getTime() + 14400000), // 4 hours in future
      status: 'planned',
      batchSize: 36,
      assignedTo: 'Lisa Wagner',
      steps: [
        {
          id: 'step-001',
          name: 'teig_vorbereiten',
          type: 'manual',
          status: 'pending',
          progress: 0,
          activities: [
            { name: 'mixen', completed: false },
            { name: 'kneten', completed: false },
            { name: 'buttereinschlagen', completed: false },
          ],
          notes: 'Kühlen Sie die Butter auf 8°C herunter',
        },
        // Same steps as croissant but status "pending"
        {
          id: 'step-002',
          name: 'erste_gehzeit',
          type: 'sleep',
          duration: '2h',
          status: 'pending',
          progress: 0,
          location: 'Kühlraum',
          conditions: { 'temp > 22°C': '1.5h', 'temp < 18°C': '2.5h' },
        },
        // More pending steps...
      ],
    },
  ]
}

export const updateWorkflowStep = async (
  workflowId: string,
  stepId: string,
  updates: Partial<WorkflowStep>
): Promise<Workflow> => {
  // In a real app, this would be a PUT request
  // return fetch(`/api/workflows/${workflowId}/steps/${stepId}`, {
  //   method: 'PUT',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(updates)
  // }).then(res => res.json());

  // For this demo, we'll simulate the API call
  const workflows = await getWorkflows()
  const workflow = workflows.find((w) => w.id === workflowId)

  if (!workflow) {
    throw new Error('Workflow not found')
  }

  const updatedWorkflow = {
    ...workflow,
    steps: workflow.steps.map((step) =>
      step.id === stepId ? { ...step, ...updates } : step
    ),
  }

  // Update the workflow status based on steps
  const allStepsCompleted = updatedWorkflow.steps.every(
    (step) => step.status === 'completed'
  )
  const anyStepInProgress = updatedWorkflow.steps.some(
    (step) => step.status === 'in-progress'
  )

  if (allStepsCompleted) {
    updatedWorkflow.status = 'completed' as Workflow['status']
  } else if (anyStepInProgress) {
    updatedWorkflow.status = 'in-progress' as Workflow['status']
  }

  return updatedWorkflow
}

export const startWorkflow = async (workflowId: string): Promise<Workflow> => {
  // Similar implementation to updateWorkflowStep
  const workflows = await getWorkflows()
  const workflow = workflows.find((w) => w.id === workflowId)

  if (!workflow) {
    throw new Error('Workflow not found')
  }

  const updatedWorkflow = {
    ...workflow,
    status: 'in-progress' as Workflow['status'],
    startTime: new Date(),
    steps: workflow.steps.map((step, index) =>
      index === 0
        ? {
            ...step,
            status: 'in-progress' as WorkflowStep['status'],
            progress: 0,
            startTime: new Date(),
          }
        : step
    ),
  }

  return updatedWorkflow
}

export const pauseWorkflow = async (workflowId: string): Promise<Workflow> => {
  // Implementation similar to above
  const workflows = await getWorkflows()
  const workflow = workflows.find((w) => w.id === workflowId)

  if (!workflow) {
    throw new Error('Workflow not found')
  }

  return {
    ...workflow,
    status: 'paused' as Workflow['status'],
  }
}
