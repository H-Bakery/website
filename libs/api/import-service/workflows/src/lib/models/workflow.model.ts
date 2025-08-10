export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  estimatedTime: number; // in minutes
  required: boolean;
  dependencies?: string[];
  tools?: string[];
  notes?: string;
}

export interface WorkflowMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author?: string;
  created: Date;
  lastModified: Date;
  tags?: string[];
}

export interface Workflow extends WorkflowMetadata {
  steps: WorkflowStep[];
  totalEstimatedTime: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites?: string[];
  equipment?: string[];
  materials?: string[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: number;
  estimatedTime: number;
  difficulty: string;
  version: string;
}

export interface WorkflowStatistics {
  totalWorkflows: number;
  totalSteps: number;
  averageStepsPerWorkflow: number;
  workflowsByVersion: Record<string, number>;
  categoriesCount: Record<string, number>;
  difficultyDistribution: Record<string, number>;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface WorkflowExecutionContext {
  workflowId: string;
  userId: string;
  startTime: Date;
  currentStep: number;
  completedSteps: string[];
  notes: Record<string, string>;
  status: 'not_started' | 'in_progress' | 'completed' | 'paused' | 'failed';
}