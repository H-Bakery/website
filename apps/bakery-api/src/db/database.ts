/**
 * SQLite connection for the pilot API.
 *
 * Replaces the module-level singleton in `@bakery/api/database`, whose path is
 * hardcoded to `database.db` relative to the working directory. Here the
 * caller passes the path (`DB_PATH`, see `config/env.ts`).
 *
 * - WAL journal: readers do not block the writer. Persistent in the file.
 * - busy_timeout: per connection. Sequelize's SQLite dialect opens one
 *   connection per transaction and does not run `afterConnect` hooks, so the
 *   timeout is set by wrapping `connectionManager.getConnection`.
 */
import { Sequelize } from 'sequelize'

export interface OpenDatabaseOptions {
  /** Absolute file path or `:memory:`. */
  storage: string
  busyTimeoutMs?: number
  logSql?: boolean
}

interface Sqlite3Connection {
  configure?: (option: 'busyTimeout', value: number) => void
}

export function createSequelize(options: OpenDatabaseOptions): Sequelize {
  const busyTimeoutMs = options.busyTimeoutMs ?? 5000
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: options.storage,
    logging: options.logSql
      ? (sql: string) => console.log(`[DB] ${sql}`)
      : false,
  })

  const manager = sequelize.connectionManager as unknown as {
    getConnection: (opts?: unknown) => Promise<Sqlite3Connection>
  }
  const original = manager.getConnection.bind(manager)
  const configured = new WeakSet<object>()
  manager.getConnection = async (opts?: unknown) => {
    const connection = await original(opts)
    if (connection && !configured.has(connection)) {
      connection.configure?.('busyTimeout', busyTimeoutMs)
      configured.add(connection)
    }
    return connection
  }

  return sequelize
}

export interface DatabaseInfo {
  journalMode: string
  busyTimeoutMs: number
}

/**
 * Opens the connection and switches the file to WAL. Throws if the file
 * cannot be opened (missing permissions, corrupt file).
 */
export async function openDatabase(
  options: OpenDatabaseOptions
): Promise<{ sequelize: Sequelize; info: DatabaseInfo }> {
  const sequelize = createSequelize(options)
  await sequelize.authenticate()

  let journalMode = 'memory'
  if (options.storage !== ':memory:') {
    const [rows] = (await sequelize.query('PRAGMA journal_mode = WAL')) as [
      Array<{ journal_mode: string }>,
      unknown
    ]
    journalMode = rows[0]?.journal_mode ?? 'unknown'
  }
  const [timeoutRows] = (await sequelize.query('PRAGMA busy_timeout')) as [
    Array<Record<string, number>>,
    unknown
  ]
  const busyTimeoutMs = Number(Object.values(timeoutRows[0] ?? {})[0] ?? 0)

  return { sequelize, info: { journalMode, busyTimeoutMs } }
}
