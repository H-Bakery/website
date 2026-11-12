#!/usr/bin/env node
/**
 * Der Server der Playwright-Suite: liefert den statischen Export der Digitalen
 * Bäckerei unter dem Unterpfad `/digitale-baeckerei` aus - so, wie er später
 * auf der Pages-Seite der Landingpage liegt.
 *
 * 1. Bauen (nur lokal; in CI und mit `E2E_BUILT=1` ist schon gebaut):
 *    `nx build bakery-digitale-baeckerei` mit `DIGITALE_BAECKEREI_FIXTURE=1`
 *    (die Sync-Skripte nehmen dann das synthetische Mini-Modell und den
 *    synthetischen Produkt-Snapshot aus `src/test/fixtures/`) und
 *    `DIGITALE_BAECKEREI_BASE_PATH=/digitale-baeckerei`.
 * 2. Prüfen: Im Export muss genau das Fixture-Modell liegen. Die Suite lädt
 *    Spuren und Screenshots als CI-Artefakt hoch - das echte Modell darf dort
 *    nie auftauchen, also startet der Server sonst nicht.
 * 3. Den Export nach `<tmp>/…/digitale-baeckerei/` kopieren und das
 *    Verzeichnis darüber mit `tools/e2e/serve-static.js` ausliefern.
 *
 * Aufruf: node apps/bakery-digitale-baeckerei-e2e/serve-fixture.js --port 4236
 */
const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { ROOT, usesBuiltApp } = require('../../tools/e2e/servers')
const {
  GLB_PATH,
} = require('../bakery-digitale-baeckerei/src/test/fixtures/fixture-info')

const BASE_PATH = '/digitale-baeckerei'
const PROJECT = 'bakery-digitale-baeckerei'

function fail(message) {
  console.error(`serve-fixture: ${message}`)
  process.exit(1)
}

const portAt = process.argv.indexOf('--port')
const port = Number(portAt >= 0 ? process.argv[portAt + 1] : 4236)
if (!Number.isInteger(port) || port <= 0) fail('--port <nummer> fehlt')

const outDir = path.resolve(
  ROOT,
  process.env.E2E_APP_DIR || `apps/${PROJECT}/out`
)

if (!usesBuiltApp()) {
  execSync(`npx nx build ${PROJECT} --skip-nx-cache`, {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      DIGITALE_BAECKEREI_FIXTURE: '1',
      DIGITALE_BAECKEREI_BASE_PATH: BASE_PATH,
      NX_DAEMON: 'false',
      NODE_ENV: 'production',
    },
  })
}

const model = path.join(outDir, 'model', 'twin.glb')
if (!fs.existsSync(path.join(outDir, 'index.html'))) {
  fail(
    `Kein Export in ${outDir}. Erst bauen: DIGITALE_BAECKEREI_FIXTURE=1 DIGITALE_BAECKEREI_BASE_PATH=${BASE_PATH} npx nx build ${PROJECT}`
  )
}
if (
  !fs.existsSync(model) ||
  !fs.readFileSync(model).equals(fs.readFileSync(GLB_PATH))
) {
  fail(
    `${model} ist nicht das synthetische Fixture. Die Suite läuft nur mit DIGITALE_BAECKEREI_FIXTURE=1 gebaut - nie mit dem echten Modell.`
  )
}

const site = path.join(os.tmpdir(), `digitale-baeckerei-e2e-${port}`)
fs.rmSync(site, { recursive: true, force: true })
fs.mkdirSync(site, { recursive: true })
fs.cpSync(outDir, path.join(site, BASE_PATH.slice(1)), { recursive: true })

// serve-static.js ist ein Kommandozeilen-Skript: mit eigenen Argumenten laden.
process.argv = [
  process.argv[0],
  path.join(ROOT, 'tools/e2e/serve-static.js'),
  site,
  '--port',
  String(port),
]
require('../../tools/e2e/serve-static.js')
