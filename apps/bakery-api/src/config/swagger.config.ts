import swaggerJSDoc from 'swagger-jsdoc'

const options: any = {
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
    ],
  },
  apis: [
    './src/routes/*.ts', // Path to the API docs in TypeScript
    './routes/*.js', // Path to the legacy JS API docs
  ],
}

export const swaggerSpec = swaggerJSDoc(options)
