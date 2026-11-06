'use strict'

/**
 * M4 „Rest am Abend“ (roadmap §6 M4) - additive migration, after the pilot.
 *
 * `rest_counts`: what is left in the shop at closing, one row per business
 * day × Backzettel item × variant × product (the count line). `variant` and
 * `product_id` are `''` for "none", never NULL (same reason as
 * `backzettel_lines`: the unique index must hold). A row exists only when
 * something was counted - `qty` 0 means "nichts übrig", a missing row means
 * "nicht gezählt" (a gap, never 0). Deleting a count deletes the row; every
 * change (also a correction) is in `audit_log` with from/to.
 *
 * Snapshots, so a later change of `backzettel.yaml` or of the hq catalogue
 * does not rewrite old days: `name` (label of the count line), `item_name`,
 * `unit` (counting unit), `item_unit`, `factor` (counting unit → item unit).
 *
 * Idempotent: the table and the index are created only if missing. Nothing
 * else is touched - the pilot tables stay as they are.
 */

const TABLE = 'rest_counts'
const INDEX = 'rest_counts_day_line_unique'

/** Tables this migration creates (the pilot baseline test lists them). */
const TABLES = [TABLE]

async function tableNames(queryInterface) {
  return (await queryInterface.showAllTables()).map((t) =>
    typeof t === 'string' ? t : t.tableName
  )
}

module.exports = {
  TABLES,

  async up(queryInterface, Sequelize) {
    if (!(await tableNames(queryInterface)).includes(TABLE)) {
      await queryInterface.createTable(TABLE, {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        business_date: { type: Sequelize.DATEONLY, allowNull: false },
        item_id: { type: Sequelize.STRING(128), allowNull: false },
        variant: {
          type: Sequelize.STRING(64),
          allowNull: false,
          defaultValue: '',
        },
        product_id: {
          type: Sequelize.STRING(128),
          allowNull: false,
          defaultValue: '',
        },
        name: { type: Sequelize.STRING, allowNull: true },
        item_name: { type: Sequelize.STRING, allowNull: true },
        unit: { type: Sequelize.STRING(16), allowNull: false },
        item_unit: { type: Sequelize.STRING(16), allowNull: false },
        factor: {
          type: Sequelize.DECIMAL(12, 6),
          allowNull: false,
          defaultValue: 1,
        },
        qty: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        revision: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        counted_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      })
    }
    const indexes = await queryInterface.showIndex(TABLE)
    if (!indexes.some((i) => i.name === INDEX)) {
      await queryInterface.addIndex(
        TABLE,
        ['business_date', 'item_id', 'variant', 'product_id'],
        { name: INDEX, unique: true }
      )
    }
  },

  async down(queryInterface) {
    if ((await tableNames(queryInterface)).includes(TABLE)) {
      await queryInterface.dropTable(TABLE)
    }
  },
}
