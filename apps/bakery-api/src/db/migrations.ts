/**
 * Static migration list.
 *
 * Every migration is `require`d with a string literal so esbuild bundles it
 * into `main.js` - no glob, no `sequelize-cli` shell-out, nothing read from
 * disk at runtime. A new migration is one new line here; the order of this
 * list is the order of execution.
 *
 * B2: one pilot baseline replaces the 17 legacy migrations (archived in
 * `migrations/archive/`, not loaded). The baseline is idempotent, so a
 * database that ran the legacy list - whose names stay in `SequelizeMeta` -
 * runs it once and keeps its partner data (see the migration's header).
 */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface LegacyMigration {
  up: (queryInterface: unknown, Sequelize: unknown) => Promise<unknown>
  down?: (queryInterface: unknown, Sequelize: unknown) => Promise<unknown>
}

export interface MigrationEntry {
  name: string
  module: LegacyMigration
}

export const MIGRATIONS: MigrationEntry[] = [
  {
    name: '20261105000000-pilot-baseline.js',
    module: require('../../migrations/20261105000000-pilot-baseline.js'),
  },
  {
    // B3: stations, auth_sessions, refresh_tokens.session_id
    name: '20261106000000-auth-sessions-stations.js',
    module: require('../../migrations/20261106000000-auth-sessions-stations.js'),
  },
]
