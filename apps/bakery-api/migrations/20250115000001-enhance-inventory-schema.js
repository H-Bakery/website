'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction()

    try {
      // Add reorderPoint column
      await queryInterface.addColumn(
        'inventory',
        'reorderPoint',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 10,
        },
        { transaction }
      )

      // Add unit column
      await queryInterface.addColumn(
        'inventory',
        'unit',
        {
          type: Sequelize.STRING(50),
          allowNull: true,
          defaultValue: 'pieces',
        },
        { transaction }
      )

      // Add category column
      await queryInterface.addColumn(
        'inventory',
        'category',
        {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
        { transaction }
      )

      // Add supplier column
      await queryInterface.addColumn(
        'inventory',
        'supplier',
        {
          type: Sequelize.STRING(200),
          allowNull: true,
        },
        { transaction }
      )

      // Add supplierContact column
      await queryInterface.addColumn(
        'inventory',
        'supplierContact',
        {
          type: Sequelize.STRING(200),
          allowNull: true,
        },
        { transaction }
      )

      // Add notes column
      await queryInterface.addColumn(
        'inventory',
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
      await queryInterface.removeColumn('inventory', 'reorderPoint', {
        transaction,
      })
      await queryInterface.removeColumn('inventory', 'unit', { transaction })
      await queryInterface.removeColumn('inventory', 'category', {
        transaction,
      })
      await queryInterface.removeColumn('inventory', 'supplier', {
        transaction,
      })
      await queryInterface.removeColumn('inventory', 'supplierContact', {
        transaction,
      })
      await queryInterface.removeColumn('inventory', 'notes', { transaction })

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  },
}
