'use strict'

/**
 * Rest am Abend (M4), Abschluss-Verifikation next - `rest_counts.line_rows`
 * (TEXT, nullable): the count lines of the Posten × Sorte **as they were when
 * it was counted**, as a JSON array of product ids (`''` = counted in the
 * item's own unit), written onto every stored row of the line on each save.
 *
 * Without it, completeness was judged against today's `backzettel.yaml`:
 * adding a second product to a Posten turned every earlier, fully counted day
 * of that Posten into "teilweise gezählt" and dropped its whole history out of
 * the evaluation and Rest Ø. `NULL` (rows from before this column) falls back
 * to the current config, as before.
 *
 * Idempotent: the column is added only if missing.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('rest_counts')
    if (!columns.line_rows) {
      await queryInterface.addColumn('rest_counts', 'line_rows', {
        type: Sequelize.TEXT,
        allowNull: true,
      })
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('rest_counts')
    if (columns.line_rows) {
      await queryInterface.removeColumn('rest_counts', 'line_rows')
    }
  },
}
