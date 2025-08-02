const mockFs = require('mock-fs');
const path = require('path');
const workflowParser = require('../../utils/workflowParser');

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('Workflow Parser Unit Tests', () => {
  const workflowsPath = path.join(__dirname, '../../bakery/processes');
  
  afterEach(() => {
    mockFs.restore();
    jest.clearAllMocks();
  });
  
  describe('getAllWorkflows', () => {
    it('should return all workflows from directory', async () => {
      mockFs({
        [workflowsPath]: {
          'bread-workflow.yaml': `
name: Bread Baking Workflow
version: 1.0
description: Standard bread baking process
steps:
  - name: mixing
    duration: 15m
  - name: proofing
    duration: 1h
  - name: baking
    duration: 45m`,
          'cake-workflow.yml': `
name: Cake Production
version: 1.1
steps:
  - name: prepare
    duration: 30m`,
          'not-yaml.txt': 'Should be ignored',
          '.hidden.yaml': 'Should be ignored'
        }
      });
      
      const workflows = await workflowParser.getAllWorkflows();
      
      expect(workflows).toHaveLength(2);
      expect(workflows[0]).toEqual({
        id: 'bread-workflow',
        name: 'Bread Baking Workflow',
        version: '1',
        description: 'Standard bread baking process',
        steps: 3
      });
      expect(workflows[1]).toEqual({
        id: 'cake-workflow',
        name: 'Cake Production',
        version: '1.1',
        description: undefined,
        steps: 1
      });
    });
    
    it('should return empty array when directory does not exist', async () => {
      mockFs({});
      
      const workflows = await workflowParser.getAllWorkflows();
      
      expect(workflows).toEqual([]);
    });
    
    it('should handle invalid YAML files gracefully', async () => {
      mockFs({
        [workflowsPath]: {
          'valid.yaml': `
name: Valid Workflow
steps:
  - name: step1`,
          'invalid.yaml': `
invalid: yaml: content: here
  bad indentation
    :::`,
          'another-valid.yaml': `
name: Another Valid
steps:
  - name: step2`
        }
      });
      
      const workflows = await workflowParser.getAllWorkflows();
      
      expect(workflows).toHaveLength(2);
      expect(workflows.map(w => w.name).sort()).toEqual(['Another Valid', 'Valid Workflow']);
    });
    
    it('should sort workflows by name', async () => {
      mockFs({
        [workflowsPath]: {
          'z-workflow.yaml': 'name: Zebra Workflow\nsteps: []',
          'a-workflow.yaml': 'name: Apple Workflow\nsteps: []',
          'm-workflow.yaml': 'name: Mango Workflow\nsteps: []'
        }
      });
      
      const workflows = await workflowParser.getAllWorkflows();
      
      expect(workflows.map(w => w.name)).toEqual([
        'Apple Workflow',
        'Mango Workflow',
        'Zebra Workflow'
      ]);
    });
  });
  
  describe('getWorkflowById', () => {
    beforeEach(() => {
      mockFs({
        [workflowsPath]: {
          'bread-workflow.yaml': `
name: Bread Workflow
version: 1.0
steps:
  - name: mixing
    activities:
      - mix_flour
      - add_water
    duration: 15m
  - name: proofing
    type: sleep
    duration: 2h
    conditions:
      - temp > 25: 1.5h
    location: warm_place
  - name: baking
    timeout: 45m
    params:
      temp: 200
    notes: Preheat oven first`,
          'simple.yml': `
name: Simple Workflow
steps:
  - name: step_one`
        }
      });
    });
    
    it('should return workflow with .yaml extension', async () => {
      const workflow = await workflowParser.getWorkflowById('bread-workflow');
      
      expect(workflow).toBeTruthy();
      expect(workflow.id).toBe('bread-workflow');
      expect(workflow.name).toBe('Bread Workflow');
      expect(workflow.version).toBe(1);
      expect(workflow.steps).toHaveLength(3);
      
      // Check step processing
      expect(workflow.steps[0]).toEqual({
        id: 'step-1',
        name: 'mixing',
        type: 'active',
        activities: ['mix_flour', 'add_water'],
        duration: '15m',
        timeout: undefined,
        conditions: [],
        location: undefined,
        notes: undefined,
        repeat: undefined,
        params: {}
      });
      
      expect(workflow.steps[1]).toEqual({
        id: 'step-2',
        name: 'proofing',
        type: 'sleep',
        activities: [],
        duration: '2h',
        timeout: undefined,
        conditions: [{ 'temp > 25': '1.5h' }],
        location: 'warm_place',
        notes: undefined,
        repeat: undefined,
        params: {}
      });
    });
    
    it('should return workflow with .yml extension', async () => {
      const workflow = await workflowParser.getWorkflowById('simple');
      
      expect(workflow).toBeTruthy();
      expect(workflow.id).toBe('simple');
      expect(workflow.name).toBe('Simple Workflow');
    });
    
    it('should return null for non-existent workflow', async () => {
      const workflow = await workflowParser.getWorkflowById('non-existent');
      
      expect(workflow).toBeNull();
    });
    
    it('should sanitize workflow ID to prevent directory traversal', async () => {
      const workflow = await workflowParser.getWorkflowById('../../../etc/passwd');
      
      expect(workflow).toBeNull();
    });
    
    it('should handle workflows with step IDs', async () => {
      mockFs({
        [workflowsPath]: {
          'with-ids.yaml': `
name: Workflow with IDs
steps:
  - id: custom-id-1
    name: First Step
  - id: custom-id-2
    name: Second Step`
        }
      });
      
      const workflow = await workflowParser.getWorkflowById('with-ids');
      
      expect(workflow.steps[0].id).toBe('custom-id-1');
      expect(workflow.steps[1].id).toBe('custom-id-2');
    });
  });
  
  describe('validateWorkflow', () => {
    it('should validate a correct workflow', () => {
      const workflow = {
        name: 'Valid Workflow',
        steps: [
          { name: 'Step 1', activities: ['action1'] },
          { name: 'Step 2', type: 'sleep', duration: '1h' }
        ]
      };
      
      const result = workflowParser.validateWorkflow(workflow);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    it('should require workflow name', () => {
      const workflow = {
        steps: [{ name: 'Step 1' }]
      };
      
      const result = workflowParser.validateWorkflow(workflow);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Workflow name is required');
    });
    
    it('should require steps array', () => {
      const workflow = {
        name: 'No Steps Workflow'
      };
      
      const result = workflowParser.validateWorkflow(workflow);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Workflow must have a steps array');
    });
    
    it('should validate step names', () => {
      const workflow = {
        name: 'Workflow',
        steps: [
          { activities: ['action'] },
          { name: 'Valid Step' }
        ]
      };
      
      const result = workflowParser.validateWorkflow(workflow);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Step 1 must have a name');
    });
    
    it('should validate sleep steps have duration', () => {
      const workflow = {
        name: 'Workflow',
        steps: [
          { name: 'Sleep Step', type: 'sleep' }
        ]
      };
      
      const result = workflowParser.validateWorkflow(workflow);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Sleep step "Sleep Step" must have a duration');
    });
    
    it('should validate activities and conditions are arrays', () => {
      const workflow = {
        name: 'Workflow',
        steps: [
          { name: 'Step 1', activities: 'not-an-array' },
          { name: 'Step 2', conditions: 'not-an-array' }
        ]
      };
      
      const result = workflowParser.validateWorkflow(workflow);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Step "Step 1" activities must be an array');
      expect(result.errors).toContain('Step "Step 2" conditions must be an array');
    });
  });
  
  describe('getWorkflowCategories', () => {
    it('should categorize workflows based on ID patterns', async () => {
      mockFs({
        [workflowsPath]: {
          'sourdough-bread.yaml': 'name: Sourdough\nsteps: []',
          'white-bread.yaml': 'name: White Bread\nsteps: []',
          'chocolate-cake.yaml': 'name: Chocolate Cake\nsteps: []',
          'croissant.yaml': 'name: Croissant\nsteps: []',
          'danish-pastry.yaml': 'name: Danish\nsteps: []',
          'special-item.yaml': 'name: Special\nsteps: []'
        }
      });
      
      const categories = await workflowParser.getWorkflowCategories();
      
      expect(categories).toEqual(['breads', 'cakes', 'other', 'pastries']);
    });
    
    it('should handle empty directory', async () => {
      mockFs({
        [workflowsPath]: {}
      });
      
      const categories = await workflowParser.getWorkflowCategories();
      
      expect(categories).toEqual([]);
    });
  });
  
  describe('parseWorkflowFile', () => {
    it('should parse YAML file and add ID from filename', async () => {
      const testPath = '/test/workflow.yaml';
      mockFs({
        '/test/workflow.yaml': `
name: Test Workflow
version: 2.0
steps:
  - name: test step`
      });
      
      const result = await workflowParser.parseWorkflowFile(testPath);
      
      expect(result).toEqual({
        id: 'workflow',
        name: 'Test Workflow',
        version: 2.0,
        steps: [{ name: 'test step' }]
      });
    });
    
    it('should throw error for invalid file', async () => {
      const testPath = '/test/nonexistent.yaml';
      mockFs({});
      
      await expect(workflowParser.parseWorkflowFile(testPath))
        .rejects.toThrow();
    });
  });
});