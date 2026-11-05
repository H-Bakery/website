/**
 * Runs the static migration list in-process through Umzug.
 *
 * Bookkeeping lives in `SequelizeMeta` (same table and column as
 * `sequelize-cli`), so existing databases continue where they stopped.
 * `sequelize.sync()` is never used at runtime: the schema is whatever the
 * migrations say.
 */
import { Sequelize } from 'sequelize'
import { SequelizeStorage, Umzug } from 'umzug'
import { MIGRATIONS, MigrationEntry } from './migrations'

export interface MigrationResult {
  executed: string[]
  pending: string[]
}

function createUmzug(
  sequelize: Sequelize,
  migrations: MigrationEntry[],
  log: (message: string) => void
) {
  const queryInterface = sequelize.getQueryInterface()
  return new Umzug({
    migrations: migrations.map(({ name, module }) => ({
      name,
      up: async () => {
        await module.up(queryInterface, Sequelize)
      },
      down: async () => {
        if (!module.down) {
          throw new Error(`Migration ${name} has no down()`)
        }
        await module.down(queryInterface, Sequelize)
      },
    })),
    context: queryInterface,
    storage: new SequelizeStorage({ sequelize }),
    logger: {
      info: (event: Record<string, unknown>) => {
        if (event['event'] === 'migrated') log(`migrated ${event['name']}`)
      },
      warn: (event: Record<string, unknown>) =>
        console.warn('[WARN] [migrate]', event),
      error: (event: Record<string, unknown>) =>
        console.error('[ERROR] [migrate]', event),
      debug: () => undefined,
    },
  })
}

/** Applies all pending migrations, in list order. Throws on the first failure. */
export async function runMigrations(
  sequelize: Sequelize,
  options: {
    migrations?: MigrationEntry[]
    log?: (message: string) => void
  } = {}
): Promise<MigrationResult> {
  const log =
    options.log ??
    ((message: string) => console.log(`[INFO] [migrate] ${message}`))
  const umzug = createUmzug(sequelize, options.migrations ?? MIGRATIONS, log)
  const executed = await umzug.up()
  const pending = await umzug.pending()
  return {
    executed: executed.map((m) => m.name),
    pending: pending.map((m) => m.name),
  }
}
