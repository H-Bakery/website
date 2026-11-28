'use strict'

const COLUMNS = ['external_payment', 'mixed_payment']

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('preorders')
    for (const column of COLUMNS) {
      if (columns[column]) continue
      await queryInterface.addColumn('preorders', column, {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      })
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('preorders')
    // In SQLite bleiben beim direkten DROP COLUMN Fremdschlüssel und Indizes erhalten.
    for (const column of COLUMNS) {
      if (!columns[column]) continue
      await queryInterface.sequelize.query(
        `ALTER TABLE preorders DROP COLUMN ${column}`
      )
    }
  },
}
