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
import { ServerConfig, loadConfig, loadHqConfig } from './config/env'
import { openDatabase } from './db/database'
import { runMigrations } from './db/migrate'
import { initializeModels } from './models'
import { runPartnerSeeder } from './seeders/partner.seeder'
import { bootstrapAdmin } from './auth/users.service'
import { defaultProductsDir } from './services/hq-catalogue'

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

  const hqProductsDir = hq.productsDir ?? defaultProductsDir()
  const hqWriteDir = hq.writeDir
  console.log(`[INFO] hq products: ${hqProductsDir}`)
  console.log(
    hqWriteDir
      ? `[INFO] hq writes: commits in ${hqWriteDir}/products`
      : '[INFO] hq writes: HQ_WRITE_DIR not set, writing to the read dir (development)'
  )

  const app = createApp({
    hqProducts: { productsDir: hqProductsDir, writeDir: hqWriteDir },
    sequelize,
    corsOrigins: config.corsOrigins,
    trustProxy: config.trustProxy,
  })
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
        .then(() => sequelize.close())
        .then(() => undefined)
    }
    return closing
  }

  return { server, sequelize, config, close }
}
