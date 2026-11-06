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
  {
    // Z3: Backzettel snapshot columns, delta acknowledgement
    name: '20261112000000-backzettel-z3.js',
    module: require('../../migrations/20261112000000-backzettel-z3.js'),
  },
  {
    // B7: preorders.not_collected_at, Sammelstelle Mörsbach seed
    name: '20261113000000-preorders-b7.js',
    module: require('../../migrations/20261113000000-preorders-b7.js'),
  },
  {
    // W4 verification round 2: preorders.paid_amount
    name: '20261114000000-preorders-paid-amount.js',
    module: require('../../migrations/20261114000000-preorders-paid-amount.js'),
  },
  {
    // W4 verification round 4: preorders.request_id (idempotent create)
    name: '20261116000000-preorders-request-id.js',
    module: require('../../migrations/20261116000000-preorders-request-id.js'),
  },
  {
    // M4 (after the pilot): rest_counts - „Rest am Abend“
    name: '20261201000000-rest-am-abend.js',
    module: require('../../migrations/20261201000000-rest-am-abend.js'),
  },
]
