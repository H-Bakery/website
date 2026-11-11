'use strict'

/**
 * „Heute keine“ (Backzettel-Abgleich 11/2026): a line whose Grundmenge is
 * open (`null` in hq) can be decided for the day - a concrete amount goes
 * through the correction as before, „none today“ needs its own mark,
 * because a correction of 0 means „no correction“.
 *
 *   backzettel_lines.none_today   BOOLEAN NOT NULL DEFAULT 0
 *
 * Additive, nothing backfilled: every existing row reads `0` = not decided,
 * so stored days (drafts and confirmed sheets) keep their meaning - an open
 * line without a correction stays „offen“, never 0.
 *
 * down(): `ALTER TABLE … DROP COLUMN` in place (SQLite ≥ 3.35), not
 * `removeColumn`, which rebuilds the table and loses its foreign keys and
 * indexes (see the dough-day migration). Idempotent: column only if absent.
 */

const TABLE = 'backzettel_lines'
const COLUMN = 'none_today'

module.exports = {
  TABLE,
  COLUMN,

  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable(TABLE)
    if (!columns[COLUMN]) {
      await queryInterface.addColumn(TABLE, COLUMN, {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      })
    }
  },

  down: async (queryInterface) => {
    const columns = await queryInterface.describeTable(TABLE)
    if (columns[COLUMN]) {
      await queryInterface.sequelize.query(
        `ALTER TABLE ${TABLE} DROP COLUMN ${COLUMN}`
      )
    }
  },
}
