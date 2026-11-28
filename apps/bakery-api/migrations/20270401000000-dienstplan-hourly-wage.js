'use strict'

/**
 * Dienstplan: Stundenlohn je Mitarbeiter (geschätzte Überstundenbezahlung,
 * 11/2026).
 *
 *   employees.hourly_wage_cents   INTEGER NULL   Bruttostundenlohn in Cent
 *
 * Personal data (D13): it stays in the box's SQLite, never in hq, and the
 * audit log only says `hourlyWageChanged: true`, never the amount.
 *
 * Additive, nothing backfilled: every existing employee reads `NULL` = "not
 * entered" ("Stundenlohn offen"), never 0 - no estimate without a wage.
 * Plain `ALTER TABLE … ADD COLUMN` (Sequelize's `addColumn` on SQLite), no
 * table rebuild, so the rows, the `user_id` foreign key and the indexes stay
 * as they are on the box.
 *
 * down(): `ALTER TABLE … DROP COLUMN` in place (SQLite ≥ 3.35), not
 * `removeColumn`, which rebuilds the table and loses its foreign keys (see
 * the dough-day migration). Idempotent: the column only if absent; without
 * an `employees` table (Dienstplan migration undone) nothing happens.
 */

const TABLE = 'employees'
const COLUMN = 'hourly_wage_cents'

async function hasTable(queryInterface) {
  const tables = await queryInterface.showAllTables()
  return tables
    .map((t) => String(typeof t === 'string' ? t : t.tableName).toLowerCase())
    .includes(TABLE)
}

module.exports = {
  TABLE,
  COLUMN,

  up: async (queryInterface, Sequelize) => {
    if (!(await hasTable(queryInterface))) return
    const columns = await queryInterface.describeTable(TABLE)
    if (!columns[COLUMN]) {
      await queryInterface.addColumn(TABLE, COLUMN, {
        type: Sequelize.INTEGER,
        allowNull: true,
      })
    }
  },

  down: async (queryInterface) => {
    if (!(await hasTable(queryInterface))) return
    const columns = await queryInterface.describeTable(TABLE)
    if (columns[COLUMN]) {
      await queryInterface.sequelize.query(
        `ALTER TABLE ${TABLE} DROP COLUMN ${COLUMN}`
      )
    }
  },
}
