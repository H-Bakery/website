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
 */
import * as fs from 'fs'

import { ConfigError, loadConfig, loadEnvFile } from './config/env'
import { openDatabase } from './db/database'
import { runMigrations } from './db/migrate'
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

const USAGE = `Aufruf:
  cli.js create-user --username <name> --display-name <Anzeigename> --role <rolle>
  cli.js import-partners --file <partner-store.json> [--dry-run] [--update-partners]

  Rollen: inhaber, verkauf, backstube, fahrer
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
  Partner mit denen aus der Datei. Exit 2: Einträge nicht übernommen.`

/** Options without a value. */
const BOOLEAN_FLAGS = new Set(['dry-run', 'update-partners'])

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

/** Opens `DB_PATH` (server rules), migrates, initialises the models. */
async function withDatabase<T>(fn: (dbPath: string) => Promise<T>): Promise<T> {
  const config = loadConfig()
  const { sequelize } = await openDatabase({
    storage: config.dbPath,
    busyTimeoutMs: config.dbBusyTimeoutMs,
    logSql: config.dbLogSql,
  })
  try {
    const migrations = await runMigrations(sequelize, {
      log: (message) => console.error(`[migrate] ${message}`),
    })
    if (migrations.executed.length > 0) {
      console.error(
        `[INFO] ${migrations.executed.length} Migration(en) ausgeführt.`
      )
    }
    await initializeModels(sequelize)
    return await fn(config.dbPath)
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
