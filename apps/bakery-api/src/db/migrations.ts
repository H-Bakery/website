/**
 * Static migration list.
 *
 * Every migration is `require`d with a string literal so esbuild bundles it
 * into `main.js` - no glob, no `sequelize-cli` shell-out, nothing read from
 * disk at runtime. A new migration is one new line here; the order of this
 * list is the order of execution.
 *
 * Names keep the `.js` suffix that `sequelize-cli` stored in `SequelizeMeta`,
 * so a database migrated by the CLI is recognised as up to date.
 *
 * B2 replaces these 17 legacy migrations with one pilot baseline.
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
    name: '20250801140000-create-users.js',
    module: require('../../migrations/20250801140000-create-users.js'),
  },
  {
    name: '20250801140100-create-products.js',
    module: require('../../migrations/20250801140100-create-products.js'),
  },
  {
    name: '20250801140200-create-orders.js',
    module: require('../../migrations/20250801140200-create-orders.js'),
  },
  {
    name: '20250801140300-create-order-items.js',
    module: require('../../migrations/20250801140300-create-order-items.js'),
  },
  {
    name: '20250801140400-create-cash.js',
    module: require('../../migrations/20250801140400-create-cash.js'),
  },
  {
    name: '20250801140500-create-chats.js',
    module: require('../../migrations/20250801140500-create-chats.js'),
  },
  {
    name: '20250801140600-create-unsold-products.js',
    module: require('../../migrations/20250801140600-create-unsold-products.js'),
  },
  {
    name: '20250801140700-create-recipes.js',
    module: require('../../migrations/20250801140700-create-recipes.js'),
  },
  {
    name: '20250801140800-create-inventories.js',
    module: require('../../migrations/20250801140800-create-inventories.js'),
  },
  {
    name: '20250801140900-create-notifications.js',
    module: require('../../migrations/20250801140900-create-notifications.js'),
  },
  {
    name: '20250801141000-create-notification-preferences.js',
    module: require('../../migrations/20250801141000-create-notification-preferences.js'),
  },
  {
    name: '20250801141100-create-notification-templates.js',
    module: require('../../migrations/20250801141100-create-notification-templates.js'),
  },
  {
    name: '20250801150000-create-production-tables.js',
    module: require('../../migrations/20250801150000-create-production-tables.js'),
  },
  {
    name: '20250802000000-create-sales-analytics-tables.js',
    module: require('../../migrations/20250802000000-create-sales-analytics-tables.js'),
  },
  {
    name: '20250802000001-enhance-inventory-schema.js',
    module: require('../../migrations/20250802000001-enhance-inventory-schema.js'),
  },
  {
    name: '20250802000002-create-stock-adjustments.js',
    module: require('../../migrations/20250802000002-create-stock-adjustments.js'),
  },
  {
    name: '20260830120000-create-partner-tables.js',
    module: require('../../migrations/20260830120000-create-partner-tables.js'),
  },
]
