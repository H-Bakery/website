/**
 * Email Routes - API endpoint definitions
 * Bakery Management System
 */

import { Router } from 'express';
import { EmailController } from '../controllers/email.controller';
import {
  sendTestEmailValidator,
  sendEmailValidator,
  sendBulkEmailsValidator,
  updateQueueConfigValidator,
} from '../validators/email.validators';

export interface EmailRoutesDeps {
  emailController: EmailController;
  authMiddleware: any;
  validationMiddleware: any;
}

export function createEmailRoutes(deps: EmailRoutesDeps): Router {
  const router = Router();
  const { emailController, authMiddleware, validationMiddleware } = deps;

  /**
   * @route   POST /api/email/test
   * @desc    Send test email
   * @access  Private
   */
  router.post(
    '/test',
    authMiddleware,
    sendTestEmailValidator,
    validationMiddleware,
    emailController.sendTestEmail
  );

  /**
   * @route   POST /api/email/send
   * @desc    Send templated email
   * @access  Private
   */
  router.post(
    '/send',
    authMiddleware,
    sendEmailValidator,
    validationMiddleware,
    emailController.sendEmail
  );

  /**
   * @route   POST /api/email/bulk
   * @desc    Send bulk emails
   * @access  Private (Admin/Manager)
   */
  router.post(
    '/bulk',
    authMiddleware,
    sendBulkEmailsValidator,
    validationMiddleware,
    emailController.sendBulkEmails
  );

  /**
   * @route   GET /api/email/queue/status
   * @desc    Get email queue status
   * @access  Private
   */
  router.get('/queue/status', authMiddleware, emailController.getQueueStatus);

  /**
   * @route   DELETE /api/email/queue
   * @desc    Clear email queue
   * @access  Private (Admin)
   */
  router.delete('/queue', authMiddleware, emailController.clearQueue);

  /**
   * @route   PUT /api/email/queue/config
   * @desc    Update queue configuration
   * @access  Private (Admin)
   */
  router.put(
    '/queue/config',
    authMiddleware,
    updateQueueConfigValidator,
    validationMiddleware,
    emailController.updateQueueConfig
  );

  /**
   * @route   GET /api/email/verify
   * @desc    Verify email connection
   * @access  Private (Admin/Manager)
   */
  router.get('/verify', authMiddleware, emailController.verifyConnection);

  return router;
}