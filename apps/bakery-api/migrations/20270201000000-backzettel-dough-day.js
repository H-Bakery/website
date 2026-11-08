'use strict'

/**
 * Z10 Backzettel v2 (docs/backzettel-v2.md §5.1): a sheet belongs to the
 * dough day, its lines to a bake day. Additive; existing rows are backfilled.
 *
 *   backzettel_lines.bake_date    DATEONLY NOT NULL DEFAULT '' - the day the
 *                                 line is baked; `date` stays the sheet
 *                                 (dough) day and keeps its FK to
 *                                 backzettel_days. Backfilled `= date`, so
 *                                 every confirmed day reads exactly as before.
 *   backzettel_deltas.bake_date   same, backfilled `= date`.
 *
 *   index backzettel_lines_date_item_variant (unique date, item, variant)
 *     → backzettel_lines_date_bake_item_variant (unique date, bake_date,
 *       item_id, variant): Saturday's sheet holds Sunday's and Tuesday's rolls.
 *   index backzettel_lines_bake_date, backzettel_deltas_bake_date (bake list).
 *
 * `backzettel_days` is unchanged: `computed_snapshot` gains plan, doughs,
 * machine, bread, rolls, openMasterData (JSON), `preorder_snapshot` entries
 * gain `pickupDate`; a snapshot without `plan` is a day confirmed before Z10
 * (`legacyPlan`).
 *
 * down(): drops the new indexes and columns and restores the old unique
 * index. Only valid while every sheet is same-day (no line with
 * `bake_date <> date`); with such lines the old index cannot hold, and down()
 * refuses instead of losing them.
 *
 * Idempotent like the baseline: columns and indexes only if absent, the
 * backfill only touches rows without a bake date.
 */

const OLD_LINES_INDEX = 'backzettel_lines_date_item_variant'
const LINES_INDEX = 'backzettel_lines_date_bake_item_variant'
const LINES_BAKE_INDEX = 'backzettel_lines_bake_date'
const DELTAS_BAKE_INDEX = 'backzettel_deltas_bake_date'

function bakeDateColumn(Sequelize) {
  // A literal: a plain '' default would pass through the DATEONLY formatter
  // and land in the schema as 'Invalid date'.
  return {
    type: Sequelize.DATEONLY,
    allowNull: false,
    defaultValue: Sequelize.literal("''"),
  }
}

async function indexNames(queryInterface, table) {
  const list = await queryInterface.showIndex(table)
  return new Set(list.map((i) => i.name))
}

async function addColumnAndBackfill(queryInterface, Sequelize, table) {
  const columns = await queryInterface.describeTable(table)
  if (!columns.bake_date) {
    await queryInterface.addColumn(
      table,
      'bake_date',
      bakeDateColumn(Sequelize)
    )
  }
  await queryInterface.sequelize.query(
    `UPDATE ${table} SET bake_date = date WHERE bake_date IS NULL OR bake_date = ''`
  )
}

module.exports = {
  OLD_LINES_INDEX,
  LINES_INDEX,

  up: async (queryInterface, Sequelize) => {
    await addColumnAndBackfill(queryInterface, Sequelize, 'backzettel_lines')
    await addColumnAndBackfill(queryInterface, Sequelize, 'backzettel_deltas')

    const lines = await indexNames(queryInterface, 'backzettel_lines')
    if (lines.has(OLD_LINES_INDEX)) {
      await queryInterface.removeIndex('backzettel_lines', OLD_LINES_INDEX)
    }
    if (!lines.has(LINES_INDEX)) {
      await queryInterface.addIndex(
        'backzettel_lines',
        ['date', 'bake_date', 'item_id', 'variant'],
        { unique: true, name: LINES_INDEX }
      )
    }
    if (!lines.has(LINES_BAKE_INDEX)) {
      await queryInterface.addIndex('backzettel_lines', ['bake_date'], {
        name: LINES_BAKE_INDEX,
      })
    }
    const deltas = await indexNames(queryInterface, 'backzettel_deltas')
    if (!deltas.has(DELTAS_BAKE_INDEX)) {
      await queryInterface.addIndex('backzettel_deltas', ['bake_date'], {
        name: DELTAS_BAKE_INDEX,
      })
    }
  },

  down: async (queryInterface) => {
    const lineColumns = await queryInterface.describeTable('backzettel_lines')
    if (lineColumns.bake_date) {
      const [rows] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS n FROM backzettel_lines WHERE bake_date <> '' AND bake_date <> date"
      )
      if (Number(rows[0].n) > 0) {
        throw new Error(
          'backzettel-dough-day down(): es gibt Zeilen, die an einem anderen Tag gebacken werden als ihr Zettel - der alte eindeutige Index kann sie nicht halten.'
        )
      }
    }
    const lines = await indexNames(queryInterface, 'backzettel_lines')
    for (const name of [LINES_INDEX, LINES_BAKE_INDEX]) {
      if (lines.has(name)) {
        await queryInterface.removeIndex('backzettel_lines', name)
      }
    }
    const deltas = await indexNames(queryInterface, 'backzettel_deltas')
    if (deltas.has(DELTAS_BAKE_INDEX)) {
      await queryInterface.removeIndex('backzettel_deltas', DELTAS_BAKE_INDEX)
    }
    if (lineColumns.bake_date) {
      await queryInterface.removeColumn('backzettel_lines', 'bake_date')
    }
    const deltaColumns = await queryInterface.describeTable('backzettel_deltas')
    if (deltaColumns.bake_date) {
      await queryInterface.removeColumn('backzettel_deltas', 'bake_date')
    }
    // SQLite rebuilds the table on removeColumn; re-read before re-adding.
    const after = await indexNames(queryInterface, 'backzettel_lines')
    if (!after.has(OLD_LINES_INDEX)) {
      await queryInterface.addIndex(
        'backzettel_lines',
        ['date', 'item_id', 'variant'],
        { unique: true, name: OLD_LINES_INDEX }
      )
    }
  },
}
