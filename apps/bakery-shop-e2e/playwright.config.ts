import { defineConfig, devices } from '@playwright/test'
import { nxE2EPreset } from '@nx/playwright/preset'
import { workspaceRoot } from '@nx/devkit'

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200'

/** The shop is useless without the product API — both servers have to be up. */
const apiURL = process.env['API_URL'] || 'http://localhost:5000'

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Only Chromium is installed in this workspace, so there are exactly two
 * projects: a desktop one and a Chromium-based mobile one (Pixel 5). The
 * Firefox and WebKit projects were removed — they could only ever produce
 * "browser not installed" failures.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  /* Next's dev server compiles a route on first request; give it room. */
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
      /* The mobile suite asserts a 393px layout; it belongs to `mobile`. */
      testIgnore: /shop-mobile\.spec\.ts$/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
      testMatch: /shop-mobile\.spec\.ts$/,
    },
  ],

  /* Run both servers before the tests: the API serves the real products and
     accepts the orders, the shop is the app under test. */
  webServer: [
    {
      command: 'npm run serve:api:simple',
      url: `${apiURL}/health`,
      reuseExistingServer: !process.env.CI,
      cwd: workspaceRoot,
      timeout: 120_000,
    },
    {
      command: 'nx serve bakery-shop',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      cwd: workspaceRoot,
      timeout: 180_000,
    },
  ],
})
