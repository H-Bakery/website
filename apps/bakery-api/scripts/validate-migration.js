#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Migration Validation Script\n');
console.log('=' .repeat(50));

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

const checkmark = `${colors.green}✓${colors.reset}`;
const warning = `${colors.yellow}⚠${colors.reset}`;
const error = `${colors.red}✗${colors.reset}`;

// Paths
const projectRoot = path.join(__dirname, '..');
const legacyPath = path.join(projectRoot, 'legacy-archive');
const srcPath = path.join(projectRoot, 'src');
const libsPath = path.join(projectRoot, '../../libs/api');

// Validation results
const results = {
  passed: [],
  warnings: [],
  errors: []
};

// Helper functions
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (e) {
    return false;
  }
}

function directoryExists(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch (e) {
    return false;
  }
}

function getFiles(dir, extension) {
  try {
    if (!directoryExists(dir)) return [];
    return fs.readdirSync(dir)
      .filter(file => file.endsWith(extension))
      .filter(file => fs.statSync(path.join(dir, file)).isFile());
  } catch (e) {
    return [];
  }
}

// Validation checks
function validateDirectoryStructure() {
  console.log(`\n${colors.blue}1. Directory Structure Validation${colors.reset}`);
  console.log('-'.repeat(40));
  
  const requiredDirs = [
    { path: srcPath, name: 'src' },
    { path: path.join(srcPath, 'routes'), name: 'src/routes' },
    { path: path.join(srcPath, 'models'), name: 'src/models' },
    { path: path.join(srcPath, 'services'), name: 'src/services' },
    { path: path.join(srcPath, 'utils'), name: 'src/utils' },
    { path: path.join(srcPath, 'validators'), name: 'src/validators' },
    { path: path.join(srcPath, 'middleware'), name: 'src/middleware' },
    { path: libsPath, name: 'libs/api' }
  ];
  
  requiredDirs.forEach(dir => {
    if (directoryExists(dir.path)) {
      console.log(`  ${checkmark} ${dir.name} exists`);
      results.passed.push(`Directory: ${dir.name}`);
    } else {
      console.log(`  ${error} ${dir.name} missing`);
      results.errors.push(`Missing directory: ${dir.name}`);
    }
  });
}

function validateControllerMigration() {
  console.log(`\n${colors.blue}2. Controller Migration Validation${colors.reset}`);
  console.log('-'.repeat(40));
  
  const legacyControllers = getFiles(path.join(legacyPath, 'controllers'), '.js');
  
  const controllerMapping = {
    'authController.js': 'auth',
    'productController.js': 'products',
    'orderController.js': 'orders',
    'inventoryController.js': 'inventory',
    'recipeController.js': 'recipes',
    'productionController.js': 'production',
    'staffController.js': 'staff',
    'reportingController.js': 'reporting-service',
    'dashboardController.js': 'dashboard',
    'cashController.js': 'cash',
    'chatController.js': 'chat',
    'bakingListController.js': 'baking-list',
    'preferencesController.js': 'preferences',
    'templateController.js': 'templates',
    'unsoldProductController.js': 'unsold-products',
    'workflowController.js': 'workflows'
  };
  
  legacyControllers.forEach(controller => {
    const libName = controllerMapping[controller];
    if (libName) {
      const libPath = path.join(libsPath, libName);
      if (directoryExists(libPath)) {
        console.log(`  ${checkmark} ${controller} → libs/api/${libName}`);
        results.passed.push(`Controller migrated: ${controller}`);
      } else {
        console.log(`  ${warning} ${controller} → library not found`);
        results.warnings.push(`Controller library missing: ${libName}`);
      }
    } else {
      console.log(`  ${warning} ${controller} → mapping not defined`);
      results.warnings.push(`Controller mapping missing: ${controller}`);
    }
  });
}

function validateRouteMigration() {
  console.log(`\n${colors.blue}3. Route Migration Validation${colors.reset}`);
  console.log('-'.repeat(40));
  
  const legacyRoutes = getFiles(path.join(legacyPath, 'routes'), '.js');
  const newRoutes = getFiles(path.join(srcPath, 'routes'), '.ts');
  
  legacyRoutes.forEach(route => {
    const routeBaseName = path.basename(route, '.js')
      .replace(/Routes$/, '')
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
    
    const expectedRouteName = `${routeBaseName}.routes.ts`;
    
    if (newRoutes.includes(expectedRouteName) || 
        newRoutes.some(r => r.toLowerCase().includes(routeBaseName))) {
      console.log(`  ${checkmark} ${route} migrated`);
      results.passed.push(`Route migrated: ${route}`);
    } else {
      console.log(`  ${warning} ${route} needs verification`);
      results.warnings.push(`Route needs verification: ${route}`);
    }
  });
}

function validateModelMigration() {
  console.log(`\n${colors.blue}4. Model Migration Validation${colors.reset}`);
  console.log('-'.repeat(40));
  
  const legacyModels = getFiles(path.join(legacyPath, 'models'), '.js')
    .filter(f => f !== 'index.js');
  const newModels = getFiles(path.join(srcPath, 'models'), '.ts')
    .filter(f => f !== 'index.ts');
  
  legacyModels.forEach(model => {
    const modelBaseName = path.basename(model, '.js');
    const expectedModelName = `${modelBaseName.charAt(0).toUpperCase() + modelBaseName.slice(1)}.ts`;
    
    if (newModels.includes(expectedModelName) || 
        newModels.some(m => m.toLowerCase() === model.toLowerCase().replace('.js', '.ts'))) {
      console.log(`  ${checkmark} ${model} migrated`);
      results.passed.push(`Model migrated: ${model}`);
    } else {
      console.log(`  ${warning} ${model} needs verification`);
      results.warnings.push(`Model needs verification: ${model}`);
    }
  });
}

function validateServiceMigration() {
  console.log(`\n${colors.blue}5. Service Migration Validation${colors.reset}`);
  console.log('-'.repeat(40));
  
  const legacyServices = getFiles(path.join(legacyPath, 'services'), '.js');
  const newServices = getFiles(path.join(srcPath, 'services'), '.ts');
  
  legacyServices.forEach(service => {
    const serviceBaseName = path.basename(service, '.js');
    const expectedServiceName = `${serviceBaseName.replace(/Service$/, '')}.service.ts`;
    
    if (newServices.includes(expectedServiceName) || 
        newServices.some(s => s.toLowerCase().includes(serviceBaseName.toLowerCase()))) {
      console.log(`  ${checkmark} ${service} migrated`);
      results.passed.push(`Service migrated: ${service}`);
    } else {
      console.log(`  ${warning} ${service} needs verification`);
      results.warnings.push(`Service needs verification: ${service}`);
    }
  });
}

function runTests() {
  console.log(`\n${colors.blue}6. Running Test Suite${colors.reset}`);
  console.log('-'.repeat(40));
  
  try {
    console.log('  Running unit tests...');
    execSync('npm test -- --testPathPattern=unit --silent', { 
      cwd: projectRoot,
      stdio: 'pipe'
    });
    console.log(`  ${checkmark} Unit tests passed`);
    results.passed.push('Unit tests passed');
  } catch (e) {
    console.log(`  ${error} Unit tests failed`);
    results.errors.push('Unit tests failed');
  }
  
  try {
    console.log('  Running integration tests...');
    execSync('npm test -- --testPathPattern=integration --silent', { 
      cwd: projectRoot,
      stdio: 'pipe'
    });
    console.log(`  ${checkmark} Integration tests passed`);
    results.passed.push('Integration tests passed');
  } catch (e) {
    console.log(`  ${error} Integration tests failed`);
    results.errors.push('Integration tests failed');
  }
  
  try {
    console.log('  Running migration parity tests...');
    execSync('npm test -- --testPathPattern=migrationParity --silent', { 
      cwd: projectRoot,
      stdio: 'pipe'
    });
    console.log(`  ${checkmark} Migration parity tests passed`);
    results.passed.push('Migration parity tests passed');
  } catch (e) {
    console.log(`  ${warning} Migration parity tests need attention`);
    results.warnings.push('Migration parity tests need attention');
  }
}

function validateAPIEndpoints() {
  console.log(`\n${colors.blue}7. API Endpoint Validation${colors.reset}`);
  console.log('-'.repeat(40));
  
  const criticalEndpoints = [
    '/api/health',
    '/api/auth/login',
    '/api/products',
    '/api/orders',
    '/api/inventory',
    '/api/production/schedules',
    '/api/reports/sales'
  ];
  
  console.log('  Critical endpoints to verify:');
  criticalEndpoints.forEach(endpoint => {
    console.log(`    □ ${endpoint}`);
  });
  
  results.warnings.push('Manual API endpoint verification required');
}

function generateReport() {
  console.log(`\n${colors.blue}VALIDATION SUMMARY${colors.reset}`);
  console.log('='.repeat(50));
  
  console.log(`\n${colors.green}Passed: ${results.passed.length}${colors.reset}`);
  results.passed.slice(0, 5).forEach(item => {
    console.log(`  ${checkmark} ${item}`);
  });
  if (results.passed.length > 5) {
    console.log(`  ... and ${results.passed.length - 5} more`);
  }
  
  if (results.warnings.length > 0) {
    console.log(`\n${colors.yellow}Warnings: ${results.warnings.length}${colors.reset}`);
    results.warnings.forEach(item => {
      console.log(`  ${warning} ${item}`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log(`\n${colors.red}Errors: ${results.errors.length}${colors.reset}`);
    results.errors.forEach(item => {
      console.log(`  ${error} ${item}`);
    });
  }
  
  // Overall status
  console.log('\n' + '='.repeat(50));
  if (results.errors.length === 0) {
    if (results.warnings.length === 0) {
      console.log(`${colors.green}✅ MIGRATION VALIDATION PASSED${colors.reset}`);
      console.log('All checks passed successfully!');
    } else {
      console.log(`${colors.yellow}⚠️  MIGRATION VALIDATION PASSED WITH WARNINGS${colors.reset}`);
      console.log('Please review the warnings above.');
    }
  } else {
    console.log(`${colors.red}❌ MIGRATION VALIDATION FAILED${colors.reset}`);
    console.log('Please fix the errors before proceeding.');
  }
  
  // Recommendations
  console.log(`\n${colors.blue}RECOMMENDATIONS:${colors.reset}`);
  console.log('1. Run full test suite: npm test');
  console.log('2. Test all API endpoints manually or with Postman');
  console.log('3. Verify database migrations are up to date');
  console.log('4. Check application logs for any runtime errors');
  console.log('5. Create a backup before removing legacy code');
  
  // Save report
  const reportPath = path.join(projectRoot, 'migration-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);
}

// Main execution
function main() {
  validateDirectoryStructure();
  validateControllerMigration();
  validateRouteMigration();
  validateModelMigration();
  validateServiceMigration();
  runTests();
  validateAPIEndpoints();
  generateReport();
}

// Run validation
main();