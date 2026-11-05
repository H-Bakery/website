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
import { ServerConfig, loadConfig } from './config/env'
import { openDatabase } from './db/database'
import { runMigrations } from './db/migrate'
import { initializeModels } from './models'
import { runPartnerSeeder } from './seeders/partner.seeder'

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

  const app = createApp({ sequelize, corsOrigins: config.corsOrigins })
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

  if (config.isProduction) {
    // B0 still mounts the in-memory auth lib (admin/admin123) and unguarded
    // partner routes. Do not deploy before B3 (auth) and B6 (guards).
    console.warn(
      '[WARN] Auth is still the in-memory development lib and /api/partners has no guards. Not fit for deployment before B3 and B6.'
    )
  }

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
