/**
 * SQLite connection for the pilot API.
 *
 * The caller passes the path (`DB_PATH`, see `config/env.ts`).
 *
 * - WAL journal: readers do not block the writer. Persistent in the file.
 * - busy_timeout: per connection. Sequelize's SQLite dialect opens one
 *   connection per transaction and does not run `afterConnect` hooks, so the
 *   timeout is set by wrapping `connectionManager.getConnection`.
 * - Write transactions are serialised in-process (see
 *   `serializeTransactions`) and start as `BEGIN IMMEDIATE`. busy_timeout
 *   alone does not help here: a DEFERRED transaction that reads first and
 *   then writes fails at once with SQLITE_BUSY when it cannot upgrade its
 *   lock (SQLite skips the busy handler to avoid a deadlock), and many
 *   IMMEDIATE transactions busy-waiting at the same time fill node-sqlite3's
 *   libuv threadpool so the lock holder cannot finish. The API is the only
 *   writer, so one transaction at a time costs nothing and never fails.
 */
import { AsyncLocalStorage } from 'async_hooks'
import { Sequelize, Transaction } from 'sequelize'

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
    // Take the write lock at BEGIN (waits via busy_timeout) instead of
    // failing on the read→write upgrade. Guards against writers outside
    // the queue below (autocommit statements, sqlite3 CLI, backups).
    transactionType: Transaction.TYPES.IMMEDIATE,
  })
  serializeTransactions(sequelize)

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

type TransactionFn = (...args: unknown[]) => Promise<unknown>

/**
 * Wraps `sequelize.transaction` in a FIFO queue: one transaction at a time.
 *
 * - Managed (`transaction(fn)` / `transaction(opts, fn)`): the slot is held
 *   until the callback's transaction has committed or rolled back.
 * - Unmanaged (`await transaction()`): the slot is held until `commit()` or
 *   `rollback()` - a caller that does neither blocks the queue. Prefer the
 *   managed form.
 * - Re-entrant: a `transaction()` call made from inside a managed callback
 *   bypasses the queue (otherwise it would wait for itself forever). Pass
 *   `{ transaction }` to get a savepoint on the same connection.
 */
export function serializeTransactions(sequelize: Sequelize): void {
  const target = sequelize as unknown as { transaction: TransactionFn }
  const original: TransactionFn = target.transaction.bind(sequelize)
  const inside = new AsyncLocalStorage<true>()
  let tail: Promise<void> = Promise.resolve()

  const acquire = async (): Promise<() => void> => {
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    const previous = tail
    tail = previous.then(() => held)
    await previous
    let released = false
    return () => {
      if (!released) {
        released = true
        release()
      }
    }
  }

  target.transaction = async (...args: unknown[]) => {
    if (inside.getStore()) return original(...args)

    const callback = args.find((arg) => typeof arg === 'function') as
      | ((t: Transaction) => unknown)
      | undefined
    const release = await acquire()

    if (callback) {
      try {
        return await inside.run(true, () => original(...args))
      } finally {
        release()
      }
    }

    try {
      const transaction = (await original(...args)) as Transaction
      for (const method of ['commit', 'rollback'] as const) {
        const done = transaction[method].bind(transaction)
        transaction[method] = async () => {
          try {
            return await done()
          } finally {
            release()
          }
        }
      }
      return transaction
    } catch (error) {
      release()
      throw error
    }
  }
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
