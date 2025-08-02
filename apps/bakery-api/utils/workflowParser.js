const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const logger = require('./logger');

// Path to workflow definitions
const WORKFLOWS_DIR = path.join(__dirname, '../bakery/processes');

/**
 * Parse a YAML workflow file
 * @param {string} filePath - Path to the YAML file
 * @returns {Promise<Object>} Parsed workflow object
 */
const parseWorkflowFile = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = yaml.load(content);
    
    // Extract workflow ID from filename
    const filename = path.basename(filePath, path.extname(filePath));
    
    return {
      id: filename,
      ...parsed
    };
  } catch (error) {
    logger.error(`Error parsing workflow file ${filePath}:`, error);
    throw error;
  }
};

/**
 * Get all workflow definitions
 * @returns {Promise<Array>} Array of workflow summaries
 */
const getAllWorkflows = async () => {
  try {
    // Ensure directory exists
    try {
      await fs.access(WORKFLOWS_DIR);
    } catch {
      logger.warn(`Workflows directory not found: ${WORKFLOWS_DIR}`);
      return [];
    }
    
    // Read directory contents
    const files = await fs.readdir(WORKFLOWS_DIR);
    
    // Filter for YAML files (exclude hidden files)
    const yamlFiles = files.filter(file => 
      (file.endsWith('.yaml') || file.endsWith('.yml')) && !file.startsWith('.')
    );
    
    // Parse each file and create summaries
    const workflows = [];
    for (const file of yamlFiles) {
      try {
        const filePath = path.join(WORKFLOWS_DIR, file);
        const workflow = await parseWorkflowFile(filePath);
        
        // Create summary
        workflows.push({
          id: workflow.id,
          name: workflow.name || workflow.id,
          version: String(workflow.version || '1.0'),
          description: workflow.description,
          steps: workflow.steps ? workflow.steps.length : 0
        });
      } catch (error) {
        logger.error(`Failed to parse workflow ${file}:`, error);
        // Continue with other files even if one fails
      }
    }
    
    // Sort by name
    workflows.sort((a, b) => a.name.localeCompare(b.name));
    
    return workflows;
  } catch (error) {
    logger.error('Error getting all workflows:', error);
    throw new Error('Failed to retrieve workflows');
  }
};

/**
 * Get a specific workflow by ID
 * @param {string} workflowId - The workflow ID (filename without extension)
 * @returns {Promise<Object|null>} Workflow object or null if not found
 */
const getWorkflowById = async (workflowId) => {
  try {
    // Sanitize ID to prevent directory traversal
    const safeId = path.basename(workflowId);
    
    // Try both .yaml and .yml extensions
    const extensions = ['.yaml', '.yml'];
    
    for (const ext of extensions) {
      const filePath = path.join(WORKFLOWS_DIR, safeId + ext);
      
      try {
        await fs.access(filePath);
        const workflow = await parseWorkflowFile(filePath);
        
        // Process steps to ensure consistent structure
        if (workflow.steps && Array.isArray(workflow.steps)) {
          workflow.steps = workflow.steps.map((step, index) => ({
            id: step.id || `step-${index + 1}`,
            name: step.name,
            type: step.type || 'active',
            timeout: step.timeout,
            duration: step.duration,
            activities: step.activities || [],
            conditions: step.conditions || [],
            location: step.location,
            notes: step.notes,
            repeat: step.repeat,
            params: step.params || {}
          }));
        }
        
        return workflow;
      } catch (error) {
        // File doesn't exist with this extension, try next
        continue;
      }
    }
    
    // No file found with any extension
    logger.warn(`Workflow not found: ${workflowId}`);
    return null;
  } catch (error) {
    logger.error(`Error getting workflow ${workflowId}:`, error);
    throw new Error('Failed to retrieve workflow');
  }
};

/**
 * Validate a workflow object structure
 * @param {Object} workflow - Workflow object to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
const validateWorkflow = (workflow) => {
  const errors = [];
  
  // Required fields
  if (!workflow.name) {
    errors.push('Workflow name is required');
  }
  
  if (!workflow.steps || !Array.isArray(workflow.steps)) {
    errors.push('Workflow must have a steps array');
  } else {
    // Validate each step
    workflow.steps.forEach((step, index) => {
      if (!step.name) {
        errors.push(`Step ${index + 1} must have a name`);
      }
      
      // Type-specific validation
      if (step.type === 'sleep' && !step.duration) {
        errors.push(`Sleep step "${step.name || index}" must have a duration`);
      }
      
      if (step.activities && !Array.isArray(step.activities)) {
        errors.push(`Step "${step.name || index}" activities must be an array`);
      }
      
      if (step.conditions && !Array.isArray(step.conditions)) {
        errors.push(`Step "${step.name || index}" conditions must be an array`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Get workflow categories based on directory structure
 * @returns {Promise<Array>} Array of category names
 */
const getWorkflowCategories = async () => {
  try {
    const workflows = await getAllWorkflows();
    
    // Extract categories from workflow names or IDs
    const categories = new Set();
    
    workflows.forEach(workflow => {
      // Simple categorization based on workflow ID patterns
      if (workflow.id.includes('bread') || workflow.id.includes('sourdough')) {
        categories.add('breads');
      } else if (workflow.id.includes('cake') || workflow.id.includes('torte')) {
        categories.add('cakes');
      } else if (workflow.id.includes('croissant') || workflow.id.includes('pastry')) {
        categories.add('pastries');
      } else {
        categories.add('other');
      }
    });
    
    return Array.from(categories).sort();
  } catch (error) {
    logger.error('Error getting workflow categories:', error);
    throw error;
  }
};

module.exports = {
  getAllWorkflows,
  getWorkflowById,
  validateWorkflow,
  getWorkflowCategories,
  parseWorkflowFile
};