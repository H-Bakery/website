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

export interface RunningServer {
  server: http.Server
  sequelize: Sequelize
  config: ServerConfig
  close: () => Promise<void>
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

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(config.port, () => {
      server.off('error', reject)
      resolve()
    })
  })
  console.log(`[INFO] bakery-api listening on http://localhost:${config.port}`)

  let closing: Promise<void> | null = null
  const close = () => {
    if (!closing) {
      closing = new Promise<void>((resolve) => server.close(() => resolve()))
        .then(() => sequelize.close())
        .then(() => undefined)
    }
    return closing
  }

  return { server, sequelize, config, close }
}
