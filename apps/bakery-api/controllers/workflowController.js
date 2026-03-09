const workflowParser = require('../utils/workflowParser')
const logger = require('../utils/logger')

const listWorkflows = async (req, res) => {
  try {
    logger.info('Processing list workflows request...')
    const workflows = await workflowParser.getAllWorkflows()
    logger.info(`Retrieved ${workflows.length} workflows`)
    return res.json({
      success: true,
      count: workflows.length,
      data: workflows,
    })
  } catch (error) {
    logger.error('Workflow list retrieval error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve workflows',
    })
  }
}

const getWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params
    logger.info(`Processing get workflow request for ID: ${workflowId}`)
    const workflow = await workflowParser.getWorkflowById(workflowId)
    if (!workflow) {
      logger.warn(`Workflow not found: ${workflowId}`)
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      })
    }
    logger.info(`Workflow ${workflowId} retrieved successfully`)
    return res.json({ success: true, data: workflow })
  } catch (error) {
    logger.error(`Error retrieving workflow ${req.params.workflowId}:`, error)
    if (error.name === 'YAMLException') {
      return res.status(500).json({
        success: false,
        error: 'Invalid workflow file format',
      })
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve workflow',
    })
  }
}

const getCategories = async (req, res) => {
  try {
    logger.info('Processing get workflow categories request...')
    const categories = await workflowParser.getWorkflowCategories()
    logger.info(`Retrieved ${categories.length} workflow categories`)
    return res.json({ success: true, data: categories })
  } catch (error) {
    logger.error('Error retrieving workflow categories:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve workflow categories',
    })
  }
}

const validateWorkflow = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow data',
      })
    }

    const result = workflowParser.validateWorkflow(req.body)
    if (result.valid) {
      logger.info('Workflow validation successful')
      return res.json({
        success: true,
        message: 'Workflow is valid',
      })
    }

    logger.warn('Workflow validation failed:', result.errors)
    return res.status(400).json({
      success: false,
      error: 'Workflow validation failed',
      errors: result.errors,
    })
  } catch (error) {
    logger.error('Error validating workflow:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to validate workflow',
    })
  }
}

const getWorkflowStats = async (req, res) => {
  try {
    const workflows = await workflowParser.getAllWorkflows()

    const totalWorkflows = workflows.length
    const totalSteps = workflows.reduce((sum, w) => sum + (w.steps || 0), 0)
    const averageStepsPerWorkflow =
      totalWorkflows > 0 ? Math.round(totalSteps / totalWorkflows) : 0

    const workflowsByVersion = {}
    workflows.forEach((w) => {
      const version = w.version || '1.0'
      workflowsByVersion[version] = (workflowsByVersion[version] || 0) + 1
    })

    logger.info('Workflow statistics calculated successfully')
    return res.json({
      success: true,
      data: {
        totalWorkflows,
        totalSteps,
        averageStepsPerWorkflow,
        workflowsByVersion,
      },
    })
  } catch (error) {
    logger.error('Error calculating workflow statistics:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate workflow statistics',
    })
  }
}

module.exports = {
  listWorkflows,
  getWorkflow,
  getCategories,
  validateWorkflow,
  getWorkflowStats,
}
