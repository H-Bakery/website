// jest.setup.js - Setup file for Jest tests

// Mock the logger to prevent console output during tests
jest.mock('./utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  db: jest.fn(),
  debug: jest.fn()
}));

// Handle open handles/connections
let openHandles = [];
const originalProcessOn = process.on;

// Track open handles
process.on = function(name, listener) {
  if (name === 'beforeExit') {
    openHandles.push({ name, listener });
  }
  return originalProcessOn.call(process, name, listener);
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-minimum-32-characters';

// Global teardown
afterAll(async () => {
  // Close any open handles gracefully
  try {
    const { sequelize } = require('./config/database');
    await sequelize.close();
  } catch (error) {
    console.log('Database connection already closed or not initialized');
  }
  
  // Give time for any remaining async operations to complete
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Clean up any event listeners
  openHandles.forEach(handle => {
    process.removeListener(handle.name, handle.listener);
  });
});

// Force exit if tests are hanging
jest.setTimeout(30000);