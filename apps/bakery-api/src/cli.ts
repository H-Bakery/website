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
 * Works against `DB_PATH` (same rules as the server, `.env` in the working
 * directory is read) and runs pending migrations first. Needs no JWT secret.
 *
 * B7/P4 (Vorbestellungen):
 *
 *   cli.js import-preorders --file apps/bakery-api/data/delivery-store.json [--dry-run]
 *   cli.js anonymize-preorders [--dry-run] [--days 90] [--today YYYY-MM-DD]
 *
 * Both are idempotent and print a JSON report on stdout; `anonymize-preorders`
 * runs nightly from `deploy/systemd/bakery-anonymize.timer` (23:45). It never
 * migrates: with pending migrations it stops (exit 1), so a deploy whose API
 * restart failed does not get its schema changed under the old process.
 */
import * as fs from 'fs'

import { ConfigError, loadConfig, loadEnvFile } from './config/env'
import { openDatabase } from './db/database'
import { pendingMigrations, runMigrations } from './db/migrate'
import { initializeModels } from './models'
import {
  UserInputError,
  upsertUser,
  validateUserInput,
} from './auth/users.service'
import {
  anonymizePreorders,
  importDeliveryStore,
} from './services/preorders-maintenance'

const USAGE = `Aufruf:
  cli.js create-user --username <name> --display-name <Anzeigename> --role <rolle>

  Rollen: inhaber, verkauf, backstube, fahrer
  Passwort: Umgebungsvariable CREATE_USER_PASSWORD, sonst von stdin
            (am Terminal zweimal verdeckt abgefragt)
  PIN (optional, 4-6 Ziffern): Umgebungsvariable CREATE_USER_PIN
  Datenbank: DB_PATH (wie der Server; .env im Arbeitsverzeichnis wird gelesen)

  Legt den Benutzer an oder setzt einen vorhandenen (auch deaktivierten)
  zurück: Name, Rolle und Passwort neu, wieder aktiv, alle Sitzungen beendet.

  cli.js import-preorders --file <delivery-store.json> [--dry-run]
    Übernimmt Sammelstellen und Vorbestellungen aus dem Store des
    Mock-Servers. Idempotent (schon importierte werden übersprungen).

  cli.js anonymize-preorders [--dry-run] [--days 90] [--today JJJJ-MM-TT]
    DSGVO: Name, Telefon und Anmerkung aller Vorbestellungen, deren
    Abholtag mehr als 90 Tage zurückliegt, werden gelöscht (in jedem
    Status). Migriert nie: bei ausstehenden Migrationen bricht der Lauf ab.`

/** Flags without a value. */
const BOOLEAN_FLAGS = new Set(['dry-run'])

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
    if (inline !== undefined) {
      flags[name] = inline
    } else if (BOOLEAN_FLAGS.has(name)) {
      flags[name] = 'true'
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
async function withDatabase(
  work: (dbPath: string) => Promise<void>,
  options: { migrate?: boolean } = {}
): Promise<void> {
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
      await work(config.dbPath)
      return
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
    await work(config.dbPath)
  } finally {
    await sequelize.close()
  }
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
          `nie abgeschlossen (offen/bereit).`
      )
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
    if (command === 'import-preorders') {
      await importPreorders(flags)
      return 0
    }
    if (command === 'anonymize-preorders') {
      await anonymize(flags)
      return 0
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
