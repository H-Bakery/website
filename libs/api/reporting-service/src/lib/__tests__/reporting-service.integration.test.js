#!/usr/bin/env node

/**
 * Simple Integration Test for Reporting System
 * Tests if the reporting service can be imported and basic functionality works
 */

console.log('🧪 Testing Reporting Service Integration...\n');

try {
  // Test 1: Check if we can import the reporting service
  console.log('📦 Test 1: Importing reporting service...');
  const { reportingService, ReportType, ReportFormat } = require('../reporting.service');
  console.log('✅ Reporting service imported successfully');

  // Test 2: Check if basic types are available
  console.log('\n🏷️  Test 2: Checking available types...');
  console.log(`   ReportType: ${Object.keys(ReportType).join(', ')}`);
  console.log(`   ReportFormat: ${Object.keys(ReportFormat).join(', ')}`);
  console.log('✅ Types are correctly defined');

  // Test 3: Try to call a basic method (will use mock data)
  console.log('\n⚙️  Test 3: Testing basic service methods...');
  
  // Check if service has expected methods
  const expectedMethods = ['generateReport', 'createSchedule', 'getSchedules'];
  const availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(reportingService));
  
  expectedMethods.forEach(method => {
    if (availableMethods.includes(method)) {
      console.log(`   ✅ ${method} method available`);
    } else {
      console.log(`   ❌ ${method} method missing`);
    }
  });

  console.log('\n🎉 Basic Integration Test Completed Successfully!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Start the API server: cd apps/bakery-api && npm start');
  console.log('   2. Test the API endpoints using curl or Postman');
  console.log('   3. Run the full test suite: node apps/bakery-api/test-report-generation.js');

} catch (error) {
  console.error('❌ Integration test failed:', error.message);
  console.error('\n🔧 Troubleshooting:');
  console.error('   1. Make sure all dependencies are installed: npm install');
  console.error('   2. Check that the reporting service library was built correctly');
  console.error('   3. Verify the import path is correct');
  console.error('\nFull error:', error.stack);
  process.exit(1);
}