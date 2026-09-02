/**
 * Email Service Tests
 * Bakery Management System
 */

import { EmailService } from './email.service'
import * as nodemailer from 'nodemailer'

// Mock nodemailer
jest.mock('nodemailer')

describe('EmailService', () => {
  let service: EmailService
  let mockLogger: any
  let mockTemplateService: any
  let mockNotificationPreferences: any
  let mockTransporter: any

  beforeEach(() => {
    // Clear environment variables
    process.env['EMAIL_PROVIDER'] = 'smtp'
    process.env['EMAIL_HOST'] = 'smtp.test.com'
    process.env['EMAIL_PORT'] = '587'
    process.env['EMAIL_USER'] = 'test@test.com'
    process.env['EMAIL_PASSWORD'] = 'password'
    process.env['EMAIL_FROM'] = 'noreply@bakery.com'
    process.env['EMAIL_FROM_NAME'] = 'Test Bakery'

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }

    // Mock template service
    mockTemplateService = {
      renderTemplate: jest.fn(),
    }

    // Mock notification preferences
    mockNotificationPreferences = {
      findOne: jest.fn(),
    }

    // Mock transporter
    mockTransporter = {
      verify: jest.fn().mockResolvedValue(true),
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    }
    ;(nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter)

    // Create service instance
    service = new EmailService({
      logger: mockLogger,
      templateService: mockTemplateService,
      NotificationPreferences: mockNotificationPreferences,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with SMTP configuration', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@test.com',
          pass: 'password',
        },
      })
    })

    it('should skip initialization if no configuration', () => {
      delete process.env['EMAIL_HOST']
      delete process.env['EMAIL_PROVIDER']

      new EmailService({ logger: mockLogger })

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Email service not configured. Skipping email notifications.'
      )
    })

    it('should initialize with Gmail configuration', () => {
      process.env['EMAIL_PROVIDER'] = 'gmail'

      new EmailService({ logger: mockLogger })

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        service: 'gmail',
        auth: {
          user: 'test@test.com',
          pass: 'password',
        },
      })
    })
  })

  describe('sendNotificationEmail', () => {
    it('should send email successfully', async () => {
      const notification = {
        id: '123',
        title: 'Test Notification',
        message: 'This is a test message',
        category: 'system',
        priority: 'medium' as const,
      }

      const result = await service.sendNotificationEmail(
        notification,
        'recipient@example.com',
        'en'
      )

      expect(result).toEqual({
        success: true,
        messageId: 'test-message-id',
      })

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Test Bakery" <noreply@bakery.com>',
        to: 'recipient@example.com',
        subject: 'Test Notification',
        text: expect.any(String),
        html: expect.any(String),
      })
    })

    it('should handle email sending failure', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'))

      const notification = {
        id: '123',
        title: 'Test',
        message: 'Test',
        category: 'system',
        priority: 'medium' as const,
      }

      const result = await service.sendNotificationEmail(
        notification,
        'recipient@example.com'
      )

      expect(result).toEqual({
        success: false,
        error: 'SMTP error',
      })

      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('should return error if service not configured', async () => {
      // Create service without configuration
      delete process.env['EMAIL_HOST']
      delete process.env['EMAIL_PROVIDER']

      const serviceUnconfigured = new EmailService({ logger: mockLogger })

      const result = await serviceUnconfigured.sendNotificationEmail(
        {
          id: '123',
          title: 'Test',
          message: 'Test',
          category: 'system',
          priority: 'medium',
        },
        'test@example.com'
      )

      expect(result).toEqual({
        success: false,
        error: 'Email service not configured',
      })
    })
  })

  describe('sendTemplatedEmail', () => {
    it('should send templated email using template service', async () => {
      const renderedNotification = {
        id: 'template-123',
        title: 'Rendered Title',
        message: 'Rendered Message',
        category: 'order',
        priority: 'high',
      }

      mockTemplateService.renderTemplate.mockResolvedValue(renderedNotification)

      const result = await service.sendTemplatedEmail(
        'order.new',
        { orderId: '12345', customerName: 'John Doe' },
        'recipient@example.com',
        { language: 'en', subject: 'Custom Subject' }
      )

      expect(mockTemplateService.renderTemplate).toHaveBeenCalledWith({
        templateKey: 'order.new',
        variables: { orderId: '12345', customerName: 'John Doe' },
        language: 'en',
      })

      expect(result).toEqual({
        success: true,
        messageId: 'test-message-id',
      })
    })

    it('should send simple email if template service not available', async () => {
      const serviceNoTemplate = new EmailService({ logger: mockLogger })

      const result = await serviceNoTemplate.sendTemplatedEmail(
        'test.template',
        { test: 'value' },
        'recipient@example.com'
      )

      expect(result).toEqual({
        success: true,
        messageId: 'test-message-id',
      })
    })
  })

  describe('sendBulkEmails', () => {
    it('should send bulk emails in batches', async () => {
      const notifications = [
        {
          id: '1',
          title: 'Test 1',
          message: 'Message 1',
          category: 'system',
          priority: 'medium' as const,
        },
        {
          id: '2',
          title: 'Test 2',
          message: 'Message 2',
          category: 'system',
          priority: 'high' as const,
        },
      ]

      const recipients = [
        { email: 'user1@example.com', notificationIndex: 0 },
        { email: 'user2@example.com', notificationIndex: 1 },
      ]

      const result = await service.sendBulkEmails(notifications, recipients)

      expect(result).toEqual({
        success: true,
        sent: 2,
        failed: 0,
        errors: [],
      })

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2)
    })

    it('should handle partial failures in bulk send', async () => {
      mockTransporter.sendMail
        .mockResolvedValueOnce({ messageId: 'success-1' })
        .mockRejectedValueOnce(new Error('SMTP error'))

      const notifications = [
        {
          id: '1',
          title: 'Test',
          message: 'Message',
          category: 'system',
          priority: 'medium' as const,
        },
      ]

      const recipients = [
        { email: 'success@example.com' },
        { email: 'fail@example.com' },
      ]

      const result = await service.sendBulkEmails(notifications, recipients)

      expect(result.sent).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('shouldSendEmail', () => {
    it('should check user preferences', async () => {
      const mockPreferences = {
        emailEnabled: true,
        categoryPreferences: {
          order: true,
          system: true,
        },
        priorityThreshold: 'medium',
        quietHours: {
          enabled: false,
        },
      }

      mockNotificationPreferences.findOne.mockResolvedValue(mockPreferences)

      const notification = {
        id: '123',
        title: 'Test',
        message: 'Test',
        category: 'order',
        priority: 'high' as const,
      }

      const shouldSend = await service.shouldSendEmail('user123', notification)

      expect(shouldSend).toBe(true)
      expect(mockNotificationPreferences.findOne).toHaveBeenCalledWith({
        where: { userId: 'user123' },
      })
    })

    it('should respect priority threshold', async () => {
      const mockPreferences = {
        emailEnabled: true,
        categoryPreferences: { system: true },
        priorityThreshold: 'high',
        quietHours: { enabled: false },
      }

      mockNotificationPreferences.findOne.mockResolvedValue(mockPreferences)

      const notification = {
        id: '123',
        title: 'Test',
        message: 'Test',
        category: 'system',
        priority: 'medium' as const,
      }

      const shouldSend = await service.shouldSendEmail('user123', notification)

      expect(shouldSend).toBe(false)
    })

    it('should respect quiet hours', async () => {
      // Mock current time to 23:00
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-01 23:00:00'))

      const mockPreferences = {
        emailEnabled: true,
        categoryPreferences: { system: true },
        priorityThreshold: 'low',
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '07:00',
        },
      }

      mockNotificationPreferences.findOne.mockResolvedValue(mockPreferences)

      const notification = {
        id: '123',
        title: 'Test',
        message: 'Test',
        category: 'system',
        priority: 'medium' as const,
      }

      const shouldSend = await service.shouldSendEmail('user123', notification)

      expect(shouldSend).toBe(false)

      jest.useRealTimers()
    })

    it('should send urgent notifications during quiet hours', async () => {
      // Mock current time to 23:00
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-01 23:00:00'))

      const mockPreferences = {
        emailEnabled: true,
        categoryPreferences: { system: true },
        priorityThreshold: 'low',
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '07:00',
        },
      }

      mockNotificationPreferences.findOne.mockResolvedValue(mockPreferences)

      const notification = {
        id: '123',
        title: 'Urgent',
        message: 'Urgent',
        category: 'system',
        priority: 'urgent' as const,
      }

      const shouldSend = await service.shouldSendEmail('user123', notification)

      expect(shouldSend).toBe(true)

      jest.useRealTimers()
    })
  })

  describe('verifyConnection', () => {
    it('should verify connection successfully', async () => {
      const result = await service.verifyConnection()

      expect(result).toBe(true)
      expect(mockTransporter.verify).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Email service connected successfully'
      )
    })

    it('should handle connection failure', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Connection failed'))

      const result = await service.verifyConnection()

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Email service connection failed:',
        expect.any(Error)
      )
    })
  })
})
