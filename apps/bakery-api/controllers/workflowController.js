const workflowParser = require('../utils/workflowParser');
const logger = require('../utils/logger');

/**
 * Get all workflows
 * @route GET /api/workflows
 */
exports.listWorkflows = async (req, res) => {
  logger.info('Processing list workflows request...');
  
  try {
    const workflows = await workflowParser.getAllWorkflows();
    
    logger.info(`Retrieved ${workflows.length} workflows`);
    res.json({
      success: true,
      count: workflows.length,
      data: workflows
    });
  } catch (error) {
    logger.error('Workflow list retrieval error:', error);
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
exports.getWorkflow = async (req, res) => {
  const { workflowId } = req.params;
  logger.info(`Processing get workflow request for ID: ${workflowId}`);
  
  try {
    const workflow = await workflowParser.getWorkflowById(workflowId);
    
    if (!workflow) {
      logger.warn(`Workflow not found: ${workflowId}`);
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }
    
    logger.info(`Workflow ${workflowId} retrieved successfully`);
    res.json({
      success: true,
      data: workflow
    });
  } catch (error) {
    logger.error(`Error retrieving workflow ${workflowId}:`, error);
    
    // Check if error is due to invalid YAML
    if (error.name === 'YAMLException') {
      return res.status(500).json({
        success: false,
        error: 'Invalid workflow file format'
      });
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
exports.getCategories = async (req, res) => {
  logger.info('Processing get workflow categories request...');
  
  try {
    const categories = await workflowParser.getWorkflowCategories();
    
    logger.info(`Retrieved ${categories.length} workflow categories`);
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('Error retrieving workflow categories:', error);
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
exports.validateWorkflow = async (req, res) => {
  logger.info('Processing workflow validation request...');
  
  try {
    const workflow = req.body;
    
    if (!workflow || typeof workflow !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow data'
      });
    }
    
    const validation = workflowParser.validateWorkflow(workflow);
    
    if (validation.valid) {
      logger.info('Workflow validation successful');
      res.json({
        success: true,
        message: 'Workflow is valid'
      });
    } else {
      logger.warn('Workflow validation failed:', validation.errors);
      res.status(400).json({
        success: false,
        error: 'Workflow validation failed',
        errors: validation.errors
      });
    }
  } catch (error) {
    logger.error('Error validating workflow:', error);
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
exports.getWorkflowStats = async (req, res) => {
  logger.info('Processing get workflow statistics request...');
  
  try {
    const workflows = await workflowParser.getAllWorkflows();
    
    // Calculate statistics
    const stats = {
      totalWorkflows: workflows.length,
      totalSteps: workflows.reduce((sum, w) => sum + w.steps, 0),
      averageStepsPerWorkflow: workflows.length > 0 
        ? Math.round(workflows.reduce((sum, w) => sum + w.steps, 0) / workflows.length)
        : 0,
      workflowsByVersion: {}
    };
    
    // Group by version
    workflows.forEach(workflow => {
      const version = workflow.version || '1.0';
      stats.workflowsByVersion[version] = (stats.workflowsByVersion[version] || 0) + 1;
    });
    
    logger.info('Workflow statistics calculated successfully');
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error calculating workflow statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate workflow statistics'
    });
  }
};