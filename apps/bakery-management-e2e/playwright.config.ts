import { defineConfig, devices } from '@playwright/test'
import { nxE2EPreset } from '@nx/playwright/preset'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  nextApp,
  prepareE2eHq,
  realApiServer,
} = require('../../tools/e2e/servers')

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:3001'

/**
 * Die echte API (F4, esbuild-Bundle) - nicht mehr die Mock-API. Die App
 * reicht `/api/*` über `src/proxy.ts` an diese Adresse weiter (`API_URL`).
 */
const apiURL = process.env['API_URL'] || 'http://localhost:5000'

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Only Chromium is installed (`npx playwright install --with-deps chromium`
 * in CI), so the suite runs on a desktop and a Chromium-based mobile profile.
 *
 * Which servers run is decided in `tools/e2e/servers.js`. App and API read
 * the same synthetic hq tree (`prepareE2eHq`: a copy of the product fixture
 * plus invented cash reports and finance data). The app runs in pilot mode
 * (`NEXT_PUBLIC_PILOT_MODE=1`, as on the box) - in CI the build step sets it,
 * in development the dev server gets it here.
 */
const hqEnv = prepareE2eHq(apiURL)

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  // Sitzungen einmal vor allen Tests (nach dem Serverstart), siehe src/login.ts.
  globalSetup: require.resolve('./src/global-setup'),
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
    realApiServer(apiURL, hqEnv),
    nextApp('bakery-management', baseURL, {
      ...hqEnv,
      API_URL: apiURL,
      NEXT_PUBLIC_PILOT_MODE: '1',
    }),
  ],
})
