'use strict'

/**
 * Z3 Backzettel API: the columns the B2 baseline did not have (roadmap §5.3).
 * Additive only - no table is rebuilt, no data changes.
 *
 *   backzettel_days.preorder_snapshot   the flat preorder positions of the day
 *                                       as they were at confirmation
 *                                       ([{preorderId, productId, variant, qty}]).
 *                                       Deltas are computed against it, per
 *                                       preorder (`computePreorderDeltas`).
 *   backzettel_lines.name/section/unit  snapshot of the item at confirmation, so
 *                                       a confirmed sheet still reads the same
 *                                       after the YAML changes (like the price
 *                                       snapshot on preorder_items).
 *   backzettel_deltas.kind              added | changed | cancelled
 *   backzettel_deltas.acknowledged_at/_by
 *                                       the Backstube has seen it (ack).
 *
 * Idempotent like the baseline: each column only if absent.
 */

const DELTA_KINDS = ['added', 'changed', 'cancelled']

/** Nullable reference to `users.id`; the row survives a deleted user. */
function userRef(Sequelize) {
  return {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  }
}

function columnsToAdd(Sequelize) {
  return {
    backzettel_days: {
      preorder_snapshot: { type: Sequelize.JSON, allowNull: true },
    },
    backzettel_lines: {
      name: { type: Sequelize.STRING, allowNull: true },
      section: { type: Sequelize.STRING(32), allowNull: true },
      unit: { type: Sequelize.STRING(16), allowNull: true },
    },
    backzettel_deltas: {
      kind: { type: Sequelize.STRING(16), allowNull: true },
      acknowledged_at: { type: Sequelize.DATE, allowNull: true },
      acknowledged_by: userRef(Sequelize),
    },
  }
}

module.exports = {
  DELTA_KINDS,

  up: async (queryInterface, Sequelize) => {
    const add = columnsToAdd(Sequelize)
    for (const table of Object.keys(add)) {
      const existing = await queryInterface.describeTable(table)
      for (const [column, spec] of Object.entries(add[table])) {
        if (!existing[column]) {
          await queryInterface.addColumn(table, column, spec)
        }
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    const add = columnsToAdd(Sequelize)
    for (const table of Object.keys(add)) {
      const existing = await queryInterface.describeTable(table)
      for (const column of Object.keys(add[table])) {
        if (existing[column]) {
          await queryInterface.removeColumn(table, column)
        }
      }
    }
  },
}
