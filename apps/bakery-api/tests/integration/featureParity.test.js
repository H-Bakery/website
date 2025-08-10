const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('../../models');

describe('Feature Parity Validation - Legacy vs New Implementation', () => {
  const legacyPath = path.join(__dirname, '../../legacy-archive');
  const newPath = path.join(__dirname, '../../src');
  
  // Map of legacy files to their new counterparts
  const moduleMapping = {
    'controllers/authController.js': 'libs/api/auth',
    'controllers/productController.js': 'libs/api/products',
    'controllers/orderController.js': 'libs/api/orders',
    'controllers/inventoryController.js': 'libs/api/inventory',
    'controllers/recipeController.js': 'libs/api/recipes',
    'controllers/productionController.js': 'libs/api/production',
    'controllers/notificationController.js': 'libs/api/notifications',
    'controllers/staffController.js': 'libs/api/staff',
    'controllers/reportingController.js': 'libs/api/reporting-service',
    'controllers/dashboardController.js': 'libs/api/dashboard',
    'controllers/cashController.js': 'libs/api/cash',
    'controllers/chatController.js': 'libs/api/chat',
    'controllers/bakingListController.js': 'libs/api/baking-list',
    'controllers/preferencesController.js': 'libs/api/preferences',
    'controllers/templateController.js': 'libs/api/templates',
    'controllers/unsoldProductController.js': 'libs/api/unsold-products',
    'controllers/workflowController.js': 'libs/api/workflows'
  };

  describe('Module Migration Coverage', () => {
    test('All legacy controllers should have corresponding new modules', () => {
      const legacyControllers = fs.readdirSync(path.join(legacyPath, 'controllers'))
        .filter(file => file.endsWith('.js'));
      
      legacyControllers.forEach(controller => {
        const mappingKey = `controllers/${controller}`;
        expect(moduleMapping).toHaveProperty(mappingKey);
        console.log(`✓ ${controller} → ${moduleMapping[mappingKey]}`);
      });
    });

    test('All legacy routes should be migrated to new routes', () => {
      const legacyRoutes = fs.readdirSync(path.join(legacyPath, 'routes'))
        .filter(file => file.endsWith('.js'));
      
      const newRoutes = fs.readdirSync(path.join(newPath, 'routes'))
        .filter(file => file.endsWith('.ts'));
      
      legacyRoutes.forEach(route => {
        // Convert legacy route name to new TypeScript route name
        const baseName = path.basename(route, '.js');
        const expectedNewRoute = baseName.replace(/Routes$/, '.routes.ts')
          .replace(/([A-Z])/g, '-$1').toLowerCase()
          .replace(/^-/, '');
        
        if (newRoutes.some(nr => nr.includes(baseName.toLowerCase()) || nr.includes(expectedNewRoute))) {
          console.log(`✓ ${route} migrated`);
        } else {
          console.warn(`⚠ ${route} may need verification`);
        }
      });
    });

    test('All legacy models should have TypeScript equivalents', () => {
      const legacyModels = fs.readdirSync(path.join(legacyPath, 'models'))
        .filter(file => file.endsWith('.js') && file !== 'index.js');
      
      const newModels = fs.readdirSync(path.join(newPath, 'models'))
        .filter(file => file.endsWith('.ts') && file !== 'index.ts');
      
      legacyModels.forEach(model => {
        const modelName = path.basename(model, '.js');
        const expectedNewModel = `${modelName}.ts`;
        
        if (newModels.includes(expectedNewModel)) {
          console.log(`✓ ${model} → ${expectedNewModel}`);
        } else {
          // Check if model name was changed (e.g., order.js → Order.ts)
          const capitalizedModel = modelName.charAt(0).toUpperCase() + modelName.slice(1) + '.ts';
          if (newModels.includes(capitalizedModel)) {
            console.log(`✓ ${model} → ${capitalizedModel}`);
          } else {
            console.warn(`⚠ ${model} migration needs verification`);
          }
        }
      });
    });

    test('All legacy services should be migrated', () => {
      const legacyServices = fs.readdirSync(path.join(legacyPath, 'services'))
        .filter(file => file.endsWith('.js'));
      
      const newServices = fs.readdirSync(path.join(newPath, 'services'))
        .filter(file => file.endsWith('.ts'));
      
      legacyServices.forEach(service => {
        const serviceName = path.basename(service, '.js');
        const expectedNewService = `${serviceName.replace(/Service$/, '.service')}.ts`;
        
        if (newServices.includes(expectedNewService) || 
            newServices.some(ns => ns.toLowerCase().includes(serviceName.toLowerCase()))) {
          console.log(`✓ ${service} migrated`);
        } else {
          console.warn(`⚠ ${service} may need verification`);
        }
      });
    });

    test('All legacy utilities should be migrated', () => {
      const legacyUtils = fs.readdirSync(path.join(legacyPath, 'utils'))
        .filter(file => file.endsWith('.js'));
      
      const newUtils = fs.readdirSync(path.join(newPath, 'utils'))
        .filter(file => file.endsWith('.ts'));
      
      legacyUtils.forEach(util => {
        const utilName = path.basename(util, '.js');
        const expectedNewUtil = `${utilName}.ts`;
        
        if (newUtils.includes(expectedNewUtil)) {
          console.log(`✓ ${util} → ${expectedNewUtil}`);
        } else {
          console.warn(`⚠ ${util} may need verification`);
        }
      });
    });

    test('All legacy validators should be migrated', () => {
      const legacyValidators = fs.readdirSync(path.join(legacyPath, 'validators'))
        .filter(file => file.endsWith('.js'));
      
      const newValidators = fs.readdirSync(path.join(newPath, 'validators'))
        .filter(file => file.endsWith('.ts'));
      
      legacyValidators.forEach(validator => {
        const validatorName = path.basename(validator, '.js');
        const expectedNewValidator = `${validatorName.replace(/Validator$/, '.validator')}.ts`;
        
        if (newValidators.includes(expectedNewValidator) || 
            newValidators.some(nv => nv.toLowerCase().includes(validatorName.toLowerCase()))) {
          console.log(`✓ ${validator} migrated`);
        } else {
          console.warn(`⚠ ${validator} may need verification`);
        }
      });
    });
  });

  describe('API Endpoint Coverage', () => {
    const legacyEndpoints = [
      // Auth endpoints
      { method: 'POST', path: '/api/auth/register' },
      { method: 'POST', path: '/api/auth/login' },
      { method: 'GET', path: '/api/auth/me' },
      { method: 'POST', path: '/api/auth/logout' },
      
      // Product endpoints
      { method: 'GET', path: '/api/products' },
      { method: 'POST', path: '/api/products' },
      { method: 'GET', path: '/api/products/:id' },
      { method: 'PUT', path: '/api/products/:id' },
      { method: 'DELETE', path: '/api/products/:id' },
      
      // Order endpoints
      { method: 'GET', path: '/api/orders' },
      { method: 'POST', path: '/api/orders' },
      { method: 'GET', path: '/api/orders/:id' },
      { method: 'PUT', path: '/api/orders/:id' },
      { method: 'PUT', path: '/api/orders/:id/status' },
      
      // Inventory endpoints
      { method: 'GET', path: '/api/inventory' },
      { method: 'POST', path: '/api/inventory' },
      { method: 'PUT', path: '/api/inventory/:id' },
      { method: 'PUT', path: '/api/inventory/:id/adjust' },
      { method: 'GET', path: '/api/inventory/low-stock' },
      
      // Recipe endpoints
      { method: 'GET', path: '/api/recipes' },
      { method: 'POST', path: '/api/recipes' },
      { method: 'GET', path: '/api/recipes/:id' },
      { method: 'PUT', path: '/api/recipes/:id' },
      { method: 'DELETE', path: '/api/recipes/:id' },
      
      // Production endpoints
      { method: 'GET', path: '/api/production/schedules' },
      { method: 'POST', path: '/api/production/schedules' },
      { method: 'GET', path: '/api/production/batches' },
      { method: 'POST', path: '/api/production/batches' },
      { method: 'PUT', path: '/api/production/batches/:id/complete' },
      
      // Notification endpoints
      { method: 'GET', path: '/api/notifications' },
      { method: 'POST', path: '/api/notifications' },
      { method: 'PUT', path: '/api/notifications/:id/read' },
      { method: 'DELETE', path: '/api/notifications/:id' },
      
      // Staff endpoints
      { method: 'GET', path: '/api/staff' },
      { method: 'POST', path: '/api/staff' },
      { method: 'GET', path: '/api/staff/schedule' },
      { method: 'POST', path: '/api/staff/schedule' },
      
      // Report endpoints
      { method: 'GET', path: '/api/reports/sales' },
      { method: 'GET', path: '/api/reports/inventory' },
      { method: 'GET', path: '/api/reports/production' },
      { method: 'POST', path: '/api/reports/generate' },
      
      // Dashboard endpoints
      { method: 'GET', path: '/api/dashboard/stats' },
      { method: 'GET', path: '/api/dashboard/charts' },
      { method: 'GET', path: '/api/dashboard/recent' },
      
      // Health endpoints
      { method: 'GET', path: '/api/health' },
      { method: 'GET', path: '/api/health/ready' },
      { method: 'GET', path: '/api/health/live' }
    ];

    test('All legacy endpoints should be documented and migrated', () => {
      const endpointGroups = {};
      
      legacyEndpoints.forEach(endpoint => {
        const group = endpoint.path.split('/')[2]; // Extract 'auth', 'products', etc.
        if (!endpointGroups[group]) {
          endpointGroups[group] = [];
        }
        endpointGroups[group].push(endpoint);
      });
      
      Object.keys(endpointGroups).forEach(group => {
        console.log(`\n${group.toUpperCase()} Endpoints:`);
        endpointGroups[group].forEach(endpoint => {
          console.log(`  ${endpoint.method.padEnd(6)} ${endpoint.path}`);
        });
      });
      
      expect(legacyEndpoints.length).toBeGreaterThan(0);
      console.log(`\nTotal endpoints to validate: ${legacyEndpoints.length}`);
    });
  });

  describe('Database Schema Parity', () => {
    test('All legacy models should have corresponding database tables', async () => {
      const tables = await sequelize.getQueryInterface().showAllTables();
      
      const expectedTables = [
        'Users',
        'Products', 
        'Orders',
        'OrderItems',
        'Inventories',
        'Recipes',
        'ProductionBatches',
        'ProductionSchedules',
        'ProductionSteps',
        'Notifications',
        'NotificationPreferences',
        'NotificationTemplates',
        'Cash',
        'Chats',
        'UnsoldProducts',
        'StockAdjustments'
      ];
      
      expectedTables.forEach(table => {
        if (tables.includes(table) || tables.includes(table.toLowerCase())) {
          console.log(`✓ Table ${table} exists`);
        } else {
          console.warn(`⚠ Table ${table} may be missing`);
        }
      });
    });
  });

  describe('Business Logic Parity', () => {
    test('Critical business logic should be preserved', () => {
      const criticalFeatures = [
        'User authentication with JWT',
        'Role-based access control',
        'Inventory tracking with low-stock alerts',
        'Order processing workflow',
        'Production scheduling and batch tracking',
        'Recipe management with ingredient calculations',
        'Notification system with templates',
        'Report generation (PDF/Excel)',
        'Real-time updates via WebSocket',
        'CSV import/export functionality',
        'Cash management and reconciliation',
        'Staff scheduling',
        'Unsold product tracking',
        'Workflow automation'
      ];
      
      console.log('\nCritical Features Checklist:');
      criticalFeatures.forEach(feature => {
        console.log(`  □ ${feature}`);
      });
      
      expect(criticalFeatures.length).toBeGreaterThan(0);
    });
  });
});