import { defineConfig, devices } from '@playwright/test'
import { nxE2EPreset } from '@nx/playwright/preset'
import { workspaceRoot } from '@nx/devkit'

// 4300 ist der Port der App (siehe apps/bakery-delivery/project.json). 3000
// gehoert der Landing Page, 4200 dem Shop.
const PORT = process.env['DELIVERY_PORT'] || '4300'
const API_PORT = process.env['API_PORT'] || '5000'
const baseURL = process.env['BASE_URL'] || `http://localhost:${PORT}`
// Dieselbe Adresse fuer die App (eingebacken als NEXT_PUBLIC_API_URL) und fuer
// die direkten API-Aufrufe der Tests - sonst redet die App mit Port 5000,
// waehrend der Test seine Tour auf API_PORT anlegt.
const apiURL = process.env['API_URL'] || `http://localhost:${API_PORT}`

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'de-DE',
    permissions: ['geolocation'],
    // Homburg Mitte - die App laeuft im Saarpfalz-Kreis.
    geolocation: { latitude: 49.3226, longitude: 7.3389 },
  },
  webServer: [
    // Die Tour-Daten kommen aus der API. Ohne sie zeigt die App nur ihre
    // Fehlermeldung - genau das prueft der erste Test.
    {
      command: `node apps/bakery-api/simple-server.js`,
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: true,
      cwd: workspaceRoot,
      env: { PORT: API_PORT },
    },
    {
      command: `npx nx run bakery-delivery:serve --port=${PORT}`,
      url: baseURL,
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: apiURL },
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
})
