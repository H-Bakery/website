'use strict'

/**
 * Z10 owner decision O5 (2026-11-08, docs/backzettel-v2.md §8): the bake
 * list gets its own „gebacken“ tick, separate from the dough-day „done“
 * tick (on a lead > 0 line „done“ = made). Additive, nothing backfilled -
 * no row was baked-ticked before.
 *
 *   backzettel_lines.baked_at / baked_by    the bake-list row (frozen line)
 *   backzettel_deltas.baked_at / baked_by   a Nachtrag, ticked on its own
 *
 * `baked_by` references `users` like `done_by` / `acknowledged_by`
 * (ON DELETE SET NULL). The ticks live and die with their row: a re-confirm
 * that deletes a line or discards the Nachträge takes their ticks with it.
 *
 * down(): `ALTER TABLE … DROP COLUMN` in place (SQLite ≥ 3.35), not
 * `removeColumn` - the latter rebuilds the table and loses its foreign keys
 * and indexes (see the dough-day migration). The new columns are not
 * indexed; a column-level REFERENCES clause drops with its column.
 *
 * Idempotent like the others: columns only if absent.
 */

const TABLES = ['backzettel_lines', 'backzettel_deltas']

function userRef(Sequelize) {
  return {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  }
}

module.exports = {
  TABLES,

  up: async (queryInterface, Sequelize) => {
    for (const table of TABLES) {
      const columns = await queryInterface.describeTable(table)
      if (!columns.baked_at) {
        await queryInterface.addColumn(table, 'baked_at', {
          type: Sequelize.DATE,
          allowNull: true,
        })
      }
      if (!columns.baked_by) {
        await queryInterface.addColumn(table, 'baked_by', userRef(Sequelize))
      }
    }
  },

  down: async (queryInterface) => {
    for (const table of TABLES) {
      const columns = await queryInterface.describeTable(table)
      for (const column of ['baked_by', 'baked_at']) {
        if (columns[column]) {
          await queryInterface.sequelize.query(
            `ALTER TABLE ${table} DROP COLUMN ${column}`
          )
        }
      }
    }
  },
}
