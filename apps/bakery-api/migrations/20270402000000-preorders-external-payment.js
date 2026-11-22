'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('preorders')
    if (!columns.external_payment) {
      await queryInterface.addColumn('preorders', 'external_payment', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      })
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('preorders')
    if (columns.external_payment) {
      await queryInterface.removeColumn('preorders', 'external_payment')
    }
  },
}
