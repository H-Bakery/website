'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction()

    try {
      // Add reorderPoint column (not in create-inventories migration)
      await queryInterface.addColumn(
        'Inventories',
        'reorderPoint',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 10,
        },
        { transaction }
      )

      // Add supplierContact column (not in create-inventories migration)
      await queryInterface.addColumn(
        'Inventories',
        'supplierContact',
        {
          type: Sequelize.STRING(200),
          allowNull: true,
        },
        { transaction }
      )

      // Add notes column (not in create-inventories migration)
      await queryInterface.addColumn(
        'Inventories',
        'notes',
        {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        { transaction }
      )

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction()

    try {
      await queryInterface.removeColumn('Inventories', 'reorderPoint', {
        transaction,
      })
      await queryInterface.removeColumn('Inventories', 'supplierContact', {
        transaction,
      })
      await queryInterface.removeColumn('Inventories', 'notes', { transaction })

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  },
}
