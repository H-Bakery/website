import { defineConfig, devices } from '@playwright/test'
import { nxE2EPreset } from '@nx/playwright/preset'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { deliveryApiServer, nextApp } = require('../../tools/e2e/servers')

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
  // Den E2E-Fahrer einmal anlegen, nicht je Worker (src/global-setup.ts).
  globalSetup: require.resolve('./src/global-setup'),
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'de-DE',
    permissions: ['geolocation'],
    // Homburg Mitte - die App laeuft im Saarpfalz-Kreis.
    geolocation: { latitude: 49.3226, longitude: 7.3389 },
  },
  webServer: [
    // Die Tour-Daten kommen aus der echten API (B8, seit B12 auch hier):
    // Bundle mit frischer Datenbank und dem E2E-Inhaber, der Origin der App
    // in CORS_ORIGIN - siehe tools/e2e/servers.js.
    deliveryApiServer(apiURL, baseURL),
    // `nx serve` in Entwicklung, `next start` auf dem Build mit `E2E_BUILT=1`
    // (Verzeichnis aus `E2E_APP_DIR`, Vorgabe dist/apps/bakery-delivery) -
    // wie bei den anderen Suiten. Im Build ist NEXT_PUBLIC_API_URL schon
    // eingebacken; er muss also auf API_URL zeigen.
    nextApp('bakery-delivery', baseURL, { NEXT_PUBLIC_API_URL: apiURL }),
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
})
