/**
 * Starts the pilot API: config → open SQLite → migrations (Umzug, static
 * list) → `initializeModels()` → idempotent partner seed → listen.
 *
 * The order matters: models are initialised against the schema the
 * migrations produced; `sequelize.sync()` is never called at runtime.
 */
import * as http from 'http'
import { Sequelize } from 'sequelize'

import { createApp } from './app'
import {
  ServerConfig,
  loadConfig,
  loadHqConfig,
  loadHqSyncConfig,
} from './config/env'
import { openDatabase } from './db/database'
import { runMigrations } from './db/migrate'
import { initializeModels } from './models'
import { runPartnerSeeder } from './seeders/partner.seeder'
import { bootstrapAdmin } from './auth/users.service'
import { defaultProductsDir } from './services/hq-catalogue'
import { HqEditsSync } from './services/hq-edits-sync.service'
import { HqSnapshotWriter } from './services/hq-snapshots.service'

/** How long shutdown waits for running requests before cutting them. */
export const SHUTDOWN_DEADLINE_MS = 10_000

export interface RunningServer {
  server: http.Server
  sequelize: Sequelize
  config: ServerConfig
  close: (deadlineMs?: number) => Promise<void>
}

export async function startServer(
  config: ServerConfig = loadConfig()
): Promise<RunningServer> {
  console.log(`[INFO] Starting bakery-api (${config.nodeEnv})`)
  // Before the database: a misconfigured hq must not migrate anything.
  const hq = loadHqConfig()
  const hqSync = loadHqSyncConfig()
  console.log(`[INFO] Database: ${config.dbPath}`)

  const { sequelize, info } = await openDatabase({
    storage: config.dbPath,
    busyTimeoutMs: config.dbBusyTimeoutMs,
    logSql: config.dbLogSql,
  })
  console.log(
    `[INFO] SQLite journal_mode=${info.journalMode} busy_timeout=${info.busyTimeoutMs}ms`
  )

  const migrations = await runMigrations(sequelize)
  console.log(
    `[INFO] Migrations: ${migrations.executed.length} applied, ${migrations.pending.length} pending`
  )

  await initializeModels(sequelize)
  await runPartnerSeeder()
  // Development only (BOOTSTRAP_ADMIN_USER/_PASSWORD); production accounts
  // come from the create-user CLI.
  await bootstrapAdmin()

  if (config.isProduction && (!config.hqReportsDir || !config.hqFinanceDir)) {
    // Not fatal: the endpoints answer "keine Daten" - but on the box the
    // default `<website>/../hq` is almost certainly not the read clone.
    console.warn(
      '[WARN] HQ_REPORTS_DIR / HQ_FINANCE_DIR not set - reports, finance and Tagesziel read <website>/../hq/data.'
    )
  }
  const hqProductsDir = hq.productsDir ?? defaultProductsDir()
  const hqWriteDir = hq.writeDir
  console.log(`[INFO] hq products: ${hqProductsDir}`)
  console.log(
    hqWriteDir
      ? `[INFO] hq writes: commits in ${hqWriteDir}/products`
      : '[INFO] hq writes: HQ_WRITE_DIR not set, writing to the read dir (development)'
  )

  // B5b: push app/edits + one rolling PR; Z9: snapshots to main. Both retry
  // every 15 min (unref'd timers) and are stopped on close.
  const edits = new HqEditsSync({
    writeDir: hqWriteDir,
    token: hqSync.token,
    githubRepo: hqSync.githubRepo,
    githubApiUrl: hqSync.githubApiUrl,
    retryMs: hqSync.retryMs,
  })
  const snapshots = new HqSnapshotWriter({
    snapshotDir: hq.snapshotDir,
    token: hqSync.token,
    retryMs: hqSync.retryMs,
  })
  console.log(
    edits.enabled
      ? `[INFO] hq write-back: app/edits -> PR in ${hqSync.githubRepo}`
      : `[INFO] hq write-back off: ${edits.disabledReason}`
  )
  console.log(
    snapshots.enabled
      ? `[INFO] hq snapshots: ${hq.snapshotDir} (data/production/** -> main)`
      : `[INFO] hq snapshots off: ${snapshots.status().reason}`
  )
  await edits.init()

  const app = createApp({
    hqProducts: { productsDir: hqProductsDir, writeDir: hqWriteDir },
    hqSync: { edits, snapshots },
    sequelize,
    corsOrigins: config.corsOrigins,
    trustProxy: config.trustProxy,
    hq: { reportsDir: config.hqReportsDir, financeDir: config.hqFinanceDir },
    publicCatalogue: config.publicCatalogue,
  })
  if (config.publicCatalogue) {
    console.log('[INFO] PUBLIC_CATALOGUE: GET /api/products without a session')
  }
  const server = http.createServer(app)

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(config.port, config.host, () => {
        server.off('error', reject)
        resolve()
      })
    })
  } catch (error) {
    await sequelize.close().catch(() => undefined)
    throw error
  }
  console.log(
    `[INFO] bakery-api listening on http://${config.host ?? 'localhost'}:${
      config.port
    }`
  )
  edits.start()
  snapshots.start()
  // W4: catch up Backzettel deltas missed while no master data was loadable
  // (or written by the CLI import) - in the background, never fatal.
  const reconcile = app.locals['reconcileBackzettelDeltas'] as
    | (() => Promise<{ date: string; recorded: number | null }[]>)
    | undefined
  reconcile?.()
    .then((days) => {
      const recorded = days.filter((d) => d.recorded)
      if (recorded.length > 0) {
        console.log(
          `[INFO] Backzettel: Deltas nachgetragen für ${recorded
            .map((d) => `${d.date} (${d.recorded})`)
            .join(', ')}`
        )
      }
    })
    .catch((error) =>
      console.error('[WARN] Backzettel-Delta-Abgleich beim Start:', error)
    )

  let closing: Promise<void> | null = null
  const close = (deadlineMs = SHUTDOWN_DEADLINE_MS) => {
    if (!closing) {
      closing = new Promise<void>((resolve) => {
        // Keep-alive sockets would hold server.close() open; drop idle ones
        // now and cut the rest after the deadline (systemd sends SIGKILL
        // after TimeoutStopSec otherwise, without closing the DB).
        const timer = setTimeout(() => {
          console.warn(
            `[WARN] Requests still open after ${deadlineMs} ms - closing connections`
          )
          server.closeAllConnections()
        }, deadlineMs)
        timer.unref()
        server.close(() => {
          clearTimeout(timer)
          resolve()
        })
        server.closeIdleConnections()
      })
        .then(() => {
          edits.stop()
          snapshots.stop()
        })
        .then(() => sequelize.close())
        .then(() => undefined)
    }
    return closing
  }

  return { server, sequelize, config, close }
}
