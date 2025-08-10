import { Request, Response } from 'express';
import { WorkflowService } from '../services/workflow.service';

export class WorkflowController {
  private workflowService: WorkflowService;

  constructor() {
    this.workflowService = new WorkflowService();
  }

  /**
   * Get all workflows
   * @route GET /api/workflows
   */
  listWorkflows = async (req: Request, res: Response): Promise<void> => {
    console.log('Processing list workflows request...');
    
    try {
      const workflows = await this.workflowService.getAllWorkflows();
      
      console.log(`Retrieved ${workflows.length} workflows`);
      res.json({
        success: true,
        count: workflows.length,
        data: workflows
      });
    } catch (error) {
      console.error('Workflow list retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve workflows'
      });
    }
  };

  /**
   * Get a specific workflow by ID
   * @route GET /api/workflows/:workflowId
   */
  getWorkflow = async (req: Request, res: Response): Promise<void> => {
    const { workflowId } = req.params;
    console.log(`Processing get workflow request for ID: ${workflowId}`);
    
    try {
      const workflow = await this.workflowService.getWorkflowById(workflowId);
      
      if (!workflow) {
        console.warn(`Workflow not found: ${workflowId}`);
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }
      
      console.log(`Workflow ${workflowId} retrieved successfully`);
      res.json({
        success: true,
        data: workflow
      });
    } catch (error) {
      console.error(`Error retrieving workflow ${workflowId}:`, error);
      
      // Check if error is due to invalid YAML
      if (error instanceof Error && error.name === 'YAMLException') {
        res.status(500).json({
          success: false,
          error: 'Invalid workflow file format'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve workflow'
      });
    }
  };

  /**
   * Get workflow categories
   * @route GET /api/workflows/categories
   */
  getCategories = async (req: Request, res: Response): Promise<void> => {
    console.log('Processing get workflow categories request...');
    
    try {
      const categories = await this.workflowService.getWorkflowCategories();
      
      console.log(`Retrieved ${categories.length} workflow categories`);
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error retrieving workflow categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve workflow categories'
      });
    }
  };

  /**
   * Validate a workflow structure
   * @route POST /api/workflows/validate
   */
  validateWorkflow = async (req: Request, res: Response): Promise<void> => {
    console.log('Processing workflow validation request...');
    
    try {
      const workflow = req.body;
      
      if (!workflow || typeof workflow !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Invalid workflow data'
        });
        return;
      }
      
      const validation = this.workflowService.validateWorkflow(workflow);
      
      if (validation.valid) {
        console.log('Workflow validation successful');
        res.json({
          success: true,
          message: 'Workflow is valid',
          warnings: validation.warnings
        });
      } else {
        console.warn('Workflow validation failed:', validation.errors);
        res.status(400).json({
          success: false,
          error: 'Workflow validation failed',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }
    } catch (error) {
      console.error('Error validating workflow:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate workflow'
      });
    }
  };

  /**
   * Get workflow statistics
   * @route GET /api/workflows/stats
   */
  getWorkflowStats = async (req: Request, res: Response): Promise<void> => {
    console.log('Processing get workflow statistics request...');
    
    try {
      const stats = await this.workflowService.getWorkflowStatistics();
      
      console.log('Workflow statistics calculated successfully');
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error calculating workflow statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate workflow statistics'
      });
    }
  };
}

// Create and export controller instance
export const workflowController = new WorkflowController();