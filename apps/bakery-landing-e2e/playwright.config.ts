import { defineConfig, devices } from '@playwright/test'
import { nxE2EPreset } from '@nx/playwright/preset'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { landingApp } = require('../../tools/e2e/servers')

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:3000'

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Only Chromium is installed (`npx playwright install --with-deps chromium`
 * in CI), so the suite runs on a desktop and a Chromium-based mobile profile.
 * Firefox and WebKit projects would only ever fail with "browser not
 * installed".
 *
 * In CI the suite runs against the static export in `apps/bakery-landing/out`
 * (see `tools/e2e/servers.js`) — the same files that go to GitHub Pages.
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

  webServer: landingApp(baseURL),
})
