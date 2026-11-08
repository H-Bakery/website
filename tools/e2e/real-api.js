#!/usr/bin/env node
/**
 * Startet die echte API (esbuild-Bundle, roadmap B0) für die E2E-Suite der
 * Verwaltung (F4) - mit frischer SQLite-Datenbank je Start, einem Inhaber aus
 * BOOTSTRAP_ADMIN_* und den synthetischen hq-Daten, die `servers.js`
 * vorbereitet hat (Produkte, Kassenberichte, Finanzen). Nichts davon ist echt.
 *
 *   node tools/e2e/real-api.js            # Port aus PORT (Vorgabe 5000)
 *
 * - Das Bundle `dist/apps/bakery-api/bundle/main.js` wird gebaut, wenn es
 *   fehlt oder `E2E_API_BUILD=1` gesetzt ist (in Entwicklung setzt
 *   `servers.js` das, damit kein altes Bundle getestet wird). In CI baut der
 *   Job es vorher (`npx nx run bakery-api:bundle`).
 * - Die Datenbank liegt in einem Temp-Verzeichnis und wird beim Beenden
 *   gelöscht; jeder Lauf beginnt leer (Migrationen, Partner-Seed, Inhaber).
 * - Läuft mit `NODE_ENV=development`: nur dort legt die API den
 *   BOOTSTRAP-Inhaber an.
 */

'use strict'

const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const BUNDLE = path.join(
  ROOT,
  'dist',
  'apps',
  'bakery-api',
  'bundle',
  'main.js'
)

function buildBundle() {
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, 'apps', 'bakery-api', 'build.mjs')],
    { cwd: ROOT, stdio: 'inherit' }
  )
  if (result.status !== 0) {
    console.error('[e2e-api] Bundle-Build fehlgeschlagen')
    process.exit(result.status || 1)
  }
}

if (process.env.E2E_API_BUILD === '1' || !fs.existsSync(BUNDLE)) buildBundle()

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-e2e-api-'))
const env = {
  ...process.env,
  NODE_ENV: 'development',
  HOST: process.env.HOST || '127.0.0.1',
  PORT: process.env.PORT || '5000',
  DB_PATH: path.join(tmp, 'bakery.db'),
  // Feste, synthetische Werte - nur für diese Testinstanz.
  JWT_SECRET:
    process.env.JWT_SECRET || 'e2e-only-secret-not-for-production-0123456789',
}
for (const key of ['BOOTSTRAP_ADMIN_USER', 'BOOTSTRAP_ADMIN_PASSWORD']) {
  if (!env[key]) {
    console.error(`[e2e-api] ${key} fehlt (setzt tools/e2e/servers.js)`)
    process.exit(2)
  }
}

const child = spawn(process.execPath, ['--enable-source-maps', BUNDLE], {
  cwd: tmp,
  env,
  stdio: 'inherit',
})

function cleanup() {
  try {
    fs.rmSync(tmp, { recursive: true, force: true })
  } catch {
    // Temp-Verzeichnis räumt das System auf.
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}
child.on('exit', (code, signal) => {
  cleanup()
  process.exit(code ?? (signal ? 0 : 1))
})
