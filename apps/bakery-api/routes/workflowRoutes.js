const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authMiddleware')
const workflowController = require('../controllers/workflowController')

router.get('/categories', workflowController.getCategories)
router.get('/stats', workflowController.getWorkflowStats)
router.post('/validate', authenticate, workflowController.validateWorkflow)
router.get('/', workflowController.listWorkflows)
router.get('/:workflowId', workflowController.getWorkflow)

module.exports = router
