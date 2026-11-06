'use strict'

/**
 * W4 verification round 2 - `preorders.paid_amount` (DECIMAL, nullable).
 *
 * `paid` alone could not say how much was paid. When a paid order's items
 * changed, the difference was in no total; when a paid order was cancelled,
 * nothing prompted a refund. The amount is set to the order total whenever
 * payment is recorded (create with `paid`, `paid` false -> true, an explicit
 * "bezahlt" at the status endpoint) and cleared when `paid` goes back to
 * false. `NULL` with `paid = true` (rows from before this migration, imports)
 * reads as "paid in full".
 *
 * Idempotent: the column is added only if missing.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('preorders')
    if (!columns.paid_amount) {
      await queryInterface.addColumn('preorders', 'paid_amount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      })
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('preorders')
    if (columns.paid_amount) {
      await queryInterface.removeColumn('preorders', 'paid_amount')
    }
  },
}
