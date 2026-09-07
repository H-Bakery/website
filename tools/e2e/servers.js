/**
 * Die `webServer`-Einträge der drei Playwright-Suiten (Shop, Management,
 * Landing) - an einer Stelle, damit CI und lokaler Lauf dieselben Server
 * bekommen.
 *
 * Zwei Betriebsarten:
 *
 * - **Entwicklung** (Standard): `nx serve <app>` und laufende Server werden
 *   wiederverwendet (`reuseExistingServer`). Wer die Mock-API schon auf 5000
 *   laufen hat, testet gegen deren Daten - in der Regel das echte `hq`.
 *   Startet Playwright die Server selbst, lesen App und API aus derselben
 *   Quelle (`productsDir()`): `HQ_PRODUCTS_DIR` aus der Umgebung, sonst das
 *   `hq` neben dem Repo, und erst wenn es das nicht gibt, das Fixture.
 * - **Gebaut** (`CI=true` oder `E2E_BUILT=1`): die Suite startet ihre Server
 *   selbst - `next start` auf dem Build in `dist/apps/<app>` (bzw. der
 *   statische Export der Landing) und die Mock-API auf dem synthetischen
 *   Produktverzeichnis `tools/e2e/hq-products`. Das ist der Lauf, den
 *   `.github/workflows/ci.yml` fährt; er braucht weder das private `hq` noch
 *   eine Datenbank.
 *
 * Die Ports kommen aus `BASE_URL` / `API_URL`, damit mehrere Läufe nebeneinander
 * Platz haben.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')

/** Synthetische Produkt-Markdowns - siehe tools/e2e/README.md. */
const FIXTURE_PRODUCTS_DIR = path.join(ROOT, 'tools', 'e2e', 'hq-products')

/** Läuft die Suite gegen die gebaute App statt gegen `nx serve`? */
function usesBuiltApp() {
  return process.env.E2E_BUILT === '1' || Boolean(process.env.CI)
}

/**
 * Das Produktverzeichnis, das App *und* Mock-API bekommen, wenn Playwright sie
 * startet. Beide müssen dieselben Dateien lesen - der Dashboard-Zähler, die
 * Produktliste und die Shop-Kasse vergleichen die Oberfläche mit
 * `GET /api/products`. Ein Server, der nur das Fixture sieht, während der
 * andere `hq` liest, lässt die Suite mit „56 statt 103“ umfallen.
 *
 * - Gebaut: immer das Fixture - so ist die App gebaut worden (ci.yml, README).
 * - Entwicklung: `HQ_PRODUCTS_DIR` aus der Umgebung, sonst das `hq` neben dem
 *   Repo (der Standard der App-Loader), sonst das Fixture.
 */
function productsDir() {
  if (usesBuiltApp()) return FIXTURE_PRODUCTS_DIR
  if (process.env.HQ_PRODUCTS_DIR) return process.env.HQ_PRODUCTS_DIR
  const hq = path.join(ROOT, '..', 'hq', 'products')
  return fs.existsSync(hq) ? hq : FIXTURE_PRODUCTS_DIR
}

/** Sollen laufende Server übernommen werden? In CI nie - dort ist alles frisch. */
function reuseExistingServer() {
  return !process.env.CI
}

function portOf(url) {
  const parsed = new URL(url)
  if (parsed.port) return Number(parsed.port)
  return parsed.protocol === 'https:' ? 443 : 80
}

/**
 * Die Mock-API (`apps/bakery-api/simple-server.js`) auf `productsDir()` -
 * in CI das Fixture, in Entwicklung dieselbe Quelle wie der Dev-Server.
 * Ein bereits laufender Server bleibt unangetastet.
 */
function mockApiServer(apiURL) {
  return {
    command: 'node apps/bakery-api/simple-server.js',
    url: `${apiURL}/health`,
    env: {
      PORT: String(portOf(apiURL)),
      HQ_PRODUCTS_DIR: productsDir(),
    },
    reuseExistingServer: reuseExistingServer(),
    cwd: ROOT,
    timeout: 60_000,
  }
}

/**
 * Eine Next-App: `next start` auf dem Build oder `nx serve` im Dev-Modus.
 *
 * @param {string} project  Nx-Projektname, z. B. `bakery-shop`
 * @param {string} baseURL  wo die App erreichbar sein soll
 * @param {Record<string, string>} [env]  zusätzliche Umgebung (z. B. `HQ_PRODUCTS_DIR`)
 */
function nextApp(project, baseURL, env = {}) {
  const port = portOf(baseURL)
  const built = usesBuiltApp()
  const appDir = process.env.E2E_APP_DIR || `dist/apps/${project}`
  return {
    command: built
      ? `npx next start ${appDir} -p ${port}`
      : `npx nx serve ${project} --port=${port}`,
    url: baseURL,
    env: built ? { ...env, NODE_ENV: 'production' } : env,
    reuseExistingServer: reuseExistingServer(),
    cwd: ROOT,
    /* Der Dev-Server kompiliert beim ersten Aufruf; geben wir ihm Zeit. */
    timeout: 180_000,
  }
}

/**
 * Die Landing: statischer Export (`apps/bakery-landing/out`) hinter
 * `tools/e2e/serve-static.js` - oder der Dev-Server.
 */
function landingApp(baseURL) {
  const port = portOf(baseURL)
  const built = usesBuiltApp()
  const outDir = process.env.E2E_APP_DIR || 'apps/bakery-landing/out'
  return {
    command: built
      ? `node tools/e2e/serve-static.js ${outDir} --port ${port}`
      : `npx nx serve bakery-landing --port=${port}`,
    url: baseURL,
    reuseExistingServer: reuseExistingServer(),
    cwd: ROOT,
    timeout: 180_000,
  }
}

module.exports = {
  FIXTURE_PRODUCTS_DIR,
  ROOT,
  landingApp,
  mockApiServer,
  nextApp,
  productsDir,
  usesBuiltApp,
}
