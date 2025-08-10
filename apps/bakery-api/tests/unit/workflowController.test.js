const workflowController = require('../../controllers/workflowController');
const workflowParser = require('../../utils/workflowParser');
const logger = require('../../utils/logger');

// Mock dependencies
jest.mock('../../utils/workflowParser');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('Workflow Controller Unit Tests', () => {
  let req, res;
  
  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {}
    };
    
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    jest.clearAllMocks();
  });
  
  describe('listWorkflows', () => {
    it('should return all workflows successfully', async () => {
      const mockWorkflows = [
        { id: 'workflow1', name: 'Workflow 1', steps: 3 },
        { id: 'workflow2', name: 'Workflow 2', steps: 5 }
      ];
      
      workflowParser.getAllWorkflows.mockResolvedValue(mockWorkflows);
      
      await workflowController.listWorkflows(req, res);
      
      expect(workflowParser.getAllWorkflows).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Processing list workflows request...');
      expect(logger.info).toHaveBeenCalledWith('Retrieved 2 workflows');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: mockWorkflows
      });
    });
    
    it('should handle errors when listing workflows', async () => {
      const error = new Error('Database error');
      workflowParser.getAllWorkflows.mockRejectedValue(error);
      
      await workflowController.listWorkflows(req, res);
      
      expect(logger.error).toHaveBeenCalledWith('Workflow list retrieval error:', error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve workflows'
      });
    });
    
    it('should handle empty workflow list', async () => {
      workflowParser.getAllWorkflows.mockResolvedValue([]);
      
      await workflowController.listWorkflows(req, res);
      
      expect(logger.info).toHaveBeenCalledWith('Retrieved 0 workflows');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: []
      });
    });
  });
  
  describe('getWorkflow', () => {
    it('should return a specific workflow successfully', async () => {
      const mockWorkflow = {
        id: 'bread-workflow',
        name: 'Bread Workflow',
        steps: [
          { name: 'mixing', duration: '15m' },
          { name: 'proofing', duration: '2h' }
        ]
      };
      
      req.params.workflowId = 'bread-workflow';
      workflowParser.getWorkflowById.mockResolvedValue(mockWorkflow);
      
      await workflowController.getWorkflow(req, res);
      
      expect(workflowParser.getWorkflowById).toHaveBeenCalledWith('bread-workflow');
      expect(logger.info).toHaveBeenCalledWith('Processing get workflow request for ID: bread-workflow');
      expect(logger.info).toHaveBeenCalledWith('Workflow bread-workflow retrieved successfully');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockWorkflow
      });
    });
    
    it('should return 404 for non-existent workflow', async () => {
      req.params.workflowId = 'non-existent';
      workflowParser.getWorkflowById.mockResolvedValue(null);
      
      await workflowController.getWorkflow(req, res);
      
      expect(logger.warn).toHaveBeenCalledWith('Workflow not found: non-existent');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Workflow not found'
      });
    });
    
    it('should handle YAML parsing errors', async () => {
      const yamlError = new Error('YAML parse error');
      yamlError.name = 'YAMLException';
      
      req.params.workflowId = 'invalid-yaml';
      workflowParser.getWorkflowById.mockRejectedValue(yamlError);
      
      await workflowController.getWorkflow(req, res);
      
      expect(logger.error).toHaveBeenCalledWith('Error retrieving workflow invalid-yaml:', yamlError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid workflow file format'
      });
    });
    
    it('should handle general errors', async () => {
      const error = new Error('File system error');
      
      req.params.workflowId = 'workflow1';
      workflowParser.getWorkflowById.mockRejectedValue(error);
      
      await workflowController.getWorkflow(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve workflow'
      });
    });
  });
  
  describe('getCategories', () => {
    it('should return workflow categories successfully', async () => {
      const mockCategories = ['breads', 'cakes', 'pastries'];
      workflowParser.getWorkflowCategories.mockResolvedValue(mockCategories);
      
      await workflowController.getCategories(req, res);
      
      expect(workflowParser.getWorkflowCategories).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Processing get workflow categories request...');
      expect(logger.info).toHaveBeenCalledWith('Retrieved 3 workflow categories');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockCategories
      });
    });
    
    it('should handle errors when getting categories', async () => {
      const error = new Error('Category error');
      workflowParser.getWorkflowCategories.mockRejectedValue(error);
      
      await workflowController.getCategories(req, res);
      
      expect(logger.error).toHaveBeenCalledWith('Error retrieving workflow categories:', error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve workflow categories'
      });
    });
  });
  
  describe('validateWorkflow', () => {
    it('should validate a correct workflow', async () => {
      const workflow = {
        name: 'Test Workflow',
        steps: [{ name: 'Step 1' }]
      };
      
      req.body = workflow;
      workflowParser.validateWorkflow.mockReturnValue({
        valid: true,
        errors: []
      });
      
      await workflowController.validateWorkflow(req, res);
      
      expect(workflowParser.validateWorkflow).toHaveBeenCalledWith(workflow);
      expect(logger.info).toHaveBeenCalledWith('Workflow validation successful');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Workflow is valid'
      });
    });
    
    it('should return validation errors for invalid workflow', async () => {
      const workflow = {
        steps: []
      };
      const validationErrors = ['Workflow name is required'];
      
      req.body = workflow;
      workflowParser.validateWorkflow.mockReturnValue({
        valid: false,
        errors: validationErrors
      });
      
      await workflowController.validateWorkflow(req, res);
      
      expect(logger.warn).toHaveBeenCalledWith('Workflow validation failed:', validationErrors);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Workflow validation failed',
        errors: validationErrors
      });
    });
    
    it('should handle invalid request body', async () => {
      req.body = null;
      
      await workflowController.validateWorkflow(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid workflow data'
      });
    });
    
    it('should handle validation errors', async () => {
      const error = new Error('Validation error');
      req.body = { name: 'Test' };
      workflowParser.validateWorkflow.mockImplementation(() => {
        throw error;
      });
      
      await workflowController.validateWorkflow(req, res);
      
      expect(logger.error).toHaveBeenCalledWith('Error validating workflow:', error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to validate workflow'
      });
    });
  });
  
  describe('getWorkflowStats', () => {
    it('should calculate workflow statistics correctly', async () => {
      const mockWorkflows = [
        { id: 'w1', name: 'Workflow 1', steps: 3, version: '1.0' },
        { id: 'w2', name: 'Workflow 2', steps: 5, version: '1.0' },
        { id: 'w3', name: 'Workflow 3', steps: 2, version: '2.0' }
      ];
      
      workflowParser.getAllWorkflows.mockResolvedValue(mockWorkflows);
      
      await workflowController.getWorkflowStats(req, res);
      
      expect(logger.info).toHaveBeenCalledWith('Workflow statistics calculated successfully');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalWorkflows: 3,
          totalSteps: 10,
          averageStepsPerWorkflow: 3,
          workflowsByVersion: {
            '1.0': 2,
            '2.0': 1
          }
        }
      });
    });
    
    it('should handle empty workflow list for statistics', async () => {
      workflowParser.getAllWorkflows.mockResolvedValue([]);
      
      await workflowController.getWorkflowStats(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalWorkflows: 0,
          totalSteps: 0,
          averageStepsPerWorkflow: 0,
          workflowsByVersion: {}
        }
      });
    });
    
    it('should handle workflows without version', async () => {
      const mockWorkflows = [
        { id: 'w1', name: 'Workflow 1', steps: 3 },
        { id: 'w2', name: 'Workflow 2', steps: 5, version: '1.5' }
      ];
      
      workflowParser.getAllWorkflows.mockResolvedValue(mockWorkflows);
      
      await workflowController.getWorkflowStats(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalWorkflows: 2,
          totalSteps: 8,
          averageStepsPerWorkflow: 4,
          workflowsByVersion: {
            '1.0': 1,
            '1.5': 1
          }
        }
      });
    });
    
    it('should handle errors when calculating statistics', async () => {
      const error = new Error('Stats error');
      workflowParser.getAllWorkflows.mockRejectedValue(error);
      
      await workflowController.getWorkflowStats(req, res);
      
      expect(logger.error).toHaveBeenCalledWith('Error calculating workflow statistics:', error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to calculate workflow statistics'
      });
    });
  });
});