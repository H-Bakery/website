/**
 * Environment for the TS jest project (runs before each test file).
 *
 * Tests are hermetic: the hq paths point at a directory that does not exist,
 * so neither the real API nor the mock server ever reads the private `hq`
 * repo (real prices, revenue) - even in the main checkout, where `../hq`
 * exists. A test that needs a catalogue sets its own synthetic fixture dir.
 */
const path = require('path')

const nowhere = path.join(__dirname, '__no-hq-in-tests__')

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-minimum-32-characters'
process.env.HQ_PRODUCTS_DIR = path.join(nowhere, 'products')
process.env.HQ_REPORTS_DIR = path.join(nowhere, 'reports')
process.env.HQ_FINANCE_DIR = path.join(nowhere, 'finance')
// B5: never commit into a developer's hq write worktree from a test.
delete process.env.HQ_WRITE_DIR
delete process.env.HQ_WRITE_BRANCH
