const swaggerJSDoc = require('swagger-jsdoc')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bakery Management System API',
      version: '1.0.0',
      description:
        'Comprehensive API for managing bakery operations including inventory, recipes, orders, staff, and production workflows',
      contact: {
        name: 'Bakery Management System',
        email: 'support@bakery.local',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Frontend server (for reference)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'JWT Bearer token authentication. Use the /api/auth/login endpoint to obtain a token.',
        },
      },
      schemas: {
        // Authentication Schemas
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Username for authentication',
              example: 'admin',
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'Password for authentication',
              example: 'securepassword',
            },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['username', 'password', 'email', 'firstName', 'lastName'],
          properties: {
            username: {
              type: 'string',
              description: 'Unique username',
              example: 'newuser',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 6,
              description: 'Password (minimum 6 characters)',
              example: 'password123',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Valid email address',
              example: 'newuser@bakery.local',
            },
            firstName: {
              type: 'string',
              description: 'First name',
              example: 'Jane',
            },
            lastName: {
              type: 'string',
              description: 'Last name',
              example: 'Doe',
            },
            role: {
              type: 'string',
              enum: ['admin', 'staff', 'user'],
              description: 'User role',
              example: 'staff',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Login successful',
            },
            token: {
              type: 'string',
              description: 'JWT authentication token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },

        // User Schema
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1,
            },
            username: {
              type: 'string',
              description: 'Username',
              example: 'admin',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address',
              example: 'admin@bakery.local',
            },
            firstName: {
              type: 'string',
              description: 'First name',
              example: 'John',
            },
            lastName: {
              type: 'string',
              description: 'Last name',
              example: 'Doe',
            },
            role: {
              type: 'string',
              enum: ['admin', 'staff', 'user'],
              description: 'User role',
              example: 'admin',
            },
            isActive: {
              type: 'boolean',
              description: 'Account status',
              example: true,
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp',
              example: '2025-08-01T10:30:00Z',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
              example: '2025-08-01T10:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2025-08-01T10:30:00Z',
            },
          },
        },

        // Inventory Schemas
        InventoryItem: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1,
            },
            name: {
              type: 'string',
              description: 'Item name',
              example: 'Flour (All-Purpose)',
            },
            sku: {
              type: 'string',
              description: 'Stock Keeping Unit',
              example: 'FLOUR-AP-001',
            },
            description: {
              type: 'string',
              description: 'Item description',
              example: 'High-quality all-purpose flour for baking',
            },
            quantity: {
              type: 'number',
              format: 'float',
              description: 'Current quantity in stock',
              example: 25.5,
            },
            unit: {
              type: 'string',
              description: 'Unit of measurement',
              example: 'kg',
            },
            costPerUnit: {
              type: 'number',
              format: 'float',
              description: 'Cost per unit',
              example: 2.5,
            },
            minStockLevel: {
              type: 'number',
              format: 'float',
              description: 'Minimum stock level for reorder alerts',
              example: 5.0,
            },
            category: {
              type: 'string',
              description: 'Item category',
              example: 'Ingredients',
            },
            supplier: {
              type: 'string',
              description: 'Supplier name',
              example: 'ABC Supplies',
            },
            expiryDate: {
              type: 'string',
              format: 'date',
              description: 'Expiry date',
              example: '2025-12-31',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:30:00Z',
            },
          },
        },
        InventoryItemRequest: {
          type: 'object',
          required: ['name', 'quantity', 'unit'],
          properties: {
            name: {
              type: 'string',
              description: 'Item name',
              example: 'Flour (All-Purpose)',
            },
            sku: {
              type: 'string',
              description: 'Stock Keeping Unit',
              example: 'FLOUR-AP-001',
            },
            description: {
              type: 'string',
              description: 'Item description',
              example: 'High-quality all-purpose flour for baking',
            },
            quantity: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Current quantity in stock',
              example: 25.5,
            },
            unit: {
              type: 'string',
              description: 'Unit of measurement',
              example: 'kg',
            },
            costPerUnit: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Cost per unit',
              example: 2.5,
            },
            minStockLevel: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Minimum stock level for reorder alerts',
              example: 5.0,
            },
            category: {
              type: 'string',
              description: 'Item category',
              example: 'Ingredients',
            },
            supplier: {
              type: 'string',
              description: 'Supplier name',
              example: 'ABC Supplies',
            },
            expiryDate: {
              type: 'string',
              format: 'date',
              description: 'Expiry date',
              example: '2025-12-31',
            },
          },
        },
        StockAdjustment: {
          type: 'object',
          required: ['adjustment', 'reason'],
          properties: {
            adjustment: {
              type: 'number',
              format: 'float',
              description: 'Stock adjustment amount (positive or negative)',
              example: -2.5,
            },
            reason: {
              type: 'string',
              description: 'Reason for stock adjustment',
              example: 'Production usage',
            },
            notes: {
              type: 'string',
              description: 'Additional notes',
              example: 'Used for morning bread production',
            },
          },
        },

        // Recipe Schemas
        Recipe: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1,
            },
            slug: {
              type: 'string',
              description: 'URL-friendly identifier',
              example: 'classic-sourdough-bread',
            },
            title: {
              type: 'string',
              description: 'Recipe title',
              example: 'Classic Sourdough Bread',
            },
            description: {
              type: 'string',
              description: 'Recipe description',
              example:
                'Traditional sourdough bread with a perfect crust and tangy flavor',
            },
            instructions: {
              type: 'string',
              description: 'Detailed instructions (Markdown format)',
              example:
                '## Ingredients\n- 500g flour\n- 375ml water\n\n## Instructions\n1. Mix ingredients...',
            },
            difficulty: {
              type: 'string',
              enum: ['easy', 'medium', 'hard'],
              description: 'Difficulty level',
              example: 'medium',
            },
            prepTime: {
              type: 'integer',
              description: 'Preparation time in minutes',
              example: 30,
            },
            cookTime: {
              type: 'integer',
              description: 'Cooking time in minutes',
              example: 45,
            },
            servings: {
              type: 'integer',
              description: 'Number of servings',
              example: 8,
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Recipe tags',
              example: ['bread', 'sourdough', 'traditional'],
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:30:00Z',
            },
          },
        },
        RecipeRequest: {
          type: 'object',
          required: ['slug', 'title', 'instructions'],
          properties: {
            slug: {
              type: 'string',
              pattern: '^[a-z0-9-]+$',
              description: 'URL-friendly identifier (lowercase, hyphens only)',
              example: 'classic-sourdough-bread',
            },
            title: {
              type: 'string',
              description: 'Recipe title',
              example: 'Classic Sourdough Bread',
            },
            description: {
              type: 'string',
              description: 'Recipe description',
              example:
                'Traditional sourdough bread with a perfect crust and tangy flavor',
            },
            instructions: {
              type: 'string',
              description: 'Detailed instructions (Markdown format)',
              example:
                '## Ingredients\n- 500g flour\n- 375ml water\n\n## Instructions\n1. Mix ingredients...',
            },
            difficulty: {
              type: 'string',
              enum: ['easy', 'medium', 'hard'],
              description: 'Difficulty level',
              example: 'medium',
            },
            prepTime: {
              type: 'integer',
              minimum: 0,
              description: 'Preparation time in minutes',
              example: 30,
            },
            cookTime: {
              type: 'integer',
              minimum: 0,
              description: 'Cooking time in minutes',
              example: 45,
            },
            servings: {
              type: 'integer',
              minimum: 1,
              description: 'Number of servings',
              example: 8,
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Recipe tags',
              example: ['bread', 'sourdough', 'traditional'],
            },
          },
        },

        // Order Schemas
        Order: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1,
            },
            customerName: {
              type: 'string',
              description: 'Customer name',
              example: 'Jane Smith',
            },
            customerPhone: {
              type: 'string',
              description: 'Customer phone number',
              example: '+1234567890',
            },
            customerEmail: {
              type: 'string',
              format: 'email',
              description: 'Customer email',
              example: 'jane.smith@email.com',
            },
            pickupDate: {
              type: 'string',
              format: 'date-time',
              description: 'Scheduled pickup date and time',
              example: '2025-08-02T10:00:00Z',
            },
            status: {
              type: 'string',
              enum: [
                'Pending',
                'Confirmed',
                'In Progress',
                'Ready',
                'Completed',
                'Cancelled',
              ],
              description: 'Order status',
              example: 'Pending',
            },
            notes: {
              type: 'string',
              description: 'Special instructions or notes',
              example: 'Please package separately',
            },
            totalPrice: {
              type: 'number',
              format: 'float',
              description: 'Total order price',
              example: 25.5,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:30:00Z',
            },
          },
        },
        OrderDetail: {
          type: 'object',
          allOf: [
            { $ref: '#/components/schemas/Order' },
            {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  description: 'Order line items',
                  items: {
                    $ref: '#/components/schemas/OrderItem',
                  },
                },
              },
            },
          ],
        },
        OrderItem: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1,
            },
            productId: {
              type: 'string',
              description: 'Product identifier',
              example: '1',
            },
            productName: {
              type: 'string',
              description: 'Product name',
              example: 'Sourdough Bread',
            },
            quantity: {
              type: 'integer',
              minimum: 1,
              description: 'Quantity ordered',
              example: 2,
            },
            unitPrice: {
              type: 'number',
              format: 'float',
              description: 'Price per unit',
              example: 3.5,
            },
          },
        },
        CreateOrderRequest: {
          type: 'object',
          required: [
            'customerName',
            'customerPhone',
            'pickupDate',
            'items',
            'totalPrice',
          ],
          properties: {
            customerName: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Customer name',
              example: 'Jane Smith',
            },
            customerPhone: {
              type: 'string',
              minLength: 7,
              maxLength: 20,
              pattern: '^[\\d\\s\\-\\+\\(\\)]+$',
              description: 'Customer phone number',
              example: '+1234567890',
            },
            customerEmail: {
              type: 'string',
              format: 'email',
              description: 'Customer email (optional)',
              example: 'jane.smith@email.com',
            },
            pickupDate: {
              type: 'string',
              format: 'date-time',
              description:
                'Scheduled pickup date and time (must be in the future)',
              example: '2025-08-05T10:00:00Z',
            },
            status: {
              type: 'string',
              enum: [
                'pending',
                'confirmed',
                'in_progress',
                'ready',
                'completed',
                'cancelled',
              ],
              description: 'Initial order status (defaults to pending)',
              example: 'pending',
            },
            notes: {
              type: 'string',
              maxLength: 1000,
              description: 'Special instructions or notes',
              example: 'Please package separately',
            },
            items: {
              type: 'array',
              minItems: 1,
              description: 'Order line items',
              items: {
                type: 'object',
                required: ['productId', 'productName', 'quantity', 'unitPrice'],
                properties: {
                  productId: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Product ID',
                    example: 1,
                  },
                  productName: {
                    type: 'string',
                    description: 'Product name',
                    example: 'Sourdough Bread',
                  },
                  quantity: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Quantity to order',
                    example: 2,
                  },
                  unitPrice: {
                    type: 'number',
                    format: 'float',
                    minimum: 0,
                    description: 'Price per unit',
                    example: 3.5,
                  },
                },
              },
            },
            totalPrice: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Total order price',
              example: 25.5,
            },
          },
        },
        UpdateOrderRequest: {
          type: 'object',
          properties: {
            customerName: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Customer name',
              example: 'Jane Smith',
            },
            customerPhone: {
              type: 'string',
              minLength: 7,
              maxLength: 20,
              pattern: '^[\\d\\s\\-\\+\\(\\)]+$',
              description: 'Customer phone number',
              example: '+1234567890',
            },
            customerEmail: {
              type: 'string',
              format: 'email',
              description: 'Customer email',
              example: 'jane.smith@email.com',
            },
            pickupDate: {
              type: 'string',
              format: 'date-time',
              description:
                'Scheduled pickup date and time (must be in the future)',
              example: '2025-08-05T10:00:00Z',
            },
            status: {
              type: 'string',
              enum: [
                'pending',
                'confirmed',
                'in_progress',
                'ready',
                'completed',
                'cancelled',
              ],
              description: 'Order status',
              example: 'confirmed',
            },
            notes: {
              type: 'string',
              maxLength: 1000,
              description: 'Special instructions or notes',
              example: 'Please package separately',
            },
            items: {
              type: 'array',
              minItems: 1,
              description: 'Order line items (if updating items)',
              items: {
                type: 'object',
                properties: {
                  productId: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Product ID',
                    example: 1,
                  },
                  productName: {
                    type: 'string',
                    description: 'Product name',
                    example: 'Sourdough Bread',
                  },
                  quantity: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Quantity',
                    example: 2,
                  },
                  unitPrice: {
                    type: 'number',
                    format: 'float',
                    minimum: 0,
                    description: 'Price per unit',
                    example: 3.5,
                  },
                },
              },
            },
            totalPrice: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Total order price',
              example: 25.5,
            },
          },
        },

        // Notification Schemas
        Notification: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1,
            },
            title: {
              type: 'string',
              description: 'Notification title',
              example: 'Low Stock Alert',
            },
            message: {
              type: 'string',
              description: 'Notification message',
              example: 'Flour stock is running low (2.5kg remaining)',
            },
            type: {
              type: 'string',
              enum: ['info', 'success', 'warning', 'error'],
              description: 'Notification type',
              example: 'warning',
            },
            category: {
              type: 'string',
              enum: ['staff', 'order', 'system', 'inventory', 'general'],
              description: 'Notification category',
              example: 'inventory',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Priority level',
              example: 'high',
            },
            read: {
              type: 'boolean',
              description: 'Read status',
              example: false,
            },
            archived: {
              type: 'boolean',
              description: 'Archived status',
              example: false,
            },
            userId: {
              type: 'integer',
              description: 'Associated user ID',
              example: 1,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:30:00Z',
            },
          },
        },

        // Standard Response Schemas
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully',
            },
            data: {
              type: 'object',
              description: 'Response data (varies by endpoint)',
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'array',
              items: {
                type: 'object',
              },
              description: 'Array of results',
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'integer',
                  example: 1,
                },
                limit: {
                  type: 'integer',
                  example: 20,
                },
                total: {
                  type: 'integer',
                  example: 150,
                },
                pages: {
                  type: 'integer',
                  example: 8,
                },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            currentPage: {
              type: 'integer',
              description: 'Current page number',
              example: 1,
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages',
              example: 5,
            },
            totalItems: {
              type: 'integer',
              description: 'Total number of items',
              example: 47,
            },
            itemsPerPage: {
              type: 'integer',
              description: 'Number of items per page',
              example: 10,
            },
          },
        },

        // Chat Schemas
        ChatMessage: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique message identifier',
              example: 1,
            },
            message: {
              type: 'string',
              description: 'Message content',
              example: 'Good morning everyone!',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Message timestamp',
              example: '2025-08-04T08:00:00.000Z',
            },
            UserId: {
              type: 'integer',
              description: 'ID of the user who sent the message',
              example: 3,
            },
            User: {
              type: 'object',
              properties: {
                username: {
                  type: 'string',
                  description: 'Username of the message sender',
                  example: 'john.doe',
                },
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-04T08:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-04T08:00:00.000Z',
            },
          },
        },
        CreateChatMessageRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: {
              type: 'string',
              description: 'Message content',
              minLength: 1,
              maxLength: 1000,
              example: "Ready for today's production",
            },
          },
        },

        // Notification Schemas
        NotificationDetail: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique notification identifier',
              example: 42,
            },
            title: {
              type: 'string',
              description: 'Notification title',
              example: 'New Order Received',
            },
            message: {
              type: 'string',
              description: 'Notification message',
              example: 'You have received a new order from John Doe',
            },
            type: {
              type: 'string',
              enum: ['info', 'warning', 'error', 'success'],
              description: 'Notification type',
              example: 'info',
            },
            category: {
              type: 'string',
              enum: ['general', 'order', 'staff', 'inventory', 'system'],
              description: 'Notification category',
              example: 'order',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Priority level',
              example: 'high',
            },
            read: {
              type: 'boolean',
              description: 'Whether the notification has been read',
              example: false,
            },
            archived: {
              type: 'boolean',
              description: 'Whether the notification is archived',
              example: false,
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata for the notification',
              additionalProperties: true,
              example: {
                orderId: 123,
                customerName: 'John Doe',
              },
            },
            userId: {
              type: 'integer',
              description: 'ID of the user this notification belongs to',
              example: 5,
            },
            User: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  example: 5,
                },
                username: {
                  type: 'string',
                  example: 'john.doe',
                },
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-04T10:30:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-04T10:30:00Z',
            },
          },
        },
        NotificationListResponse: {
          type: 'object',
          properties: {
            notifications: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/NotificationDetail',
              },
            },
            stats: {
              type: 'object',
              properties: {
                total: {
                  type: 'integer',
                  description: 'Total number of notifications',
                  example: 45,
                },
                unread: {
                  type: 'integer',
                  description: 'Number of unread notifications',
                  example: 12,
                },
                byPriority: {
                  type: 'object',
                  description: 'Count of notifications by priority',
                  properties: {
                    low: {
                      type: 'integer',
                      example: 20,
                    },
                    medium: {
                      type: 'integer',
                      example: 15,
                    },
                    high: {
                      type: 'integer',
                      example: 8,
                    },
                    critical: {
                      type: 'integer',
                      example: 2,
                    },
                  },
                },
              },
            },
          },
        },
        CreateNotificationRequest: {
          type: 'object',
          required: ['title', 'message'],
          properties: {
            title: {
              type: 'string',
              description: 'Notification title',
              minLength: 1,
              maxLength: 100,
              example: 'Low Stock Alert',
            },
            message: {
              type: 'string',
              description: 'Notification message',
              minLength: 1,
              maxLength: 500,
              example: 'Croissants are running low - only 5 remaining',
            },
            type: {
              type: 'string',
              enum: ['info', 'warning', 'error', 'success'],
              description: 'Notification type',
              default: 'info',
              example: 'warning',
            },
            category: {
              type: 'string',
              enum: ['general', 'order', 'staff', 'inventory', 'system'],
              description: 'Notification category',
              default: 'general',
              example: 'inventory',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Priority level',
              default: 'medium',
              example: 'high',
            },
            userId: {
              type: 'integer',
              description: 'Target user ID (optional, defaults to sender)',
              example: 3,
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata',
              additionalProperties: true,
              example: {
                productId: 'CR001',
                currentStock: 5,
              },
            },
          },
        },
        BulkNotificationRequest: {
          type: 'object',
          required: ['notifications'],
          properties: {
            notifications: {
              type: 'array',
              description: 'Array of notifications to create',
              minItems: 1,
              maxItems: 100,
              items: {
                type: 'object',
                required: ['title', 'message'],
                properties: {
                  title: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 100,
                  },
                  message: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 500,
                  },
                  type: {
                    type: 'string',
                    enum: ['info', 'warning', 'error', 'success'],
                  },
                  category: {
                    type: 'string',
                    enum: ['general', 'order', 'staff', 'inventory', 'system'],
                  },
                  priority: {
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'critical'],
                  },
                  userId: {
                    type: 'integer',
                    minimum: 1,
                  },
                  metadata: {
                    type: 'object',
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },

        // Workflow Schemas
        WorkflowSummary: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Workflow identifier',
              example: 'bread-production',
            },
            name: {
              type: 'string',
              description: 'Human-readable workflow name',
              example: 'Bread Production Workflow',
            },
            version: {
              type: 'string',
              description: 'Workflow version',
              example: '1.0',
            },
            description: {
              type: 'string',
              description: 'Brief description of the workflow',
              example: 'Standard workflow for daily bread production',
            },
            steps: {
              type: 'integer',
              description: 'Number of steps in the workflow',
              example: 12,
            },
          },
        },
        WorkflowDetail: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Workflow identifier',
              example: 'bread-production',
            },
            name: {
              type: 'string',
              description: 'Human-readable workflow name',
              example: 'Bread Production Workflow',
            },
            version: {
              type: 'string',
              description: 'Workflow version',
              example: '1.0',
            },
            description: {
              type: 'string',
              description: 'Detailed description',
              example:
                'Complete workflow for daily bread production including preparation, baking, and quality control',
            },
            steps: {
              type: 'array',
              description: 'Workflow steps',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    example: 'step-1',
                  },
                  name: {
                    type: 'string',
                    example: 'Prepare ingredients',
                  },
                  description: {
                    type: 'string',
                    example:
                      'Measure and prepare all ingredients according to recipe',
                  },
                  duration: {
                    type: 'string',
                    description: 'Estimated duration',
                    example: '30 minutes',
                  },
                  requirements: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                    example: ['Scale', 'Mixing bowls', 'Flour', 'Yeast'],
                  },
                },
              },
            },
            metadata: {
              type: 'object',
              description: 'Additional workflow metadata',
              additionalProperties: true,
            },
          },
        },
        WorkflowStatistics: {
          type: 'object',
          properties: {
            totalWorkflows: {
              type: 'integer',
              description: 'Total number of workflows',
              example: 12,
            },
            totalSteps: {
              type: 'integer',
              description: 'Total number of steps across all workflows',
              example: 156,
            },
            averageStepsPerWorkflow: {
              type: 'integer',
              description: 'Average number of steps per workflow',
              example: 13,
            },
            workflowsByVersion: {
              type: 'object',
              description: 'Count of workflows grouped by version',
              additionalProperties: {
                type: 'integer',
              },
              example: {
                '1.0': 8,
                1.1: 3,
                '2.0': 1,
              },
            },
          },
        },
        WorkflowValidationRequest: {
          type: 'object',
          description: 'Workflow structure to validate',
          required: ['name', 'steps'],
          properties: {
            name: {
              type: 'string',
              description: 'Workflow name',
              example: 'Custom Bread Workflow',
            },
            version: {
              type: 'string',
              description: 'Workflow version',
              example: '1.0',
            },
            description: {
              type: 'string',
              description: 'Workflow description',
              example: 'Custom workflow for special bread orders',
            },
            steps: {
              type: 'array',
              description: 'Workflow steps',
              items: {
                type: 'object',
                required: ['name'],
                properties: {
                  id: {
                    type: 'string',
                  },
                  name: {
                    type: 'string',
                  },
                  description: {
                    type: 'string',
                  },
                  duration: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },

        // Production Schemas
        ProductionSchedule: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique schedule identifier',
              example: 1,
            },
            scheduleDate: {
              type: 'string',
              format: 'date',
              description: 'Date of the production schedule',
              example: '2025-08-15',
            },
            scheduleType: {
              type: 'string',
              enum: ['daily', 'weekly', 'special'],
              description: 'Type of schedule',
              example: 'daily',
            },
            status: {
              type: 'string',
              enum: ['draft', 'planned', 'active', 'completed', 'cancelled'],
              description: 'Schedule status',
              example: 'planned',
            },
            workdayStartTime: {
              type: 'string',
              format: 'time',
              example: '06:00:00',
            },
            workdayEndTime: {
              type: 'string',
              format: 'time',
              example: '18:00:00',
            },
            availableStaffIds: {
              type: 'array',
              items: {
                type: 'integer',
              },
              example: [1, 2, 3],
            },
            staffShifts: {
              type: 'object',
              description: 'Staff shift assignments',
              example: {
                1: { start: '06:00', end: '14:00', role: 'baker' },
                2: { start: '10:00', end: '18:00', role: 'assistant' },
              },
            },
            availableEquipment: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['oven_1', 'mixer_large', 'proofer_1'],
            },
            dailyTargets: {
              type: 'object',
              description: 'Production targets by category',
              example: {
                bread: 50,
                pastries: 30,
                cakes: 10,
              },
            },
            planningNotes: {
              type: 'string',
              example: 'Special order for wedding cake',
            },
            dailyNotes: {
              type: 'string',
              example: 'Oven 2 is under maintenance',
            },
            specialRequests: {
              type: 'array',
              items: {
                type: 'object',
              },
              example: [{ type: 'custom_order', details: 'Gluten-free bread' }],
            },
            environmentalConditions: {
              type: 'object',
              example: { temperature: 22, humidity: 65 },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:00:00Z',
            },
          },
        },
        ProductionBatch: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique batch identifier',
              example: 1,
            },
            name: {
              type: 'string',
              description: 'Batch name',
              example: 'Sourdough Batch #15',
            },
            workflowId: {
              type: 'string',
              description: 'Associated workflow identifier',
              example: 'sourdough_bread',
            },
            productId: {
              type: 'integer',
              description: 'Associated product ID',
              example: 5,
            },
            status: {
              type: 'string',
              enum: [
                'pending',
                'ready',
                'in_progress',
                'paused',
                'completed',
                'cancelled',
                'failed',
              ],
              description: 'Current batch status',
              example: 'in_progress',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Batch priority',
              example: 'high',
            },
            plannedStartTime: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-15T06:00:00Z',
            },
            actualStartTime: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-15T06:15:00Z',
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-15T09:30:00Z',
            },
            plannedQuantity: {
              type: 'integer',
              example: 20,
            },
            actualQuantity: {
              type: 'integer',
              example: 18,
            },
            unit: {
              type: 'string',
              example: 'loaves',
            },
            assignedStaffIds: {
              type: 'array',
              items: {
                type: 'integer',
              },
              example: [1, 3],
            },
            requiredEquipment: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['oven_1', 'mixer_large'],
            },
            notes: {
              type: 'string',
              example: 'Use starter from yesterday',
            },
            hasIssues: {
              type: 'boolean',
              example: false,
            },
            issues: {
              type: 'array',
              items: {
                type: 'object',
              },
              example: [],
            },
          },
        },
        ProductionStep: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique step identifier',
              example: 45,
            },
            batchId: {
              type: 'integer',
              description: 'Associated batch ID',
              example: 15,
            },
            workflowStepId: {
              type: 'string',
              description: 'Reference to workflow step',
              example: 'step-3',
            },
            name: {
              type: 'string',
              description: 'Step name',
              example: 'First rise',
            },
            description: {
              type: 'string',
              description: 'Step description',
              example: 'Let dough rise for 2 hours at room temperature',
            },
            status: {
              type: 'string',
              enum: [
                'pending',
                'ready',
                'in_progress',
                'waiting',
                'completed',
                'skipped',
                'failed',
              ],
              description: 'Current step status',
              example: 'in_progress',
            },
            progress: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Progress percentage',
              example: 75,
            },
            plannedDuration: {
              type: 'integer',
              description: 'Planned duration in minutes',
              example: 120,
            },
            actualDuration: {
              type: 'integer',
              description: 'Actual duration in minutes',
              example: 115,
            },
            plannedParameters: {
              type: 'object',
              description: 'Expected parameters',
              example: {
                temperature: 22,
                humidity: 75,
              },
            },
            actualParameters: {
              type: 'object',
              description: 'Actual parameters recorded',
              example: {
                temperature: 23,
                humidity: 72,
              },
            },
            qualityResults: {
              type: 'object',
              description: 'Quality check results',
              example: {
                texture: 'good',
                rise: 'excellent',
              },
            },
            qualityScore: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Overall quality score',
              example: 92,
            },
            notes: {
              type: 'string',
              example: 'Dough rose perfectly',
            },
            hasIssues: {
              type: 'boolean',
              example: false,
            },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    example: 'quality',
                  },
                  description: {
                    type: 'string',
                    example: 'Temperature too high',
                  },
                  severity: {
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'critical'],
                    example: 'medium',
                  },
                },
              },
            },
            startedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-15T07:00:00Z',
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-15T09:00:00Z',
            },
          },
        },

        // Analytics Schemas
        RevenueData: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              format: 'date',
              description: 'Date for the revenue data point',
              example: '2025-08-15',
            },
            revenue: {
              type: 'number',
              format: 'float',
              description: 'Total revenue for the date',
              example: 1234.56,
            },
            transactionCount: {
              type: 'integer',
              description: 'Number of transactions for the date',
              example: 45,
            },
          },
        },
        ProductPerformance: {
          type: 'object',
          properties: {
            productId: {
              type: 'string',
              description: 'Product identifier',
              example: 'BR001',
            },
            productName: {
              type: 'string',
              description: 'Product name',
              example: 'Sourdough Bread',
            },
            quantitySold: {
              type: 'integer',
              description: 'Total quantity sold',
              example: 125,
            },
            revenue: {
              type: 'number',
              format: 'float',
              description: 'Total revenue generated',
              example: 625.0,
            },
            avgPrice: {
              type: 'number',
              format: 'float',
              description: 'Average selling price',
              example: 5.0,
            },
            rank: {
              type: 'integer',
              description: 'Performance rank',
              example: 1,
            },
          },
        },
        CashierPerformance: {
          type: 'object',
          properties: {
            cashierId: {
              type: 'string',
              description: 'Cashier identifier',
              example: '5',
            },
            cashierName: {
              type: 'string',
              description: 'Cashier name',
              example: 'John Doe',
            },
            transactionCount: {
              type: 'integer',
              description: 'Total number of transactions processed',
              example: 150,
            },
            totalRevenue: {
              type: 'number',
              format: 'float',
              description: 'Total revenue handled',
              example: 3456.78,
            },
            avgTransactionValue: {
              type: 'number',
              format: 'float',
              description: 'Average transaction value',
              example: 23.05,
            },
            avgTransactionTime: {
              type: 'number',
              format: 'float',
              description: 'Average transaction time in seconds',
              example: 45.2,
            },
            errorRate: {
              type: 'number',
              format: 'float',
              description: 'Error rate percentage',
              example: 0.5,
            },
          },
        },
        PaymentMethodBreakdown: {
          type: 'object',
          properties: {
            cash: {
              type: 'object',
              properties: {
                count: {
                  type: 'integer',
                  example: 120,
                },
                revenue: {
                  type: 'number',
                  format: 'float',
                  example: 2345.6,
                },
                percentage: {
                  type: 'number',
                  format: 'float',
                  example: 45.5,
                },
              },
            },
            card: {
              type: 'object',
              properties: {
                count: {
                  type: 'integer',
                  example: 85,
                },
                revenue: {
                  type: 'number',
                  format: 'float',
                  example: 1890.4,
                },
                percentage: {
                  type: 'number',
                  format: 'float',
                  example: 36.7,
                },
              },
            },
            mobile: {
              type: 'object',
              properties: {
                count: {
                  type: 'integer',
                  example: 45,
                },
                revenue: {
                  type: 'number',
                  format: 'float',
                  example: 920.0,
                },
                percentage: {
                  type: 'number',
                  format: 'float',
                  example: 17.8,
                },
              },
            },
          },
        },
        AnalyticsSummary: {
          type: 'object',
          properties: {
            totalRevenue: {
              type: 'number',
              format: 'float',
              description: 'Total revenue for the period',
              example: 45678.9,
            },
            totalTransactions: {
              type: 'integer',
              description: 'Total number of transactions',
              example: 1234,
            },
            avgTransactionValue: {
              type: 'number',
              format: 'float',
              description: 'Average transaction value',
              example: 37.05,
            },
            topProducts: {
              type: 'array',
              description: 'Top performing products',
              items: {
                $ref: '#/components/schemas/ProductPerformance',
              },
            },
            paymentBreakdown: {
              $ref: '#/components/schemas/PaymentMethodBreakdown',
            },
            revenueGrowth: {
              type: 'number',
              format: 'float',
              description:
                'Revenue growth percentage compared to previous period',
              example: 12.5,
            },
            peakHours: {
              type: 'array',
              description: 'Peak business hours',
              items: {
                type: 'object',
                properties: {
                  hour: {
                    type: 'integer',
                    example: 9,
                  },
                  transactionCount: {
                    type: 'integer',
                    example: 145,
                  },
                },
              },
            },
          },
        },

        // Error Response Schemas
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              description: 'Error message',
              example: 'An error occurred',
            },
            message: {
              type: 'string',
              description: 'Detailed error message',
              example: 'The requested resource could not be found',
            },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Validation failed',
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    example: 'email',
                  },
                  message: {
                    type: 'string',
                    example: 'Invalid email format',
                  },
                  value: {
                    type: 'string',
                    example: 'invalid-email',
                  },
                },
              },
            },
          },
        },
        UnauthorizedError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Unauthorized',
            },
            message: {
              type: 'string',
              example: 'Authentication required. Please provide a valid token.',
            },
          },
        },
        ForbiddenError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Forbidden',
            },
            message: {
              type: 'string',
              example: 'Insufficient permissions to access this resource',
            },
          },
        },
        NotFoundError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Not Found',
            },
            message: {
              type: 'string',
              example: 'The requested resource was not found',
            },
          },
        },

        // Staff Management Schemas
        StaffMember: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1,
            },
            username: {
              type: 'string',
              description: 'Username',
              example: 'jbaker01',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address',
              example: 'john.baker@bakery.local',
            },
            firstName: {
              type: 'string',
              description: 'First name',
              example: 'John',
            },
            lastName: {
              type: 'string',
              description: 'Last name',
              example: 'Baker',
            },
            phone: {
              type: 'string',
              description: 'Phone number',
              example: '+1234567890',
            },
            role: {
              type: 'string',
              enum: ['manager', 'baker', 'assistant', 'cashier', 'delivery'],
              description: 'Staff role',
              example: 'baker',
            },
            schedule: {
              type: 'object',
              description: 'Work schedule',
              example: {
                monday: '06:00-14:00',
                tuesday: '06:00-14:00',
                wednesday: '06:00-14:00',
                thursday: '06:00-14:00',
                friday: '06:00-14:00',
              },
            },
            isActive: {
              type: 'boolean',
              description: 'Account status',
              example: true,
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp',
              example: '2025-08-01T10:30:00Z',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
              example: '2025-08-01T10:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2025-08-01T10:30:00Z',
            },
          },
        },
        CreateStaffRequest: {
          type: 'object',
          required: ['firstName', 'lastName', 'email', 'phone', 'role'],
          properties: {
            firstName: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
              pattern: "^[a-zA-Z\\s-']+$",
              description: 'First name',
              example: 'John',
            },
            lastName: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
              pattern: "^[a-zA-Z\\s-']+$",
              description: 'Last name',
              example: 'Baker',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Valid email address',
              example: 'john.baker@bakery.local',
            },
            phone: {
              type: 'string',
              minLength: 7,
              maxLength: 20,
              pattern: '^[\\d\\s\\-\\+\\(\\)]+$',
              description: 'Phone number',
              example: '+1234567890',
            },
            role: {
              type: 'string',
              enum: ['manager', 'baker', 'assistant', 'cashier', 'delivery'],
              description: 'Staff role',
              example: 'baker',
            },
            schedule: {
              type: 'object',
              description: 'Work schedule (optional)',
              example: {
                monday: '06:00-14:00',
                tuesday: '06:00-14:00',
                wednesday: '06:00-14:00',
                thursday: '06:00-14:00',
                friday: '06:00-14:00',
              },
            },
            isActive: {
              type: 'boolean',
              description: 'Account status (optional)',
              default: true,
              example: true,
            },
          },
        },
        UpdateStaffRequest: {
          type: 'object',
          properties: {
            firstName: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
              pattern: "^[a-zA-Z\\s-']+$",
              description: 'First name',
              example: 'John',
            },
            lastName: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
              pattern: "^[a-zA-Z\\s-']+$",
              description: 'Last name',
              example: 'Baker',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Valid email address',
              example: 'john.baker@bakery.local',
            },
            phone: {
              type: 'string',
              minLength: 7,
              maxLength: 20,
              pattern: '^[\\d\\s\\-\\+\\(\\)]+$',
              description: 'Phone number',
              example: '+1234567890',
            },
            role: {
              type: 'string',
              enum: ['manager', 'baker', 'assistant', 'cashier', 'delivery'],
              description: 'Staff role',
              example: 'baker',
            },
            schedule: {
              type: 'object',
              description: 'Work schedule',
              example: {
                monday: '06:00-14:00',
                tuesday: '06:00-14:00',
                wednesday: '06:00-14:00',
                thursday: '06:00-14:00',
                friday: '06:00-14:00',
              },
            },
            isActive: {
              type: 'boolean',
              description: 'Account status',
              example: true,
            },
          },
        },

        // Cash Management Schemas
        CashEntry: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1,
            },
            amount: {
              type: 'number',
              format: 'float',
              description: 'Cash amount',
              example: 1250.5,
            },
            date: {
              type: 'string',
              format: 'date',
              description: 'Date of cash entry',
              example: '2025-08-03',
            },
            notes: {
              type: 'string',
              description: 'Optional notes',
              example: 'Good sales day',
            },
            UserId: {
              type: 'integer',
              description: 'User ID who created the entry',
              example: 1,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
              example: '2025-08-03T10:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2025-08-03T10:00:00Z',
            },
          },
        },
        CreateCashEntryRequest: {
          type: 'object',
          required: ['amount'],
          properties: {
            amount: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Cash amount (non-negative)',
              example: 1250.5,
            },
            date: {
              type: 'string',
              format: 'date',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              description:
                'Date of cash entry (YYYY-MM-DD) - defaults to today if not provided',
              example: '2025-08-03',
            },
            notes: {
              type: 'string',
              maxLength: 500,
              description: 'Optional notes (max 500 characters)',
              example: 'Good sales day',
            },
          },
        },
        UpdateCashEntryRequest: {
          type: 'object',
          properties: {
            amount: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Cash amount (non-negative)',
              example: 1250.5,
            },
            date: {
              type: 'string',
              format: 'date',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              description: 'Date of cash entry (YYYY-MM-DD)',
              example: '2025-08-03',
            },
            notes: {
              type: 'string',
              maxLength: 500,
              description: 'Optional notes (max 500 characters)',
              example: 'Good sales day',
            },
          },
        },
        CashStatistics: {
          type: 'object',
          properties: {
            totalAmount: {
              type: 'number',
              description: 'Total cash amount for the period',
              example: 15750.5,
            },
            averageAmount: {
              type: 'number',
              description: 'Average daily cash amount',
              example: 525.02,
            },
            entryCount: {
              type: 'integer',
              description: 'Number of cash entries',
              example: 30,
            },
            latestEntry: {
              type: 'object',
              nullable: true,
              properties: {
                amount: {
                  type: 'number',
                  example: 725.5,
                },
                date: {
                  type: 'string',
                  format: 'date',
                  example: '2025-08-31',
                },
              },
            },
            dateRange: {
              type: 'object',
              properties: {
                startDate: {
                  type: 'string',
                  format: 'date',
                  nullable: true,
                  example: '2025-08-01',
                },
                endDate: {
                  type: 'string',
                  format: 'date',
                  nullable: true,
                  example: '2025-08-31',
                },
              },
            },
          },
        },

        HealthCheckResult: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy'],
              description: 'Health status of the checked component',
              example: 'healthy',
            },
            message: {
              type: 'string',
              description: 'Optional message describing the health status',
              example: 'Database connection failed',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Time when the check was performed',
              example: '2025-08-15T10:30:00.000Z',
            },
          },
          required: ['status'],
        },

        RateLimitError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Too Many Requests',
            },
            message: {
              type: 'string',
              example: 'Rate limit exceeded. Please try again later.',
            },
            retryAfter: {
              type: 'integer',
              description: 'Retry after seconds',
              example: 60,
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Inventory',
        description: 'Inventory management and stock tracking',
      },
      {
        name: 'Recipes',
        description: 'Recipe management and viewing',
      },
      {
        name: 'Orders',
        description: 'Order management and baking lists',
      },
      {
        name: 'Notifications',
        description: 'Notification system and preferences',
      },
      {
        name: 'Staff',
        description: 'Staff management (admin only)',
      },
      {
        name: 'Workflows',
        description: 'Production workflow management',
      },
      {
        name: 'Dashboard',
        description: 'Analytics and dashboard data',
      },
      {
        name: 'Financial',
        description: 'Cash management and financial tracking',
      },
      {
        name: 'Communication',
        description: 'Chat and email communication',
      },
      {
        name: 'Health',
        description: 'Health check and monitoring endpoints',
      },
    ],
  },
  apis: [
    './routes/*.js', // Path to the API docs
  ],
}

const swaggerSpec = swaggerJSDoc(options)

module.exports = {
  swaggerSpec,
  options,
}
