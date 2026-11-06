/**
 * Die `webServer`-Einträge der drei Playwright-Suiten (Shop, Management,
 * Landing) - an einer Stelle, damit CI und lokaler Lauf dieselben Server
 * bekommen.
 *
 * Welche API: immer die **echte API** (`realApiServer()`, das esbuild-Bundle
 * über `tools/e2e/real-api.js`) mit frischer SQLite-Datenbank im
 * Temp-Verzeichnis und dem E2E-Inhaber aus `BOOTSTRAP_ADMIN_*` (`E2E_ADMIN`).
 * Den Mock-Server `simple-server.js` gibt es seit B12 nicht mehr.
 *
 * - **Management** (seit F4): App und API lesen dasselbe synthetische `hq`
 *   (`prepareE2eHq()`: Produkte plus erfundene Kassenberichte und Finanzen).
 *   Die App reicht `/api/*` über `src/proxy.ts` an `API_URL` weiter.
 * - **Shop** (seit B12, `shopApiServer()`): dieselbe API mit
 *   `PUBLIC_CATALOGUE=1` - `GET /api/products` ohne Sitzung - und der
 *   Shop-Origin in `CORS_ORIGIN`, weil der Browser die API direkt fragt.
 *   Einen öffentlichen Bestellweg hat die echte API nicht (Owner-Entscheidung
 *   offen); die Kasse prüft ihren Erfolgsweg gegen einen im Browser
 *   nachgestellten Bestell-Endpunkt (`apps/bakery-shop-e2e/src/support/shop.ts`).
 * - **Fahrer-App** (`apps/bakery-delivery-e2e`, nicht in CI): wie der Shop mit
 *   dem Origin der App in `CORS_ORIGIN` (`deliveryApiServer()`).
 *
 * Zwei Betriebsarten:
 *
 * - **Entwicklung** (Standard): `nx serve <app>` und laufende Server werden
 *   wiederverwendet (`reuseExistingServer`). Startet Playwright die Server
 *   selbst, lesen App und API aus derselben Quelle (`productsDir()`):
 *   `HQ_PRODUCTS_DIR` aus der Umgebung, sonst das `hq` neben dem Repo, und erst
 *   wenn es das nicht gibt, das Fixture. Das API-Bundle wird dann vor dem
 *   Start neu gebaut.
 * - **Gebaut** (`CI=true` oder `E2E_BUILT=1`): die Suite startet ihre Server
 *   selbst - `next start` auf dem Build in `dist/apps/<app>` (bzw. der
 *   statische Export der Landing), die API auf dem synthetischen
 *   Produktverzeichnis `tools/e2e/hq-products`. Das ist der Lauf, den
 *   `.github/workflows/ci.yml` fährt; er braucht weder das private `hq` noch
 *   eine vorhandene Datenbank.
 *
 * Die Ports kommen aus `BASE_URL` / `API_URL`, damit mehrere Läufe nebeneinander
 * Platz haben.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')

/** Synthetische Produkt-Markdowns - siehe tools/e2e/README.md. */
const FIXTURE_PRODUCTS_DIR = path.join(ROOT, 'tools', 'e2e', 'hq-products')

/** Läuft die Suite gegen die gebaute App statt gegen `nx serve`? */
function usesBuiltApp() {
  return process.env.E2E_BUILT === '1' || Boolean(process.env.CI)
}

/**
 * Das Produktverzeichnis, das App *und* API bekommen, wenn Playwright sie
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

/**
 * Anmeldedaten des Inhabers, den die echte API in der E2E-Instanz beim Start
 * anlegt (`BOOTSTRAP_ADMIN_*`, nur außerhalb von Produktion). Synthetisch.
 */
const E2E_ADMIN = {
  username: process.env.E2E_ADMIN_USER || 'e2e.inhaber',
  password: process.env.E2E_ADMIN_PASSWORD || 'e2e-Passwort-nur-fuer-Tests',
}

/**
 * Synthetisches `hq` für die Verwaltungs-Suite gegen die echte API (F4):
 * eine Kopie von `productsDir()` plus Kassenberichte, Finanzen und Tagesziel
 * aus `apps/bakery-api/tests/fixtures/hq-data.synthetic.js` - erfunden.
 * Verwaltung (Server-Komponenten: Dashboard-Kasse, Berichtsarchiv,
 * Partner-Katalog) und API bekommen **dieselben** Verzeichnisse. Die Kopie
 * der Produkte schützt das Fixture im Repo, falls ein Test speichert.
 *
 * Liegt je API-Port fest im Temp-Verzeichnis. Geschrieben wird nur im
 * Hauptprozess von Playwright: jeder Test-Worker lädt die Konfiguration noch
 * einmal (`TEST_WORKER_INDEX` gesetzt) und bekäme sonst beim gleichzeitigen
 * Löschen und Kopieren `ENOTEMPTY` - Worker brauchen nur die Pfade.
 */
function prepareE2eHq(apiURL) {
  const root = path.join(os.tmpdir(), `bakery-e2e-hq-${portOf(apiURL)}`)
  const products = path.join(root, 'products')
  const data = path.join(root, 'data')
  const env = {
    HQ_PRODUCTS_DIR: products,
    HQ_REPORTS_DIR: path.join(data, 'reports'),
    HQ_FINANCE_DIR: path.join(data, 'finance'),
  }
  if (process.env.TEST_WORKER_INDEX !== undefined) return env

  fs.rmSync(products, { recursive: true, force: true })
  fs.mkdirSync(products, { recursive: true })
  fs.cpSync(productsDir(), products, { recursive: true })
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { writeSyntheticHq } = require(path.join(
    ROOT,
    'apps/bakery-api/tests/fixtures/hq-data.synthetic.js'
  ))
  const written = writeSyntheticHq(data)
  if (
    written.reportsDir !== env.HQ_REPORTS_DIR ||
    written.financeDir !== env.HQ_FINANCE_DIR
  ) {
    throw new Error('hq-data.synthetic.js schreibt an unerwartete Pfade')
  }
  return env
}

/**
 * Die echte API (F4): `tools/e2e/real-api.js` startet das esbuild-Bundle mit
 * frischer Datenbank und dem E2E-Inhaber. In Entwicklung wird das Bundle vor
 * jedem Start neu gebaut (sonst testete man ein altes), gebaut/CI nur, wenn
 * es fehlt - der CI-Job baut es vorher mit `nx run bakery-api:bundle`.
 *
 * @param {string} apiURL
 * @param {Record<string, string>} hqEnv  aus `prepareE2eHq()`
 * @param {Record<string, string>} [extraEnv]  z. B. `PUBLIC_CATALOGUE`, `CORS_ORIGIN`
 */
function realApiServer(apiURL, hqEnv, extraEnv = {}) {
  return {
    command: 'node tools/e2e/real-api.js',
    url: `${apiURL}/health`,
    env: {
      ...hqEnv,
      PORT: String(portOf(apiURL)),
      BOOTSTRAP_ADMIN_USER: E2E_ADMIN.username,
      BOOTSTRAP_ADMIN_PASSWORD: E2E_ADMIN.password,
      // Backzettel-Stammdaten gibt es in der Suite nicht (no-config).
      HQ_BACKZETTEL_CONFIG: path.join(os.tmpdir(), 'bakery-e2e-keine.yaml'),
      E2E_API_BUILD: usesBuiltApp() ? '' : '1',
      ...extraEnv,
    },
    reuseExistingServer: reuseExistingServer(),
    cwd: ROOT,
    timeout: 120_000,
    // Ohne diese Angabe beendet Playwright den Server mit SIGKILL, und
    // real-api.js kann seine Temp-Datenbank nicht mehr löschen.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
  }
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
 * Die echte API für den Shop (B12): öffentlicher Katalog (`PUBLIC_CATALOGUE`)
 * und der Shop-Origin in `CORS_ORIGIN` - der Shop fragt `GET /api/products`
 * aus dem Browser, ohne Anmeldung. Produkte aus `productsDir()` (über
 * `prepareE2eHq()`), wie bei der Verwaltung.
 *
 * @param {string} apiURL
 * @param {string} baseURL  wo der Shop läuft
 */
function shopApiServer(apiURL, baseURL) {
  return realApiServer(apiURL, prepareE2eHq(apiURL), {
    PUBLIC_CATALOGUE: '1',
    CORS_ORIGIN: new URL(baseURL).origin,
  })
}

/**
 * Die echte API für die Fahrer-App (B8/B12): Anmeldung als E2E-Inhaber, der
 * Origin der App in `CORS_ORIGIN`.
 *
 * @param {string} apiURL
 * @param {string} baseURL  wo die Fahrer-App läuft
 */
function deliveryApiServer(apiURL, baseURL) {
  return realApiServer(apiURL, prepareE2eHq(apiURL), {
    CORS_ORIGIN: new URL(baseURL).origin,
  })
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
  E2E_ADMIN,
  FIXTURE_PRODUCTS_DIR,
  ROOT,
  deliveryApiServer,
  landingApp,
  nextApp,
  prepareE2eHq,
  productsDir,
  realApiServer,
  shopApiServer,
  usesBuiltApp,
}
