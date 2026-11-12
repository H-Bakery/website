import { defineConfig, devices } from '@playwright/test'
import { nxE2EPreset } from '@nx/playwright/preset'

/**
 * Playwright-Suite der Digitalen Bäckerei (3D-Laden).
 *
 * Läuft immer gegen den **statischen Export unter dem Unterpfad**
 * `/digitale-baeckerei`, gebaut mit dem synthetischen Fixture
 * (`DIGITALE_BAECKEREI_FIXTURE=1`) - siehe `serve-fixture.js`. Lokal baut der
 * Server vor dem Start selbst; in CI und mit `E2E_BUILT=1` nimmt er den
 * vorhandenen Export.
 *
 * Zwei Projekte, beide Chromium (nur das ist in CI installiert):
 * `phone` 390×844 mit Touch und mobilem User-Agent (das Handy ist das
 * Hauptgerät), `desktop` 1440×900.
 *
 * WebGL ohne Grafikkarte: Chromium rendert mit SwiftShader, dafür die
 * Startparameter unten. Ohne sie gibt es headless keinen WebGL-Kontext und die
 * App zeigte nur den Ersatz ohne 3D.
 */
const baseURL = process.env['BASE_URL'] || 'http://localhost:4236'
const port = new URL(baseURL).port || '80'

const launchOptions = {
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
}

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  // Software-Rendering ist langsam, vor allem auf den CI-Maschinen.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'phone',
      use: {
        // Mobiler Chrome-User-Agent, Touch und isMobile vom Pixel 5; die Maße
        // sind die des Plans (390 px breit, Hochformat).
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        launchOptions,
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions,
      },
    },
  ],

  webServer: {
    command: `node apps/bakery-digitale-baeckerei-e2e/serve-fixture.js --port ${port}`,
    url: `${baseURL}/digitale-baeckerei/`,
    // In CI ist alles frisch; lokal darf ein laufender Server weiterlaufen.
    reuseExistingServer: !process.env['CI'],
    cwd: `${__dirname}/../..`,
    // Lokal baut der Server erst (next build), das dauert.
    timeout: 300_000,
  },
})
