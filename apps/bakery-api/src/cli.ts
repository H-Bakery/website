/**
 * Operator CLI of the pilot API (B3), bundled to
 * `dist/apps/bakery-api/bundle/cli.js` (second esbuild entry).
 *
 *   node dist/apps/bakery-api/bundle/cli.js create-user \
 *     --username anna --display-name "Anna" --role verkauf
 *   npm run api:create-user -- --username anna --display-name "Anna" --role verkauf
 *
 * Password: env `CREATE_USER_PASSWORD`, else stdin (piped: first line;
 * terminal: asked twice, not echoed). Optional station PIN: env
 * `CREATE_USER_PIN`. Idempotent: an existing user (also a deactivated one)
 * gets the given name, role and password, is reactivated and loses its
 * sessions.
 *
 * B6: `import-partners --file <partner-store.json> [--dry-run]
 * [--update-partners]` copies the mock server's partner store into SQLite
 * (idempotent, one transaction; see `services/partner-import.service.ts`).
 * Exit code 0 = everything imported (or already there), 2 = some entries
 * were not imported (listed), 1 = error, nothing changed.
 *
 * Works against `DB_PATH` (same rules as the server, `.env` in the working
 * directory is read) and runs pending migrations first. Needs no JWT secret.
 *
 * B7/P4 (Vorbestellungen):
 *
 *   cli.js import-preorders --file apps/bakery-api/data/delivery-store.json [--dry-run]
 *   cli.js anonymize-preorders [--dry-run] [--days 90] [--today YYYY-MM-DD]
 *
 * Both are idempotent and print a JSON report on stdout; `anonymize-preorders`
 * (since B8 also the delivery stops, `deliveryStops` in the report) runs nightly from `deploy/systemd/bakery-anonymize.timer` (23:45). It never
 * migrates: with pending migrations it stops (exit 1), so a deploy whose API
 * restart failed does not get its schema changed under the old process.
 *
 * B8 (Liefertouren):
 *
 *   cli.js import-deliveries --file apps/bakery-api/data/delivery-store.json [--dry-run] [--update-depot] [--today YYYY-MM-DD]
 *
 * Stops whose tour date is older than the P4 period (90 days) are anonymised
 * in the same transaction (`--today` pins the date, for tests).
 *
 * copies drivers, tours with stops and the address cache (pickup points and
 * preorders come from `import-preorders`, run it first). Idempotent, one
 * transaction; exit 0 = all imported or already there, 2 = hints listed,
 * 1 = unusable file (checked before the database is opened) or error.
 *
 * Z9 (hq snapshots):
 *
 *   cli.js snapshot-preorders [--date YYYY-MM-DD]
 *
 * writes `data/production/vorbestellungen/<date>.json` (sums per
 * product/variant, counts per channel and pickup point - no names) into the
 * snapshot worktree `HQ_SNAPSHOT_DIR`, commits only `data/production/**` and
 * pushes to `main`. Default date: today (Berlin) - the day that just ended
 * when the timer runs at 22:15. Never migrates. Offline, the commit stays
 * local and the server's retry timer pushes it (exit 0, noted on stderr).
 */
import * as fs from 'fs'

import {
  ConfigError,
  loadConfig,
  loadEnvFile,
  loadHqConfig,
  loadHqSyncConfig,
} from './config/env'
import { openDatabase } from './db/database'
import { pendingMigrations, runMigrations } from './db/migrate'
import { initializeModels } from './models'
import {
  UserInputError,
  upsertUser,
  validateUserInput,
} from './auth/users.service'
import {
  ImportInputError,
  assertPartnerStore,
  formatImportReport,
  importPartnerStore,
} from './services/partner-import.service'
import {
  anonymizePreorders,
  importDeliveryStore,
} from './services/preorders-maintenance'
import { defaultProductsDir } from './services/hq-catalogue'
import {
  DeliveryImportInputError,
  assertDeliveryStore,
  formatDeliveryImportReport,
  importDeliveryTours,
} from './services/delivery-import.service'
import { createGitHubTokenProvider } from './services/github-token'
import { HqSnapshotWriter } from './services/hq-snapshots.service'
import { createVariantsHook } from './services/preorder-variants'
import { isFailure, PreordersService } from './services/preorders.service'

/* eslint-disable @typescript-eslint/no-var-requires */
const snapshotsCore = require('./services/hq-snapshots.core')
const shopOrders = require('./services/shop-orders.core')
/* eslint-enable @typescript-eslint/no-var-requires */

const USAGE = `Aufruf:
  cli.js create-user --username <name> --display-name <Anzeigename> --role <rolle>
  cli.js import-partners --file <partner-store.json> [--dry-run] [--update-partners]

  Rollen: inhaber, verkauf, backstube, backstubenleiter, fahrer
  Passwort: Umgebungsvariable CREATE_USER_PASSWORD, sonst von stdin
            (am Terminal zweimal verdeckt abgefragt)
  PIN (optional, 4-6 Ziffern): Umgebungsvariable CREATE_USER_PIN
  Datenbank: DB_PATH (wie der Server; .env im Arbeitsverzeichnis wird gelesen)

  Legt den Benutzer an oder setzt einen vorhandenen (auch deaktivierten)
  zurück: Name, Rolle und Passwort neu, wieder aktiv, alle Sitzungen beendet.

  import-partners übernimmt den Partner-Store des Mock-Servers
  (apps/bakery-api/data/partner-store.json): Partner (per Kürzel), Vorlagen
  und Besuche mit ihren Preis-Snapshots. Mehrfach ausführbar - Vorhandenes
  wird erkannt und nicht doppelt angelegt. --dry-run rechnet nur durch,
  --update-partners überschreibt Stammdaten und Vorlagen vorhandener
  Partner mit denen aus der Datei. Exit 2: Einträge nicht übernommen.

  cli.js import-preorders --file <delivery-store.json> [--dry-run]
    Übernimmt Sammelstellen und Vorbestellungen aus dem Store des
    Mock-Servers. Idempotent (schon importierte werden übersprungen).

  cli.js import-deliveries --file <delivery-store.json> [--dry-run] [--update-depot] [--today JJJJ-MM-TT]
    Übernimmt Fahrer, Touren mit Stopps und den Adress-Cache aus dem Store
    des Mock-Servers (vorher import-preorders für die Sammelstellen).
    Idempotent. --update-depot übernimmt auch die Adresse der Backstube.
    Exit 2: Hinweise (Einträge ausgelassen oder ohne Verknüpfung).

  cli.js anonymize-preorders [--dry-run] [--days 90] [--today JJJJ-MM-TT]
    DSGVO: Name, Telefon und Anmerkung aller Vorbestellungen, deren
    Abholtag mehr als 90 Tage zurückliegt, werden gelöscht (in jedem
    Status). Migriert nie: bei ausstehenden Migrationen bricht der Lauf ab.

  cli.js snapshot-preorders [--date JJJJ-MM-TT]
    Schreibt die Summen der Vorbestellungen eines Abholtags (Vorgabe: heute)
    nach hq data/production/vorbestellungen/ (HQ_SNAPSHOT_DIR) und überträgt
    sie nach main - ohne Namen, Telefonnummern oder Anmerkungen.`

/** Options without a value. */
const BOOLEAN_FLAGS = new Set(['dry-run', 'update-partners', 'update-depot'])

export function parseArgs(argv: string[]): {
  command: string | undefined
  flags: Record<string, string>
} {
  const [command, ...rest] = argv
  const flags: Record<string, string> = {}
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg)
    if (!match) throw new UserInputError(`Unbekanntes Argument: ${arg}`)
    const [, name, inline] = match
    if (BOOLEAN_FLAGS.has(name)) {
      if (inline !== undefined) {
        throw new UserInputError(`--${name} nimmt keinen Wert.`)
      }
      flags[name] = 'true'
    } else if (inline !== undefined) {
      flags[name] = inline
    } else {
      const value = rest[i + 1]
      if (value === undefined || value.startsWith('--')) {
        throw new UserInputError(`--${name} braucht einen Wert.`)
      }
      flags[name] = value
      i++
    }
  }
  return { command, flags }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

/** Asks on the terminal without echo. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    process.stderr.write(question)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let value = ''
    const finish = (error?: Error) => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.off('data', onData)
      process.stderr.write('\n')
      if (error) reject(error)
      else resolve(value)
    }
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return finish()
        if (ch === '\u0003' || ch === '\u0004') {
          return finish(new UserInputError('Abgebrochen.'))
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on('data', onData)
  })
}

async function readPassword(env: NodeJS.ProcessEnv): Promise<string> {
  if (env['CREATE_USER_PASSWORD']) return env['CREATE_USER_PASSWORD']
  if (process.stdin.isTTY) {
    const first = await promptHidden('Passwort: ')
    const second = await promptHidden('Passwort wiederholen: ')
    if (first !== second) {
      throw new UserInputError('Die Passwörter stimmen nicht überein.')
    }
    return first
  }
  const input = await readStdin()
  return input.split(/\r?\n/)[0] ?? ''
}

async function createUser(flags: Record<string, string>): Promise<void> {
  for (const required of ['username', 'display-name', 'role']) {
    if (!flags[required]) {
      throw new UserInputError(`--${required} fehlt.\n\n${USAGE}`)
    }
  }
  const unknown = Object.keys(flags).filter(
    (f) => !['username', 'display-name', 'role'].includes(f)
  )
  if (unknown.length > 0) {
    throw new UserInputError(`Unbekannte Option: --${unknown[0]}\n\n${USAGE}`)
  }

  const password = await readPassword(process.env)
  const pin = process.env['CREATE_USER_PIN'] || undefined
  const input = {
    username: flags['username'],
    displayName: flags['display-name'],
    role: flags['role'],
    password,
    pin,
  }
  // Before touching the database: bad input must not migrate anything.
  validateUserInput(input)

  await withDatabase(async (dbPath) => {
    const { user, created } = await upsertUser(input)
    console.log(
      `${created ? 'Angelegt' : 'Zurückgesetzt und aktiviert'}: ` +
        `${user.username} (id ${user.id}, Rolle ${user.role}, ` +
        `PIN ${user.hasPin ? 'gesetzt' : 'keine'}) in ${dbPath}`
    )
  })
}

/**
 * Opens `DB_PATH` (server rules), migrates, initialises the models.
 * `migrate: false` refuses a database with pending migrations instead.
 */
async function withDatabase<T>(
  work: (dbPath: string) => Promise<T>,
  options: { migrate?: boolean } = {}
): Promise<T> {
  const config = loadConfig()
  const { sequelize } = await openDatabase({
    storage: config.dbPath,
    busyTimeoutMs: config.dbBusyTimeoutMs,
    logSql: config.dbLogSql,
  })
  try {
    if (options.migrate === false) {
      const pending = await pendingMigrations(sequelize)
      if (pending.length > 0) {
        throw new UserInputError(
          `Die Datenbank ${config.dbPath} hat ${pending.length} ausstehende ` +
            `Migration(en) (${pending.join(', ')}). Dieser Befehl ändert das ` +
            'Schema nicht - bitte zuerst die API (neu) starten, sie migriert beim Start.'
        )
      }
      await initializeModels(sequelize)
      return await work(config.dbPath)
    }
    const migrations = await runMigrations(sequelize, {
      log: (message) => console.error(`[migrate] ${message}`),
    })
    if (migrations.executed.length > 0) {
      console.error(
        `[INFO] ${migrations.executed.length} Migration(en) ausgeführt.`
      )
    }
    await initializeModels(sequelize)
    return await work(config.dbPath)
  } finally {
    await sequelize.close()
  }
}

/** `import-partners` (B6): 0 = alles übernommen, 2 = Einträge ausgelassen. */
async function importPartners(flags: Record<string, string>): Promise<number> {
  const unknown = Object.keys(flags).filter(
    (f) => !['file', 'dry-run', 'update-partners'].includes(f)
  )
  if (unknown.length > 0) {
    throw new UserInputError(`Unbekannte Option: --${unknown[0]}\n\n${USAGE}`)
  }
  const file = flags['file']
  if (!file) throw new UserInputError(`--file fehlt.\n\n${USAGE}`)

  // Read and parse before the database is opened: a bad file migrates nothing.
  let store: unknown
  try {
    store = JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch (error) {
    const reason =
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'nicht gefunden'
        : 'kein gültiges JSON'
    throw new UserInputError(`Datei ${file}: ${reason}.`)
  }
  try {
    assertPartnerStore(store)
  } catch (error) {
    if (error instanceof ImportInputError) {
      throw new UserInputError(`Datei ${file}: ${error.message}`)
    }
    throw error
  }

  return withDatabase(async (dbPath) => {
    let report
    try {
      report = await importPartnerStore(store, {
        dryRun: flags['dry-run'] === 'true',
        updatePartners: flags['update-partners'] === 'true',
      })
    } catch (error) {
      if (error instanceof ImportInputError) {
        throw new UserInputError(error.message)
      }
      throw error
    }
    console.log(`${formatImportReport(report)}\nDatenbank: ${dbPath}`)
    return report.problems.length > 0 ? 2 : 0
  })
}

function onlyFlags(flags: Record<string, string>, allowed: string[]): void {
  const unknown = Object.keys(flags).filter((f) => !allowed.includes(f))
  if (unknown.length > 0) {
    throw new UserInputError(`Unbekannte Option: --${unknown[0]}\n\n${USAGE}`)
  }
}

async function importPreorders(flags: Record<string, string>): Promise<void> {
  onlyFlags(flags, ['file', 'dry-run'])
  if (!flags['file']) throw new UserInputError(`--file fehlt.\n\n${USAGE}`)
  let store: unknown
  try {
    store = JSON.parse(fs.readFileSync(flags['file'], 'utf8'))
  } catch (error) {
    throw new UserInputError(
      `${flags['file']} lässt sich nicht lesen: ${(error as Error).message}`
    )
  }
  const dryRun = flags['dry-run'] === 'true'
  await withDatabase(async () => {
    const report = await importDeliveryStore(store, { dryRun })
    console.log(JSON.stringify(report, null, 2))
    console.error(
      `${dryRun ? '[PROBELAUF] ' : ''}${report.imported.length} importiert, ` +
        `${report.alreadyImported.length} schon vorhanden, ` +
        `${report.skipped.length} übersprungen; Sammelstellen neu: ` +
        `${report.pickupPoints.created.length}.`
    )
  })
}

/** `import-deliveries` (B8): 0 = alles übernommen, 2 = Hinweise. */
async function importDeliveries(
  flags: Record<string, string>
): Promise<number> {
  onlyFlags(flags, ['file', 'dry-run', 'update-depot', 'today'])
  const file = flags['file']
  if (!file) throw new UserInputError(`--file fehlt.\n\n${USAGE}`)
  const today = flags['today']
  if (today !== undefined && !snapshotsCore.isDate(today)) {
    throw new UserInputError('--today muss ein gültiges Datum JJJJ-MM-TT sein.')
  }
  // Read and check before the database is opened: a bad file migrates nothing.
  let store: unknown
  try {
    store = JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch (error) {
    const reason =
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'nicht gefunden'
        : 'kein gültiges JSON'
    throw new UserInputError(`Datei ${file}: ${reason}.`)
  }
  try {
    assertDeliveryStore(store)
  } catch (error) {
    if (error instanceof DeliveryImportInputError) {
      throw new UserInputError(`Datei ${file}: ${error.message}`)
    }
    throw error
  }
  return withDatabase(async (dbPath) => {
    const report = await importDeliveryTours(store, {
      dryRun: flags['dry-run'] === 'true',
      updateDepot: flags['update-depot'] === 'true',
      today,
    })
    console.log(`${formatDeliveryImportReport(report)}\nDatenbank: ${dbPath}`)
    return report.problems.length > 0 ? 2 : 0
  })
}

async function anonymize(flags: Record<string, string>): Promise<void> {
  onlyFlags(flags, ['dry-run', 'days', 'today'])
  let days: number | undefined
  if (flags['days'] !== undefined) {
    days = Number(flags['days'])
    if (!Number.isInteger(days) || days < 1 || String(days) !== flags['days']) {
      throw new UserInputError('--days muss eine ganze Zahl ≥ 1 sein.')
    }
  }
  const today = flags['today']
  if (today !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new UserInputError('--today muss JJJJ-MM-TT sein.')
  }
  const dryRun = flags['dry-run'] === 'true'
  await withDatabase(
    async () => {
      let report
      try {
        report = await anonymizePreorders({ days, today, dryRun })
      } catch (error) {
        throw new UserInputError((error as Error).message)
      }
      console.log(JSON.stringify(report, null, 2))
      console.error(
        `${dryRun ? '[PROBELAUF] ' : ''}${
          report.anonymized.length
        } Vorbestellung(en) ` +
          `mit Abholtag vor ${report.cutoff} anonymisiert; davon ${report.unfinished} ` +
          `nie abgeschlossen (offen/bereit). ${report.deliveryStops.stops.length} ` +
          `Lieferstopp(s) anonymisiert, ${report.deliveryStops.geocacheRemoved} ` +
          `Adress-Cache-Einträge gelöscht. ${report.invoiceDrafts.length} ` +
          `liegengebliebene(r) Rechnungsentwurf/-entwürfe bereinigt.`
      )
    },
    { migrate: false }
  )
}

/** `snapshot-preorders` (Z9): 0 = geschrieben (auch: unverändert, Push folgt). */
async function snapshotPreorders(
  flags: Record<string, string>
): Promise<number> {
  onlyFlags(flags, ['date'])
  const date = flags['date'] ?? shopOrders.berlinToday(new Date())
  if (!snapshotsCore.isDate(date)) {
    throw new UserInputError('--date muss ein gültiges Datum JJJJ-MM-TT sein.')
  }
  const hq = loadHqConfig()
  if (!hq.snapshotDir) {
    throw new UserInputError(
      'HQ_SNAPSHOT_DIR ist nicht gesetzt - wohin soll der Snapshot geschrieben werden?'
    )
  }
  const sync = loadHqSyncConfig()
  const writer = new HqSnapshotWriter({
    snapshotDir: hq.snapshotDir,
    tokenProvider: createGitHubTokenProvider(sync),
    // The server holds the local lock for seconds only; wait generously
    // rather than lose the night's snapshot (the timer does not re-run).
    lockWaitMs: 5 * 60_000,
    log: {
      info: (...a) => console.error('[hq-snapshots]', ...a),
      warn: (...a) => console.error('[hq-snapshots]', ...a),
      error: (...a) => console.error('[hq-snapshots]', ...a),
    },
  })
  const productsDir = hq.productsDir ?? defaultProductsDir()
  const variants = createVariantsHook()
  return withDatabase(
    async () => {
      const day = await new PreordersService({
        productsDir,
        variantsForProduct: variants,
      }).day({ date })
      if (isFailure(day)) throw new UserInputError(day.message)
      const outcome = await writer.writePreorders(day.data, {
        variantsOf: (productId) => variants(productId)?.variants ?? null,
      })
      console.log(JSON.stringify(outcome, null, 2))
      if (!outcome.written) {
        // Nothing on disk: the snapshot has to be made again.
        console.error(
          `Fehler: ${outcome.error?.message ?? 'Snapshot nicht geschrieben.'}`
        )
        return 1
      }
      // Written and committed: a push that has to wait (offline, the server
      // is pushing, a conflict) is the API's retry timer's job.
      console.error(
        `Vorbestellungen ${date}: ` +
          (outcome.committed ? 'neu geschrieben' : 'unverändert') +
          (outcome.pushed
            ? ', in hq (main).'
            : `, noch nicht übertragen (${
                outcome.error?.message ?? 'später'
              }) - die API versucht es alle 15 Minuten erneut.`)
      )
      return 0
    },
    { migrate: false }
  )
}

export async function main(argv: string[]): Promise<number> {
  try {
    loadEnvFile()
    const { command, flags } = parseArgs(argv)
    if (command === 'create-user') {
      await createUser(flags)
      return 0
    }
    if (command === 'import-partners') {
      return await importPartners(flags)
    }
    if (command === 'import-preorders') {
      await importPreorders(flags)
      return 0
    }
    if (command === 'import-deliveries') {
      return await importDeliveries(flags)
    }
    if (command === 'anonymize-preorders') {
      await anonymize(flags)
      return 0
    }
    if (command === 'snapshot-preorders') {
      return await snapshotPreorders(flags)
    }
    if (command === undefined || command === 'help' || command === '--help') {
      console.log(USAGE)
      return command === undefined ? 1 : 0
    }
    console.error(`Unbekannter Befehl: ${command}\n\n${USAGE}`)
    return 1
  } catch (error) {
    if (error instanceof UserInputError || error instanceof ConfigError) {
      console.error(`Fehler: ${error.message}`)
      return 1
    }
    console.error('Fehler:', error)
    return 1
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}
