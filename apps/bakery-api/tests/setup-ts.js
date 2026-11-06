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
process.env.HQ_DIR = nowhere
process.env.HQ_BACKZETTEL_CONFIG = path.join(
  nowhere,
  'config',
  'backzettel.yaml'
)
process.env.HQ_PRODUCTS_DIR = path.join(nowhere, 'products')
process.env.HQ_REPORTS_DIR = path.join(nowhere, 'reports')
process.env.HQ_FINANCE_DIR = path.join(nowhere, 'finance')
// B7: the preorder variants hook reads the Backzettel master data.
process.env.HQ_BACKZETTEL_CONFIG = path.join(
  nowhere,
  'config',
  'backzettel.yaml'
)
// B5: never commit into a developer's hq write worktree from a test.
delete process.env.HQ_WRITE_DIR
delete process.env.HQ_WRITE_BRANCH
// B5b/Z9: never push to a real remote or call the real GitHub API.
delete process.env.HQ_SNAPSHOT_DIR
delete process.env.HQ_GITHUB_TOKEN
delete process.env.GITHUB_TOKEN
delete process.env.GITHUB_API_URL
delete process.env.HQ_GITHUB_REPO
// B8: address search and routing never leave the machine. Port 9 (discard)
// refuses at once, so the geo core answers `null` (estimate path) quickly -
// for the mock server in the parity suites as well. Integration tests of the
// real API pass an offline `geo` stub through createTestApp() anyway.
process.env.NOMINATIM_URL = 'http://127.0.0.1:9/search'
process.env.OSRM_URL = 'http://127.0.0.1:9'
process.env.GEO_TIMEOUT_MS = '500'
