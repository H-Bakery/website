# Bakery Backend Test Framework

This directory contains the test suite for the bakery management backend. The framework uses Jest for unit and integration testing, with various utilities to make testing easier.

## Structure

```
tests/
├── fixtures/         # Test data files
├── helpers/          # Shared testing utilities and test database
├── integration/      # Integration tests for APIs and services
├── unit/             # Unit tests for individual components
└── README.md         # This file
```

## Available Tests

### Unit Tests

- **authController.test.js** - Tests authentication controller (registration, login, JWT)
- **authMiddleware.test.js** - Tests JWT authentication middleware
- **csvParser.test.js** - Tests the CSV parsing utility
- **productController.test.js** - Tests the product controller logic
- **productModel.test.js** - Tests the product database model
- **productSeeder.test.js** - Tests the product seeder that imports CSV data
- **cashController.test.js** - Tests cash management controller
- **cashControllerCRUD.test.js** - Tests cash CRUD operations
- **unsoldProductController.test.js** - Tests unsold product tracking
- **sanity.test.js** - Basic sanity checks for the testing environment

### Integration Tests

- **authAPI.test.js** - Tests authentication API endpoints with real HTTP requests
- **csvImport.test.js** - Tests the end-to-end CSV import process
- **productApi.test.js** - Tests the product REST API endpoints
- **cashAPI.test.js** - Tests cash management API endpoints

## Running Tests

Run all tests:
```bash
npm test
```

Run tests with coverage report:
```bash
npm run test:coverage
```

Run tests in watch mode (for development):
```bash
npm run test:watch
```

Run only unit tests:
```bash
npm run test:unit
```

Run only integration tests:
```bash
npm run test:integration
```

Run a specific test file:
```bash
npm run test:file tests/unit/csvParser.test.js
```

## Test CSV Utility

For CSV parsing tests, run:
```bash
npm run test:csv
```

## Authentication Test Suite

The authentication tests provide comprehensive coverage of the security system:

### Security Test Coverage
- **Password Security**: Bcrypt hashing, salt rounds, password validation
- **JWT Tokens**: Token generation, signature verification, expiration handling
- **Input Validation**: SQL injection prevention, XSS protection, malformed data handling
- **Authorization**: Bearer token parsing, header validation, user ID extraction
- **Error Handling**: Database errors, authentication failures, edge cases

### Test Files
- `unit/authController.test.js` - 20 tests covering registration, login, and security
- `unit/authMiddleware.test.js` - 20 tests covering JWT middleware and validation
- `integration/authAPI.test.js` - 19+ tests covering HTTP endpoints and security vulnerabilities

### Running Auth Tests
```bash
# Run all auth tests
npm test -- --testPathPattern=auth

# Run specific auth test files
npm test -- tests/unit/authController.test.js
npm test -- tests/unit/authMiddleware.test.js
npm test -- tests/integration/authAPI.test.js
```

## Writing New Tests

### Unit Tests

Unit tests should be small, focused, and test a single component in isolation. Mock any dependencies.

```javascript
describe('Component Name', () => {
  test('should perform specific action', () => {
    // Arrange - set up test data
    // Act - execute the function being tested
    // Assert - verify the results
  });
});
```

### Integration Tests

Integration tests should test how multiple components work together.

```javascript
describe('Feature Name', () => {
  beforeAll(async () => {
    // Set up database or other resources
  });
  
  afterAll(async () => {
    // Clean up resources
  });
  
  test('should perform end-to-end operation', async () => {
    // Test interactions between multiple components
  });
});
```

## Test Helpers

- `testSetup.js` - Contains utilities for database setup, seeding test data, and fixture management
- `testDatabase.js` - Provides an isolated test database connection to prevent test interference

## Test Database

For database tests, use the test database helper:

```javascript
const { testSequelize, models, initTestDb } = require('../helpers/testDatabase');

// In your beforeAll/beforeEach
await initTestDb();

// Use models.Product instead of requiring the models directly
const products = await models.Product.findAll();
```

## Fixtures

The `fixtures` directory contains test data files like test CSV files used in tests.

## Debugging Tests

If tests are hanging or failing unexpectedly:

1. Run with open handles detection:
```bash
jest --detectOpenHandles
```

2. Increase jest timeout for slow tests:
```javascript
jest.setTimeout(30000); // 30 seconds
```

3. Check for unhandled promise rejections or unclosed connections

## Best Practices

1. Use descriptive test names that explain the expected behavior
2. Follow the AAA pattern: Arrange, Act, Assert
3. Mock external dependencies in unit tests
4. Use real dependencies in integration tests
5. Clean up after tests to avoid affecting other tests
6. Make tests deterministic (same input → same output)
7. Keep tests independent from each other
8. Properly close database connections after tests complete
9. Use unique IDs for test data to prevent conflicts
10. Handle file operations in try/catch blocks and clean up files after tests