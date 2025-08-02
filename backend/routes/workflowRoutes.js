const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflowController');
const { authenticate } = require('../middleware/authMiddleware');

// Public routes - workflows are read-only for now
router.get('/', workflowController.listWorkflows);
router.get('/categories', workflowController.getCategories);
router.get('/stats', workflowController.getWorkflowStats);
router.get('/:workflowId', workflowController.getWorkflow);

// Protected routes - for future workflow management features
router.post('/validate', authenticate, workflowController.validateWorkflow);

module.exports = router;