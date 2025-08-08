import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { 
  Workflow, 
  WorkflowSummary, 
  WorkflowValidationResult,
  WorkflowStatistics
} from '../models/workflow.model';

export class WorkflowService {
  private readonly workflowsDir: string;

  constructor() {
    // Path to workflow definitions - use the same path as legacy system
    this.workflowsDir = path.join(process.cwd(), 'apps/bakery-api/bakery/processes');
  }

  /**
   * Parse a YAML workflow file
   */
  private async parseWorkflowFile(filePath: string): Promise<Workflow> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = yaml.load(content) as any;
      
      // Extract workflow ID from filename
      const filename = path.basename(filePath, path.extname(filePath));
      
      return {
        id: filename,
        name: parsed.name || filename,
        description: parsed.description || '',
        category: this.extractCategory(filename),
        version: String(parsed.version || '1.0'),
        author: parsed.author,
        created: parsed.created ? new Date(parsed.created) : new Date(),
        lastModified: parsed.lastModified ? new Date(parsed.lastModified) : new Date(),
        tags: parsed.tags || [],
        steps: parsed.steps || [],
        totalEstimatedTime: this.calculateTotalTime(parsed.steps || []),
        difficulty: parsed.difficulty || 'intermediate',
        prerequisites: parsed.prerequisites || [],
        equipment: parsed.equipment || [],
        materials: parsed.materials || []
      };
    } catch (error) {
      throw new Error(`Error parsing workflow file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract category from workflow filename/ID
   */
  private extractCategory(id: string): string {
    if (id.includes('bread') || id.includes('sourdough')) {
      return 'breads';
    } else if (id.includes('cake') || id.includes('torte')) {
      return 'cakes';
    } else if (id.includes('croissant') || id.includes('pastry')) {
      return 'pastries';
    } else if (id.includes('filling')) {
      return 'fillings';
    } else if (id.includes('production')) {
      return 'production';
    }
    return 'other';
  }

  /**
   * Calculate total estimated time for a workflow
   */
  private calculateTotalTime(steps: any[]): number {
    return steps.reduce((total, step) => {
      if (step.duration && typeof step.duration === 'number') {
        return total + step.duration;
      }
      if (step.estimatedTime && typeof step.estimatedTime === 'number') {
        return total + step.estimatedTime;
      }
      return total + 15; // Default 15 minutes per step
    }, 0);
  }

  /**
   * Get all workflow summaries
   */
  async getAllWorkflows(): Promise<WorkflowSummary[]> {
    try {
      // Check if directory exists
      try {
        await fs.access(this.workflowsDir);
      } catch {
        console.warn(`Workflows directory not found: ${this.workflowsDir}`);
        return [];
      }
      
      // Read directory contents
      const files = await fs.readdir(this.workflowsDir);
      
      // Filter for YAML files (exclude hidden files)
      const yamlFiles = files.filter(file => 
        (file.endsWith('.yaml') || file.endsWith('.yml')) && !file.startsWith('.')
      );
      
      // Parse each file and create summaries
      const workflows: WorkflowSummary[] = [];
      for (const file of yamlFiles) {
        try {
          const filePath = path.join(this.workflowsDir, file);
          const workflow = await this.parseWorkflowFile(filePath);
          
          // Create summary
          workflows.push({
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            category: workflow.category,
            steps: workflow.steps.length,
            estimatedTime: workflow.totalEstimatedTime,
            difficulty: workflow.difficulty,
            version: workflow.version
          });
        } catch (error) {
          console.error(`Failed to parse workflow ${file}:`, error);
          // Continue with other files even if one fails
        }
      }
      
      // Sort by name
      workflows.sort((a, b) => a.name.localeCompare(b.name));
      
      return workflows;
    } catch (error) {
      throw new Error(`Failed to retrieve workflows: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a specific workflow by ID
   */
  async getWorkflowById(workflowId: string): Promise<Workflow | null> {
    try {
      // Sanitize ID to prevent directory traversal
      const safeId = path.basename(workflowId);
      
      // Try both .yaml and .yml extensions
      const extensions = ['.yaml', '.yml'];
      
      for (const ext of extensions) {
        const filePath = path.join(this.workflowsDir, safeId + ext);
        
        try {
          await fs.access(filePath);
          const workflow = await this.parseWorkflowFile(filePath);
          
          // Process steps to ensure consistent structure
          if (workflow.steps && Array.isArray(workflow.steps)) {
            workflow.steps = workflow.steps.map((step: any, index: number) => ({
              id: step.id || `step-${index + 1}`,
              name: step.name,
              description: step.description || '',
              estimatedTime: step.duration || step.estimatedTime || 15,
              required: step.required !== false,
              dependencies: step.dependencies || [],
              tools: step.tools || step.equipment || [],
              notes: step.notes || step.comments || ''
            }));
          }
          
          return workflow;
        } catch (error) {
          // File doesn't exist with this extension, try next
          continue;
        }
      }
      
      // No file found with any extension
      console.warn(`Workflow not found: ${workflowId}`);
      return null;
    } catch (error) {
      throw new Error(`Failed to retrieve workflow ${workflowId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate a workflow object structure
   */
  validateWorkflow(workflow: any): WorkflowValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!workflow.name) {
      errors.push('Workflow name is required');
    }
    
    if (!workflow.steps || !Array.isArray(workflow.steps)) {
      errors.push('Workflow must have a steps array');
    } else {
      // Validate each step
      workflow.steps.forEach((step: any, index: number) => {
        if (!step.name) {
          errors.push(`Step ${index + 1} must have a name`);
        }
        
        // Warn about missing descriptions
        if (!step.description) {
          warnings.push(`Step "${step.name || index + 1}" missing description`);
        }
        
        // Validate dependencies
        if (step.dependencies && !Array.isArray(step.dependencies)) {
          errors.push(`Step "${step.name || index + 1}" dependencies must be an array`);
        }
        
        // Validate estimated time
        if (step.estimatedTime && typeof step.estimatedTime !== 'number') {
          errors.push(`Step "${step.name || index + 1}" estimatedTime must be a number`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get workflow categories
   */
  async getWorkflowCategories(): Promise<string[]> {
    try {
      const workflows = await this.getAllWorkflows();
      
      // Extract unique categories
      const categories = new Set<string>();
      workflows.forEach(workflow => {
        categories.add(workflow.category);
      });
      
      return Array.from(categories).sort();
    } catch (error) {
      throw new Error(`Failed to get workflow categories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStatistics(): Promise<WorkflowStatistics> {
    try {
      const workflows = await this.getAllWorkflows();
      
      const stats: WorkflowStatistics = {
        totalWorkflows: workflows.length,
        totalSteps: workflows.reduce((sum, w) => sum + w.steps, 0),
        averageStepsPerWorkflow: workflows.length > 0 
          ? Math.round(workflows.reduce((sum, w) => sum + w.steps, 0) / workflows.length)
          : 0,
        workflowsByVersion: {},
        categoriesCount: {},
        difficultyDistribution: {}
      };
      
      // Group by version, category, and difficulty
      workflows.forEach(workflow => {
        // Version distribution
        const version = workflow.version || '1.0';
        stats.workflowsByVersion[version] = (stats.workflowsByVersion[version] || 0) + 1;
        
        // Category distribution
        stats.categoriesCount[workflow.category] = (stats.categoriesCount[workflow.category] || 0) + 1;
        
        // Difficulty distribution
        stats.difficultyDistribution[workflow.difficulty] = (stats.difficultyDistribution[workflow.difficulty] || 0) + 1;
      });
      
      return stats;
    } catch (error) {
      throw new Error(`Failed to calculate workflow statistics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}