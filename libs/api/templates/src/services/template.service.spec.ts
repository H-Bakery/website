/**
 * Template Service Tests
 * Bakery Management System
 */

import { TemplateService } from './template.service'
import {
  NotificationTemplate,
  CreateTemplateInput,
} from '../models/template.model'

describe('TemplateService', () => {
  let service: TemplateService
  let mockNotificationTemplate: any
  let mockLogger: any

  beforeEach(() => {
    // Mock database model
    mockNotificationTemplate = {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn(),
      findOrCreate: jest.fn(),
    }

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }

    // Create service instance
    service = new TemplateService({
      NotificationTemplate: mockNotificationTemplate,
      logger: mockLogger,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getTemplate', () => {
    it('should return template by key', async () => {
      const mockTemplate = {
        id: '123',
        key: 'order.new',
        name: 'New Order',
        category: 'order',
        defaultTitle: { de: 'Neue Bestellung', en: 'New Order' },
        defaultMessage: {
          de: 'Bestellung {{orderId}}',
          en: 'Order {{orderId}}',
        },
        variables: ['orderId'],
        defaultPriority: 'high',
        defaultType: 'info',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockNotificationTemplate.findOne.mockResolvedValue(mockTemplate)

      const result = await service.getTemplate('order.new')

      expect(mockNotificationTemplate.findOne).toHaveBeenCalledWith({
        where: { key: 'order.new', isActive: true },
      })
      expect(result).toEqual(mockTemplate)
    })

    it('should return null if template not found', async () => {
      mockNotificationTemplate.findOne.mockResolvedValue(null)

      const result = await service.getTemplate('non.existent')

      expect(result).toBeNull()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Template not found: non.existent'
      )
    })
  })

  describe('renderTemplate', () => {
    it('should render template with variables', async () => {
      const mockTemplate = {
        id: '123',
        key: 'order.new',
        name: 'New Order',
        category: 'order',
        defaultTitle: { de: 'Neue Bestellung', en: 'New Order' },
        defaultMessage: {
          de: 'Neue Bestellung {{orderId}} von {{customerName}}',
          en: 'New order {{orderId}} from {{customerName}}',
        },
        variables: ['orderId', 'customerName'],
        defaultPriority: 'high',
        defaultType: 'info',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockNotificationTemplate.findOne.mockResolvedValue(mockTemplate)

      const result = await service.renderTemplate({
        templateKey: 'order.new',
        variables: {
          orderId: '12345',
          customerName: 'John Doe',
        },
        language: 'en',
      })

      expect(result).toEqual({
        title: 'New Order',
        message: 'New order 12345 from John Doe',
        type: 'info',
        priority: 'high',
        category: 'order',
        metadata: {
          orderId: '12345',
          customerName: 'John Doe',
          templateKey: 'order.new',
          language: 'en',
        },
      })
    })

    it('should use German as default language', async () => {
      const mockTemplate = {
        id: '123',
        key: 'order.new',
        name: 'New Order',
        category: 'order',
        defaultTitle: { de: 'Neue Bestellung', en: 'New Order' },
        defaultMessage: {
          de: 'Bestellung {{orderId}}',
          en: 'Order {{orderId}}',
        },
        variables: ['orderId'],
        defaultPriority: 'high',
        defaultType: 'info',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockNotificationTemplate.findOne.mockResolvedValue(mockTemplate)

      const result = await service.renderTemplate({
        templateKey: 'order.new',
        variables: { orderId: '12345' },
      })

      expect(result.title).toBe('Neue Bestellung')
      expect(result.message).toBe('Bestellung 12345')
    })

    it('should warn about unreplaced variables', async () => {
      const mockTemplate = {
        id: '123',
        key: 'order.new',
        name: 'New Order',
        category: 'order',
        defaultTitle: { de: 'Neue Bestellung', en: 'New Order' },
        defaultMessage: {
          de: 'Bestellung {{orderId}} - {{total}}',
          en: 'Order {{orderId}} - {{total}}',
        },
        variables: ['orderId', 'total'],
        defaultPriority: 'high',
        defaultType: 'info',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockNotificationTemplate.findOne.mockResolvedValue(mockTemplate)

      await service.renderTemplate({
        templateKey: 'order.new',
        variables: { orderId: '12345' }, // Missing 'total'
      })

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unreplaced variables in template order.new: total'
      )
    })
  })

  describe('validateTemplateVariables', () => {
    it('should validate correct template', () => {
      const result = service.validateTemplateVariables(
        'Hello {{name}}, your order {{orderId}} is ready',
        ['name', 'orderId']
      )

      expect(result).toEqual({
        valid: true,
        usedVars: ['name', 'orderId'],
        undeclaredVars: [],
        unusedVars: [],
      })
    })

    it('should detect undeclared variables', () => {
      const result = service.validateTemplateVariables(
        'Hello {{name}}, your order {{orderId}} is ready',
        ['name'] // Missing 'orderId'
      )

      expect(result).toEqual({
        valid: false,
        usedVars: ['name', 'orderId'],
        undeclaredVars: ['orderId'],
        unusedVars: [],
      })
    })

    it('should detect unused variables', () => {
      const result = service.validateTemplateVariables(
        'Hello {{name}}',
        ['name', 'orderId', 'total'] // 'orderId' and 'total' not used
      )

      expect(result).toEqual({
        valid: true,
        usedVars: ['name'],
        undeclaredVars: [],
        unusedVars: ['orderId', 'total'],
      })
    })
  })

  describe('createTemplate', () => {
    it('should create template with valid data', async () => {
      const input: CreateTemplateInput = {
        key: 'inventory.low',
        name: 'Low Inventory',
        category: 'inventory',
        defaultTitle: { de: 'Niedriger Bestand', en: 'Low Inventory' },
        defaultMessage: {
          de: 'Produkt {{productName}} hat nur noch {{quantity}} Einheiten',
          en: 'Product {{productName}} has only {{quantity}} units left',
        },
        variables: ['productName', 'quantity'],
        defaultPriority: 'high',
        defaultType: 'warning',
      }

      const mockCreated = {
        id: '456',
        ...input,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockNotificationTemplate.findOne.mockResolvedValue(null)
      mockNotificationTemplate.create.mockResolvedValue(mockCreated)

      const result = await service.createTemplate(input)

      expect(mockNotificationTemplate.create).toHaveBeenCalledWith({
        ...input,
        isActive: true,
        defaultPriority: 'high',
        defaultType: 'warning',
      })
      expect(result).toEqual(mockCreated)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Template created: inventory.low'
      )
    })

    it('should throw error if template key already exists', async () => {
      mockNotificationTemplate.findOne.mockResolvedValue({ id: '123' })

      await expect(
        service.createTemplate({
          key: 'existing.key',
          name: 'Test',
          category: 'system',
          defaultTitle: { de: 'Test', en: 'Test' },
          defaultMessage: { de: 'Test', en: 'Test' },
        })
      ).rejects.toThrow("Template with key 'existing.key' already exists")
    })

    it('should throw error on validation failure', async () => {
      const input: CreateTemplateInput = {
        key: 'test.template',
        name: 'Test Template',
        category: 'system',
        defaultTitle: { de: 'Test {{title}}', en: 'Test {{title}}' },
        defaultMessage: { de: 'Test {{message}}', en: 'Test {{message}}' },
        variables: ['title'], // Missing 'message'
      }

      mockNotificationTemplate.findOne.mockResolvedValue(null)

      await expect(service.createTemplate(input)).rejects.toThrow(
        'Template validation failed: undeclared variables found'
      )
    })
  })

  describe('upsertTemplate', () => {
    it('should create new template if not exists', async () => {
      const input: CreateTemplateInput = {
        key: 'new.template',
        name: 'New Template',
        category: 'system',
        defaultTitle: { de: 'Neu', en: 'New' },
        defaultMessage: { de: 'Nachricht', en: 'Message' },
      }

      const mockCreated = {
        id: '789',
        ...input,
        isActive: true,
        defaultPriority: 'medium',
        defaultType: 'info',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockNotificationTemplate.findOrCreate.mockResolvedValue([
        mockCreated,
        true,
      ])

      const result = await service.upsertTemplate(input)

      // mapToNotificationTemplate füllt fehlende variables mit [] auf
      expect(result).toEqual({ ...mockCreated, variables: [] })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Template created: new.template'
      )
    })

    it('should update existing template', async () => {
      const input: CreateTemplateInput = {
        key: 'existing.template',
        name: 'Updated Template',
        category: 'system',
        defaultTitle: { de: 'Aktualisiert', en: 'Updated' },
        defaultMessage: { de: 'Nachricht', en: 'Message' },
      }

      const mockExisting = {
        id: '789',
        key: 'existing.template',
        update: jest.fn(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockNotificationTemplate.findOrCreate.mockResolvedValue([
        mockExisting,
        false,
      ])

      await service.upsertTemplate(input)

      expect(mockExisting.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Template',
          category: 'system',
        })
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Template updated: existing.template'
      )
    })
  })

  describe('deleteTemplate', () => {
    it('should delete existing template', async () => {
      mockNotificationTemplate.destroy.mockResolvedValue(1)

      const result = await service.deleteTemplate('template.to.delete')

      expect(mockNotificationTemplate.destroy).toHaveBeenCalledWith({
        where: { key: 'template.to.delete' },
      })
      expect(result).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Template deleted: template.to.delete'
      )
    })

    it('should return false if template not found', async () => {
      mockNotificationTemplate.destroy.mockResolvedValue(0)

      const result = await service.deleteTemplate('non.existent')

      expect(result).toBe(false)
    })
  })
})
