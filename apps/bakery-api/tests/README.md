# Bakery Backend Test Framework

This directory contains the test suite for the bakery management backend. The framework uses Jest for unit and integration testing, with various utilities to make testing easier.

## Pilot test harness (roadmap B1)

`apps/bakery-api/jest.config.js` has two jest projects; both run with
`npx jest -c apps/bakery-api/jest.config.js` and `npx nx test bakery-api`
(`--selectProjects js` or `ts` picks one):

| Project | Files                                                                     | Transform                                      |
| ------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| `js`    | `tests/**/*.test.js` (`*.core.js` rules, mock server, legacy JS layer)    | none                                           |
| `ts`    | `src/**/*.spec.ts`, `src/**/__tests__/**/*.test.ts`, `tests/**/*.test.ts` | ts-jest, transpile-only (`tsconfig.spec.json`) |

The `ts` project resolves `@bakery/*` through the `tsconfig.base.json` paths and runs
`tests/setup-ts.js` first: `NODE_ENV=test`, a synthetic `JWT_SECRET`, and `HQ_*_DIR` pointing at a
directory that does not exist, so no test ever reads the private `hq` repo. ts-jest does not
type-check; `npx nx run bakery-api:typecheck` checks the pilot graph **and** `tsconfig.spec.json`
(all TS tests).

- **`helpers/createTestApp.ts`** - `createApp()` on `:memory:` SQLite, migrated with the static
  migration list (the pilot baseline), models initialised, optionally the partner seed. One per test
  file (models are module singletons; jest isolates files).
- **`integration/app.test.ts`** - `/health`, JSON 404 / 400 shapes, partners CRUD + visits, the
  `users` foreign key.
- **`migrations/pilotBaseline.test.ts`** - B2: fresh schema, every pilot model attribute has its
  column, idempotent re-run, upgrade of a database that ran the 17 archived migrations (partner
  data kept, legacy users rebuilt and disabled), `down()`.
- **`parity/parity.ts`** - parity runner (D3): `loadMockServer(tmpDir)` loads `simple-server.js`
  with its JSON stores redirected into a temp dir (the real `data/*.json` are never touched),
  `compare(request, { mock, real })` returns status + shape differences (missing keys and type
  changes count; extra keys on the real API and `null` are tolerated unless `strictKeys`).
  `parity/partners.parity.test.ts` (B6) runs every partner route on both servers in lockstep,
  with sessions, and compares values too where both hold the same data.
- **`integration/partners.test.ts`** (B6) - role guards per route, hq catalogue lookup of visit
  items (needs a synthetic catalogue: `app: { hqProducts: { productsDir: makeProductsDir(),
writeDir: null } }` - a visit with items in any other test needs the same), the initial-visit
  race, audit. `integration/partnerImport{,Cli}.test.ts` - the `partner-store.json` import.
- **`../scripts/boot-smoke.sh`** - bundle → start in production mode on a fresh SQLite file →
  `/health` + JSON 404 (`message` and `error`) → restart on the same file (no migration may
  re-run). CI runs it in the `build (bakery-api)` job. Since B3 it also runs the bundled
  `cli.js create-user` twice on the fresh file (create, then idempotent reset with a new
  password), logs in with that account, and checks the global guard (`/api/partners` 401
  without a session, 200 with one; unknown `/api` routes 404 with a session).
- **`helpers/auth.ts`** (B3) - `createUser()`, `login()`, `bearer()`, `sessionFor()` for
  integration tests: every `/api` route except login/refresh/pin/station-users needs a session.

### TS specs that do not run (triage of the "31")

The roadmap counted 31 never-run TS specs. 3 of them are in this app; all test domains that are
unmounted in the pilot and use legacy models without a table in the baseline, so they are listed
in `EXCLUDED_TS_TESTS` in `jest.config.js` and are deleted with their code in B12:

- `src/routes/__tests__/inventory.routes.test.ts` (inventory, D11)
- `src/services/__tests__/inventory.service.test.ts` (inventory, D11)
- `src/services/__tests__/email-notification.test.ts` (email/notifications, unmounted)

The other 28 live in `libs/api/*` (database, delivery, email, preferences, templates, the
`import-service` family, `libs/api` itself). They are not bakery-api tests: each lib has its own
nx `test` target and jest config and runs there (`api-import-service` and `api-sales-analytics` are
the known red ones). None of those libs is mounted in the pilot, so none is pulled in here.

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
  })
})
```

### Integration Tests

Integration tests should test how multiple components work together.

```javascript
describe('Feature Name', () => {
  beforeAll(async () => {
    // Set up database or other resources
  })

  afterAll(async () => {
    // Clean up resources
  })

  test('should perform end-to-end operation', async () => {
    // Test interactions between multiple components
  })
})
```

## Test Helpers

- `testSetup.js` - Contains utilities for database setup, seeding test data, and fixture management
- `testDatabase.js` - Provides an isolated test database connection to prevent test interference

## Test Database

For database tests, use the test database helper:

```javascript
const { testSequelize, models, initTestDb } = require('../helpers/testDatabase')

// In your beforeAll/beforeEach
await initTestDb()

// Use models.Product instead of requiring the models directly
const products = await models.Product.findAll()
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
jest.setTimeout(30000) // 30 seconds
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
