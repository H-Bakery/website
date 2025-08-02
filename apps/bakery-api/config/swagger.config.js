const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bakery Management System API',
      version: '1.0.0',
      description: 'Comprehensive API for managing bakery operations including inventory, recipes, orders, staff, and production workflows',
      contact: {
        name: 'Bakery Management System',
        email: 'support@bakery.local'
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'http://localhost:3000',
        description: 'Frontend server (for reference)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token authentication. Use the /api/auth/login endpoint to obtain a token.'
        }
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
              example: 'admin'
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'Password for authentication',
              example: 'securepassword'
            }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['username', 'password', 'email', 'firstName', 'lastName'],
          properties: {
            username: {
              type: 'string',
              description: 'Unique username',
              example: 'newuser'
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 6,
              description: 'Password (minimum 6 characters)',
              example: 'password123'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Valid email address',
              example: 'newuser@bakery.local'
            },
            firstName: {
              type: 'string',
              description: 'First name',
              example: 'Jane'
            },
            lastName: {
              type: 'string',
              description: 'Last name',
              example: 'Doe'
            },
            role: {
              type: 'string',
              enum: ['admin', 'staff', 'user'],
              description: 'User role',
              example: 'staff'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Login successful'
            },
            token: {
              type: 'string',
              description: 'JWT authentication token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            user: {
              $ref: '#/components/schemas/User'
            }
          }
        },

        // User Schema
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1
            },
            username: {
              type: 'string',
              description: 'Username',
              example: 'admin'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address',
              example: 'admin@bakery.local'
            },
            firstName: {
              type: 'string',
              description: 'First name',
              example: 'John'
            },
            lastName: {
              type: 'string',
              description: 'Last name',
              example: 'Doe'
            },
            role: {
              type: 'string',
              enum: ['admin', 'staff', 'user'],
              description: 'User role',
              example: 'admin'
            },
            isActive: {
              type: 'boolean',
              description: 'Account status',
              example: true
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp',
              example: '2025-08-01T10:30:00Z'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
              example: '2025-08-01T10:00:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2025-08-01T10:30:00Z'
            }
          }
        },

        // Inventory Schemas
        InventoryItem: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1
            },
            name: {
              type: 'string',
              description: 'Item name',
              example: 'Flour (All-Purpose)'
            },
            sku: {
              type: 'string',
              description: 'Stock Keeping Unit',
              example: 'FLOUR-AP-001'
            },
            description: {
              type: 'string',
              description: 'Item description',
              example: 'High-quality all-purpose flour for baking'
            },
            quantity: {
              type: 'number',
              format: 'float',
              description: 'Current quantity in stock',
              example: 25.5
            },
            unit: {
              type: 'string',
              description: 'Unit of measurement',
              example: 'kg'
            },
            costPerUnit: {
              type: 'number',
              format: 'float',
              description: 'Cost per unit',
              example: 2.50
            },
            minStockLevel: {
              type: 'number',
              format: 'float',
              description: 'Minimum stock level for reorder alerts',
              example: 5.0
            },
            category: {
              type: 'string',
              description: 'Item category',
              example: 'Ingredients'
            },
            supplier: {
              type: 'string',
              description: 'Supplier name',
              example: 'ABC Supplies'
            },
            expiryDate: {
              type: 'string',
              format: 'date',
              description: 'Expiry date',
              example: '2025-12-31'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:00:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:30:00Z'
            }
          }
        },
        InventoryItemRequest: {
          type: 'object',
          required: ['name', 'quantity', 'unit'],
          properties: {
            name: {
              type: 'string',
              description: 'Item name',
              example: 'Flour (All-Purpose)'
            },
            sku: {
              type: 'string',
              description: 'Stock Keeping Unit',
              example: 'FLOUR-AP-001'
            },
            description: {
              type: 'string',
              description: 'Item description',
              example: 'High-quality all-purpose flour for baking'
            },
            quantity: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Current quantity in stock',
              example: 25.5
            },
            unit: {
              type: 'string',
              description: 'Unit of measurement',
              example: 'kg'
            },
            costPerUnit: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Cost per unit',
              example: 2.50
            },
            minStockLevel: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Minimum stock level for reorder alerts',
              example: 5.0
            },
            category: {
              type: 'string',
              description: 'Item category',
              example: 'Ingredients'
            },
            supplier: {
              type: 'string',
              description: 'Supplier name',
              example: 'ABC Supplies'
            },
            expiryDate: {
              type: 'string',
              format: 'date',
              description: 'Expiry date',
              example: '2025-12-31'
            }
          }
        },
        StockAdjustment: {
          type: 'object',
          required: ['adjustment', 'reason'],
          properties: {
            adjustment: {
              type: 'number',
              format: 'float',
              description: 'Stock adjustment amount (positive or negative)',
              example: -2.5
            },
            reason: {
              type: 'string',
              description: 'Reason for stock adjustment',
              example: 'Production usage'
            },
            notes: {
              type: 'string',
              description: 'Additional notes',
              example: 'Used for morning bread production'
            }
          }
        },

        // Recipe Schemas
        Recipe: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1
            },
            slug: {
              type: 'string',
              description: 'URL-friendly identifier',
              example: 'classic-sourdough-bread'
            },
            title: {
              type: 'string',
              description: 'Recipe title',
              example: 'Classic Sourdough Bread'
            },
            description: {
              type: 'string',
              description: 'Recipe description',
              example: 'Traditional sourdough bread with a perfect crust and tangy flavor'
            },
            instructions: {
              type: 'string',
              description: 'Detailed instructions (Markdown format)',
              example: '## Ingredients\n- 500g flour\n- 375ml water\n\n## Instructions\n1. Mix ingredients...'
            },
            difficulty: {
              type: 'string',
              enum: ['easy', 'medium', 'hard'],
              description: 'Difficulty level',
              example: 'medium'
            },
            prepTime: {
              type: 'integer',
              description: 'Preparation time in minutes',
              example: 30
            },
            cookTime: {
              type: 'integer',
              description: 'Cooking time in minutes',
              example: 45
            },
            servings: {
              type: 'integer',
              description: 'Number of servings',
              example: 8
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Recipe tags',
              example: ['bread', 'sourdough', 'traditional']
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:00:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:30:00Z'
            }
          }
        },
        RecipeRequest: {
          type: 'object',
          required: ['slug', 'title', 'instructions'],
          properties: {
            slug: {
              type: 'string',
              pattern: '^[a-z0-9-]+$',
              description: 'URL-friendly identifier (lowercase, hyphens only)',
              example: 'classic-sourdough-bread'
            },
            title: {
              type: 'string',
              description: 'Recipe title',
              example: 'Classic Sourdough Bread'
            },
            description: {
              type: 'string',
              description: 'Recipe description',
              example: 'Traditional sourdough bread with a perfect crust and tangy flavor'
            },
            instructions: {
              type: 'string',
              description: 'Detailed instructions (Markdown format)',
              example: '## Ingredients\n- 500g flour\n- 375ml water\n\n## Instructions\n1. Mix ingredients...'
            },
            difficulty: {
              type: 'string',
              enum: ['easy', 'medium', 'hard'],
              description: 'Difficulty level',
              example: 'medium'
            },
            prepTime: {
              type: 'integer',
              minimum: 0,
              description: 'Preparation time in minutes',
              example: 30
            },
            cookTime: {
              type: 'integer',
              minimum: 0,
              description: 'Cooking time in minutes',
              example: 45
            },
            servings: {
              type: 'integer',
              minimum: 1,
              description: 'Number of servings',
              example: 8
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Recipe tags',
              example: ['bread', 'sourdough', 'traditional']
            }
          }
        },

        // Order Schemas
        Order: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1
            },
            customerName: {
              type: 'string',
              description: 'Customer name',
              example: 'Jane Smith'
            },
            customerPhone: {
              type: 'string',
              description: 'Customer phone number',
              example: '+1234567890'
            },
            customerEmail: {
              type: 'string',
              format: 'email',
              description: 'Customer email',
              example: 'jane.smith@email.com'
            },
            pickupDate: {
              type: 'string',
              format: 'date-time',
              description: 'Scheduled pickup date and time',
              example: '2025-08-02T10:00:00Z'
            },
            status: {
              type: 'string',
              enum: ['Pending', 'Confirmed', 'In Progress', 'Ready', 'Completed', 'Cancelled'],
              description: 'Order status',
              example: 'Pending'
            },
            notes: {
              type: 'string',
              description: 'Special instructions or notes',
              example: 'Please package separately'
            },
            totalPrice: {
              type: 'number',
              format: 'float',
              description: 'Total order price',
              example: 25.50
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:00:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:30:00Z'
            }
          }
        },

        // Notification Schemas
        Notification: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique identifier',
              example: 1
            },
            title: {
              type: 'string',
              description: 'Notification title',
              example: 'Low Stock Alert'
            },
            message: {
              type: 'string',
              description: 'Notification message',
              example: 'Flour stock is running low (2.5kg remaining)'
            },
            type: {
              type: 'string',
              enum: ['info', 'success', 'warning', 'error'],
              description: 'Notification type',
              example: 'warning'
            },
            category: {
              type: 'string',
              enum: ['staff', 'order', 'system', 'inventory', 'general'],
              description: 'Notification category',
              example: 'inventory'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Priority level',
              example: 'high'
            },
            read: {
              type: 'boolean',
              description: 'Read status',
              example: false
            },
            archived: {
              type: 'boolean',
              description: 'Archived status',
              example: false
            },
            userId: {
              type: 'integer',
              description: 'Associated user ID',
              example: 1
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:00:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-08-01T10:30:00Z'
            }
          }
        },

        // Standard Response Schemas
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully'
            },
            data: {
              type: 'object',
              description: 'Response data (varies by endpoint)'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'array',
              items: {
                type: 'object'
              },
              description: 'Array of results'
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'integer',
                  example: 1
                },
                limit: {
                  type: 'integer',
                  example: 20
                },
                total: {
                  type: 'integer',
                  example: 150
                },
                pages: {
                  type: 'integer',
                  example: 8
                }
              }
            }
          }
        },

        // Error Response Schemas
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Error message',
              example: 'An error occurred'
            },
            message: {
              type: 'string',
              description: 'Detailed error message',
              example: 'The requested resource could not be found'
            }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Validation failed'
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    example: 'email'
                  },
                  message: {
                    type: 'string',
                    example: 'Invalid email format'
                  },
                  value: {
                    type: 'string',
                    example: 'invalid-email'
                  }
                }
              }
            }
          }
        },
        UnauthorizedError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Unauthorized'
            },
            message: {
              type: 'string',
              example: 'Authentication required. Please provide a valid token.'
            }
          }
        },
        ForbiddenError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Forbidden'
            },
            message: {
              type: 'string',
              example: 'Insufficient permissions to access this resource'
            }
          }
        },
        NotFoundError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Not Found'
            },
            message: {
              type: 'string',
              example: 'The requested resource was not found'
            }
          }
        },
        RateLimitError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Too Many Requests'
            },
            message: {
              type: 'string',
              example: 'Rate limit exceeded. Please try again later.'
            },
            retryAfter: {
              type: 'integer',
              description: 'Retry after seconds',
              example: 60
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Inventory',
        description: 'Inventory management and stock tracking'
      },
      {
        name: 'Recipes',
        description: 'Recipe management and viewing'
      },
      {
        name: 'Orders',
        description: 'Order management and baking lists'
      },
      {
        name: 'Notifications',
        description: 'Notification system and preferences'
      },
      {
        name: 'Staff',
        description: 'Staff management (admin only)'
      },
      {
        name: 'Workflows',
        description: 'Production workflow management'
      },
      {
        name: 'Dashboard',
        description: 'Analytics and dashboard data'
      },
      {
        name: 'Financial',
        description: 'Cash management and financial tracking'
      },
      {
        name: 'Communication',
        description: 'Chat and email communication'
      }
    ]
  },
  apis: [
    './routes/*.js', // Path to the API docs
  ],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = {
  swaggerSpec,
  options
};