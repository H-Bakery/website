'use strict'

/**
 * W4 verification round 4 - `preorders.request_id` (STRING(64), nullable,
 * unique).
 *
 * The entry form sends one id per order it is saving and keeps it across
 * retries. A save whose answer was lost (Wi-Fi drop after the request left
 * the tablet) used to create the same order twice with two codes when the
 * seller tapped "Speichern" again; with the id the second POST returns the
 * order the first one created. NULL for everything else (alias, shop,
 * imports, rows from before). SQLite and Postgres both allow several NULLs
 * under a unique index.
 *
 * Idempotent: column and index are added only if missing.
 */
const INDEX = 'preorders_request_id_unique'

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('preorders')
    if (!columns.request_id) {
      await queryInterface.addColumn('preorders', 'request_id', {
        type: Sequelize.STRING(64),
        allowNull: true,
      })
    }
    const indexes = await queryInterface.showIndex('preorders')
    if (!indexes.some((i) => i.name === INDEX)) {
      await queryInterface.addIndex('preorders', ['request_id'], {
        name: INDEX,
        unique: true,
      })
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('preorders')
    if (indexes.some((i) => i.name === INDEX)) {
      await queryInterface.removeIndex('preorders', INDEX)
    }
    const columns = await queryInterface.describeTable('preorders')
    if (columns.request_id) {
      await queryInterface.removeColumn('preorders', 'request_id')
    }
  },
}
