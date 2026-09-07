import { defineConfig, devices } from '@playwright/test'
import { nxE2EPreset } from '@nx/playwright/preset'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  FIXTURE_PRODUCTS_DIR,
  mockApiServer,
  nextApp,
  usesBuiltApp,
} = require('../../tools/e2e/servers')

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:3001'

/** Dashboard, Bestellungen usw. lesen von der Mock-API. */
const apiURL = process.env['API_URL'] || 'http://localhost:5000'

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Only Chromium is installed (`npx playwright install --with-deps chromium`
 * in CI), so the suite runs on a desktop and a Chromium-based mobile profile.
 *
 * There is no `setup` / `authenticated` project any more: the management app
 * has no login, so an auth setup could only ever fail on a missing
 * `/admin/login`.
 *
 * Which servers run is decided in `tools/e2e/servers.js`. The product list is
 * read from `HQ_PRODUCTS_DIR` at build time; in CI the build *and* the mock
 * API point at the synthetic fixture so both agree on the catalogue.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: [
    mockApiServer(apiURL),
    nextApp(
      'bakery-management',
      baseURL,
      // The dev server reads the products per request; give it the fixture
      // whenever the suite runs on the built (fixture-fed) API anyway.
      usesBuiltApp() ? { HQ_PRODUCTS_DIR: FIXTURE_PRODUCTS_DIR } : {}
    ),
  ],
})
