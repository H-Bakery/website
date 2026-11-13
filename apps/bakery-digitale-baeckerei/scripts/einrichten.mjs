#!/usr/bin/env node
/**
 * Startet den Einrichten-Modus (DB12): das lokale Werkzeug, mit dem der
 * Inhaber festlegt, was in Theke, Brotregal und Regalen liegt. Heraus kommt
 * die Datei `einrichtung.yaml` für `hq/config/digitale-baeckerei/`.
 *
 * Der Lauf füllt public/ mit `DIGITALE_BAECKEREI_EINRICHTEN=1` (alle Produkte
 * aus hq im Snapshot, die Regal-Modelle aller Produkte, die Einrichtung aus hq
 * und die Belegung der Modelle daneben) und startet dann den Dev-Server mit
 * demselben Schalter - nur dann steckt das Werkzeug in der App.
 *
 * **Nur lokal, nie veröffentlichen:** Ein Export lässt sich mit diesem
 * Schalter nicht bauen (next.config.js bricht ab), und der Export-Wächter
 * weist ab, was dabei in public/ entsteht. Ein normaler Build
 * (`nx build bakery-digitale-baeckerei`) räumt public/ wieder auf.
 *
 * Aufruf: node scripts/einrichten.mjs [--port 4223]
 *   (Nx: `nx run bakery-digitale-baeckerei:einrichten`)
 */
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const at = process.argv.indexOf('--port')
const port = at >= 0 ? process.argv[at + 1] : process.env.PORT || '4223'
if (!/^\d+$/.test(String(port))) {
  console.error('einrichten: --port <nummer>')
  process.exit(1)
}
if (process.env.DIGITALE_BAECKEREI_FIXTURE === '1') {
  console.error(
    'einrichten: nicht zusammen mit DIGITALE_BAECKEREI_FIXTURE - das Werkzeug arbeitet mit den echten Daten.'
  )
  process.exit(1)
}
const env = { ...process.env, DIGITALE_BAECKEREI_EINRICHTEN: '1' }

// Reihenfolge wie beim Bauen: Modell und Belegung, dann Produkte, Modelle, Infopunkte.
for (const skript of [
  'sync-model.mjs',
  'sync-products.mjs',
  'sync-produkte-3d.mjs',
  'sync-rauminfos.mjs',
]) {
  const lauf = spawnSync(process.execPath, [path.join('scripts', skript)], {
    cwd: appDir,
    env,
    stdio: 'inherit',
  })
  if (lauf.status !== 0) process.exit(lauf.status ?? 1)
}

console.log(
  `\neinrichten: Einrichten-Modus auf http://localhost:${port} - die Datei am Ende nach hq/config/digitale-baeckerei/einrichtung.yaml legen.\n`
)
const server = spawn('npx', ['next', 'dev', '--webpack', '-p', String(port)], {
  cwd: appDir,
  env,
  stdio: 'inherit',
})
const beende = () => server.kill('SIGTERM')
process.on('SIGINT', beende)
process.on('SIGTERM', beende)
server.on('exit', (code) => process.exit(code ?? 0))
