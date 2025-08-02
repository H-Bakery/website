const express = require('express');
const router = express.Router();
const notificationArchivalService = require('../services/notificationArchivalService');
const { requireAdmin } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

/**
 * @route GET /api/notifications/archival/policies
 * @desc Get current archival policies
 * @access Admin
 */
router.get('/policies', requireAdmin, async (req, res) => {
  try {
    const policies = notificationArchivalService.getPolicies();
    res.json({
      success: true,
      policies
    });
  } catch (error) {
    logger.error('Error getting archival policies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get archival policies'
    });
  }
});

/**
 * @route PUT /api/notifications/archival/policies
 * @desc Update archival policies
 * @access Admin
 */
router.put('/policies', requireAdmin, async (req, res) => {
  try {
    const {
      autoArchiveAfterDays,
      permanentDeleteAfterDays,
      archiveReadOnly,
      excludeCategories,
      excludePriorities,
      batchSize,
      enabled
    } = req.body;

    // Validate input
    const updates = {};
    
    if (typeof autoArchiveAfterDays === 'number' && autoArchiveAfterDays > 0) {
      updates.autoArchiveAfterDays = autoArchiveAfterDays;
    }
    
    if (typeof permanentDeleteAfterDays === 'number' && permanentDeleteAfterDays > 0) {
      updates.permanentDeleteAfterDays = permanentDeleteAfterDays;
    }
    
    if (typeof archiveReadOnly === 'boolean') {
      updates.archiveReadOnly = archiveReadOnly;
    }
    
    if (Array.isArray(excludeCategories)) {
      updates.excludeCategories = excludeCategories.filter(cat =>
        ['staff', 'order', 'system', 'inventory', 'general'].includes(cat)
      );
    }
    
    if (Array.isArray(excludePriorities)) {
      updates.excludePriorities = excludePriorities.filter(priority =>
        ['low', 'medium', 'high', 'urgent'].includes(priority)
      );
    }
    
    if (typeof batchSize === 'number' && batchSize > 0 && batchSize <= 1000) {
      updates.batchSize = batchSize;
    }
    
    if (typeof enabled === 'boolean') {
      updates.enabled = enabled;
    }

    // Validation: permanent delete should be longer than auto-archive
    if (updates.autoArchiveAfterDays && updates.permanentDeleteAfterDays) {
      if (updates.permanentDeleteAfterDays <= updates.autoArchiveAfterDays) {
        return res.status(400).json({
          success: false,
          error: 'Permanent delete period must be longer than auto-archive period'
        });
      }
    }

    notificationArchivalService.updatePolicies(updates);
    
    const updatedPolicies = notificationArchivalService.getPolicies();
    
    logger.info('Archival policies updated by admin', { 
      admin: req.user?.id,
      updates,
      newPolicies: updatedPolicies 
    });

    res.json({
      success: true,
      message: 'Archival policies updated successfully',
      policies: updatedPolicies
    });

  } catch (error) {
    logger.error('Error updating archival policies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update archival policies'
    });
  }
});

/**
 * @route GET /api/notifications/archival/status
 * @desc Get archival service status and statistics
 * @access Admin
 */
router.get('/status', requireAdmin, async (req, res) => {
  try {
    const [status, stats] = await Promise.all([
      notificationArchivalService.getStatus(),
      notificationArchivalService.getArchivalStats()
    ]);

    res.json({
      success: true,
      status,
      stats
    });
  } catch (error) {
    logger.error('Error getting archival status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get archival status'
    });
  }
});

/**
 * @route POST /api/notifications/archival/trigger
 * @desc Manually trigger archival process
 * @access Admin
 */
router.post('/trigger', requireAdmin, async (req, res) => {
  try {
    const result = await notificationArchivalService.triggerArchival();
    
    logger.info('Manual archival triggered by admin', {
      admin: req.user?.id,
      result
    });

    res.json({
      success: true,
      message: result.skipped ? 'Archival is disabled' : `Successfully archived ${result.archived} notifications`,
      result
    });
  } catch (error) {
    logger.error('Error triggering archival:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger archival process'
    });
  }
});

/**
 * @route POST /api/notifications/archival/cleanup
 * @desc Manually trigger cleanup process (permanent deletion)
 * @access Admin
 */
router.post('/cleanup', requireAdmin, async (req, res) => {
  try {
    const result = await notificationArchivalService.triggerCleanup();
    
    logger.info('Manual cleanup triggered by admin', {
      admin: req.user?.id,
      result
    });

    res.json({
      success: true,
      message: result.skipped ? 'Cleanup is disabled' : `Successfully deleted ${result.deleted} notifications`,
      result
    });
  } catch (error) {
    logger.error('Error triggering cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger cleanup process'
    });
  }
});

/**
 * @route POST /api/notifications/archival/start
 * @desc Start the archival service
 * @access Admin
 */
router.post('/start', requireAdmin, async (req, res) => {
  try {
    const policies = notificationArchivalService.getPolicies();
    
    if (!policies.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Archival service is disabled. Enable it first by updating policies.'
      });
    }

    notificationArchivalService.startScheduledTasks();
    
    logger.info('Archival service started by admin', {
      admin: req.user?.id
    });

    res.json({
      success: true,
      message: 'Archival service started successfully'
    });
  } catch (error) {
    logger.error('Error starting archival service:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start archival service'
    });
  }
});

/**
 * @route POST /api/notifications/archival/stop
 * @desc Stop the archival service
 * @access Admin  
 */
router.post('/stop', requireAdmin, async (req, res) => {
  try {
    notificationArchivalService.stopScheduledTasks();
    
    logger.info('Archival service stopped by admin', {
      admin: req.user?.id
    });

    res.json({
      success: true,
      message: 'Archival service stopped successfully'
    });
  } catch (error) {
    logger.error('Error stopping archival service:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop archival service'
    });
  }
});

/**
 * @route GET /api/notifications/archival/next-run
 * @desc Get information about next scheduled runs
 * @access Admin
 */
router.get('/next-run', requireAdmin, async (req, res) => {
  try {
    const policies = notificationArchivalService.getPolicies();
    
    if (!policies.enabled) {
      return res.json({
        success: true,
        message: 'Archival service is disabled',
        nextRuns: null
      });
    }

    // Calculate next runs (approximation since cron timing is complex)
    const now = new Date();
    const nextArchival = new Date(now);
    const nextCleanup = new Date(now);
    
    // Next 2:00 AM for archival
    nextArchival.setHours(2, 0, 0, 0);
    if (nextArchival <= now) {
      nextArchival.setDate(nextArchival.getDate() + 1);
    }
    
    // Next Sunday 3:00 AM for cleanup
    nextCleanup.setHours(3, 0, 0, 0);
    const daysUntilSunday = (7 - nextCleanup.getDay()) % 7;
    if (daysUntilSunday === 0 && nextCleanup <= now) {
      nextCleanup.setDate(nextCleanup.getDate() + 7);
    } else {
      nextCleanup.setDate(nextCleanup.getDate() + daysUntilSunday);
    }

    res.json({
      success: true,
      nextRuns: {
        archival: nextArchival.toISOString(),
        cleanup: nextCleanup.toISOString()
      },
      policies
    });
  } catch (error) {
    logger.error('Error getting next run info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get next run information'
    });
  }
});

module.exports = router;