'use strict'

/**
 * B7 Vorbestellungen - additive migration on top of the pilot baseline.
 *
 * 1. `preorders.not_collected_at` (DATE, nullable): "nicht abgeholt" is not a
 *    status of its own but `bereit` + this timestamp (the goods are there, the
 *    customer did not come). The mock's `not_collected` maps onto it, so the
 *    Mörsbach alias round-trips without loss (see `delivery-preorders.core.js`).
 * 2. The Sammelstelle "Kindergarten Mörsbach" from the mock seed
 *    (`simple-server.js` `seedDeliveryStore`), inserted only if the id is
 *    missing. The address is public (städt. Kita "Hand in Hand", see the
 *    website CLAUDE.md); no personal data.
 *
 * 3. `preorder_codes`: every pickup code ever handed out (`MO-…`, `LA-…`).
 *    A code is single-use - when a preorder moves to another day or place it
 *    gets a new code, and its old one must never go to the next customer of
 *    that day (an Abholzettel or a printed list may still carry it). The
 *    preorders table alone cannot tell, because the moved row no longer holds
 *    the old code. Backfilled from `preorders.code`.
 *
 * Idempotent: the column and table are added only if missing, the row only if
 * absent, the backfill skips codes already registered.
 */

const MOERSBACH = {
  id: 'kindergarten-moersbach',
  name: 'Kindergarten Mörsbach',
  street: 'Höhenstraße 24',
  zip: '66482',
  city: 'Zweibrücken-Mörsbach',
  // JavaScript weekday: 6 = Saturday
  weekday: 6,
  window: '09:00-09:30',
  // Friday 12:00
  order_deadline: JSON.stringify({ weekday: 5, time: '12:00' }),
  notes: 'Städt. Kita "Hand in Hand". Übergabe vor dem Eingang.',
  active: true,
  lat: 49.302619,
  lon: 7.3937453,
  geocode_source: 'nominatim',
  geocode_precision: 'house',
}

/** Tables this migration creates (the pilot baseline test lists them). */
const TABLES = ['preorder_codes']

module.exports = {
  MOERSBACH,
  TABLES,

  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('preorders')
    if (!columns.not_collected_at) {
      await queryInterface.addColumn('preorders', 'not_collected_at', {
        type: Sequelize.DATE,
        allowNull: true,
      })
    }

    const [rows] = await queryInterface.sequelize.query(
      'SELECT id FROM pickup_points WHERE id = ?',
      { replacements: [MOERSBACH.id] }
    )
    if (rows.length === 0) {
      const now = new Date()
      await queryInterface.bulkInsert('pickup_points', [
        { ...MOERSBACH, created_at: now, updated_at: now },
      ])
    }

    const tables = (await queryInterface.showAllTables()).map((t) =>
      typeof t === 'string' ? t : t.tableName
    )
    if (!tables.includes('preorder_codes')) {
      await queryInterface.createTable('preorder_codes', {
        code: {
          type: Sequelize.STRING(32),
          allowNull: false,
          primaryKey: true,
        },
        created_at: { type: Sequelize.DATE, allowNull: false },
      })
    }
    await queryInterface.sequelize.query(
      `INSERT INTO preorder_codes (code, created_at)
         SELECT code, created_at FROM preorders
         WHERE code NOT IN (SELECT code FROM preorder_codes)`
    )
  },

  async down(queryInterface) {
    // The pickup point stays (preorders may reference it).
    const tables = (await queryInterface.showAllTables()).map((t) =>
      typeof t === 'string' ? t : t.tableName
    )
    if (tables.includes('preorder_codes')) {
      await queryInterface.dropTable('preorder_codes')
    }
    const columns = await queryInterface.describeTable('preorders')
    if (columns.not_collected_at) {
      await queryInterface.removeColumn('preorders', 'not_collected_at')
    }
  },
}
