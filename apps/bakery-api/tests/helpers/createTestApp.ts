/**
 * The real pilot API for integration tests: `createApp()` on an in-memory
 * SQLite, migrated with the static migration list (the pilot baseline) and
 * with the models initialised - the same order as `server.ts`, minus listen.
 *
 *   let api: TestApp
 *   beforeAll(async () => { api = await createTestApp({ seedPartners: true }) })
 *   afterAll(() => api.close())
 *   it('...', () => request(api.app).get('/health').expect(200))
 *
 * Models are module-level singletons (`Model.init` binds them to one
 * Sequelize instance), so use one test app per test file. Jest gives every
 * file its own module registry, so files do not interfere.
 */
import { Application } from 'express'
import { Sequelize } from 'sequelize'

import { createApp, CreateAppOptions } from '../../src/app'
import { openDatabase } from '../../src/db/database'
import { runMigrations } from '../../src/db/migrate'
import { MigrationEntry } from '../../src/db/migrations'
import { initializeModels } from '../../src/models'
import { runPartnerSeeder } from '../../src/seeders/partner.seeder'

const QUIET_LOG = {
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

export interface TestAppOptions {
  /** Run the idempotent partner seed (CAP-Markt, id 1), as `server.ts` does. */
  seedPartners?: boolean
  /** Override the migration list (default: the static list of the server). */
  migrations?: MigrationEntry[]
  /** Passed through to `createApp()`; request logging is off by default. */
  app?: Omit<CreateAppOptions, 'sequelize'>
}

export interface TestApp {
  app: Application
  sequelize: Sequelize
  /** Names of the migrations that ran. */
  migrations: string[]
  close: () => Promise<void>
}

export async function createTestApp(
  options: TestAppOptions = {}
): Promise<TestApp> {
  const { sequelize } = await openDatabase({ storage: ':memory:' })
  const result = await runMigrations(sequelize, {
    migrations: options.migrations,
    log: () => undefined,
  })
  await initializeModels(sequelize)

  if (options.seedPartners) {
    const info = console.log
    console.log = () => undefined // the seeder logs on every run
    try {
      await runPartnerSeeder()
    } finally {
      console.log = info
    }
  }

  const app = createApp({
    logRequests: false,
    ...options.app,
    // The hq modules (B4) log their data source on mount; quiet by default.
    hq: { log: QUIET_LOG, ...options.app?.hq },
    sequelize,
  })

  return {
    app,
    sequelize,
    migrations: result.executed,
    close: () => sequelize.close(),
  }
}
