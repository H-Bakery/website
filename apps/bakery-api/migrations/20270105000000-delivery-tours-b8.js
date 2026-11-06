'use strict'

/**
 * B8 Liefertouren - additive migration on top of the pilot schema.
 *
 * The mock server keeps tours in `apps/bakery-api/data/delivery-store.json`
 * (`depot`, `drivers`, `tours[].stops[]`, `geocache`). The real API keeps
 * the same things in five tables:
 *
 *   delivery_depot     one row (id 1): the Backstube, start of every tour
 *   delivery_drivers   drivers of the Saturday tour; `user_id` links a driver
 *                      to the login of a `fahrer` (own tours, D5)
 *   delivery_tours     a tour belongs to one day and (optionally) one driver
 *   delivery_stops     stops in driven order (`position`); `pickup_point_id`
 *                      makes a stop a Sammelstelle (handover list from
 *                      `preorders`, B7)
 *   delivery_geocache  address → coordinates (Nominatim hits), so an address
 *                      is looked up exactly once
 *
 * `import_key` (tours, stops, drivers) is set only by `cli.js
 * import-deliveries` and makes that import idempotent.
 *
 * The depot row is the mock's seed (`seedDeliveryStore` in `simple-server.js`):
 * the bakery's public business address, no personal data. No drivers and no
 * tours are seeded - the owner creates drivers (and links them to `fahrer`
 * accounts) or imports the mock store.
 *
 * Idempotent: tables are created only if missing, the depot row only if absent.
 */

const DEPOT = {
  id: 1,
  name: 'Bäckerei Heusser',
  street: 'Eckstraße 3',
  zip: '66424',
  city: 'Homburg-Kirrberg',
  phone: '+49 6841 2229',
  lat: 49.3015165,
  lon: 7.3695327,
  geocode_source: null,
  geocode_precision: null,
}

/** Tables this migration creates (the pilot baseline test lists them). */
const TABLES = [
  'delivery_depot',
  'delivery_drivers',
  'delivery_tours',
  'delivery_stops',
  'delivery_geocache',
]

async function tableSet(queryInterface) {
  return new Set(
    (await queryInterface.showAllTables()).map((t) =>
      String(typeof t === 'string' ? t : t.tableName).toLowerCase()
    )
  )
}

module.exports = {
  DEPOT,
  TABLES,

  async up(queryInterface, Sequelize) {
    const existing = await tableSet(queryInterface)
    const timestamps = {
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }

    if (!existing.has('delivery_depot')) {
      await queryInterface.createTable('delivery_depot', {
        id: { type: Sequelize.INTEGER, primaryKey: true },
        name: { type: Sequelize.STRING(120), allowNull: false },
        street: { type: Sequelize.STRING(200), allowNull: false },
        zip: { type: Sequelize.STRING(16), allowNull: false, defaultValue: '' },
        city: { type: Sequelize.STRING(120), allowNull: false },
        phone: { type: Sequelize.STRING(40), allowNull: true },
        lat: { type: Sequelize.FLOAT, allowNull: true },
        lon: { type: Sequelize.FLOAT, allowNull: true },
        geocode_source: { type: Sequelize.STRING(32), allowNull: true },
        geocode_precision: { type: Sequelize.STRING(16), allowNull: true },
        updated_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        ...timestamps,
      })
    }

    if (!existing.has('delivery_drivers')) {
      await queryInterface.createTable('delivery_drivers', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        name: { type: Sequelize.STRING(120), allowNull: false },
        phone: { type: Sequelize.STRING(40), allowNull: true },
        vehicle: {
          type: Sequelize.STRING(8),
          allowNull: false,
          defaultValue: 'car',
        },
        active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          unique: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        import_key: {
          type: Sequelize.STRING(64),
          allowNull: true,
          unique: true,
        },
        ...timestamps,
      })
    }

    if (!existing.has('delivery_tours')) {
      await queryInterface.createTable('delivery_tours', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        date: { type: Sequelize.DATEONLY, allowNull: false },
        driver_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'delivery_drivers', key: 'id' },
          onDelete: 'SET NULL',
        },
        name: { type: Sequelize.STRING(120), allowNull: false },
        status: {
          type: Sequelize.STRING(16),
          allowNull: false,
          defaultValue: 'planned',
        },
        vehicle_type: {
          type: Sequelize.STRING(8),
          allowNull: false,
          defaultValue: 'car',
        },
        planned_start: {
          type: Sequelize.STRING(5),
          allowNull: false,
          defaultValue: '06:30',
        },
        started_at: { type: Sequelize.DATE, allowNull: true },
        finished_at: { type: Sequelize.DATE, allowNull: true },
        distance: { type: Sequelize.FLOAT, allowNull: true },
        duration: { type: Sequelize.FLOAT, allowNull: true },
        is_estimate: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        geometry: { type: Sequelize.JSON, allowNull: true },
        routed_at: { type: Sequelize.DATE, allowNull: true },
        last_position: { type: Sequelize.JSON, allowNull: true },
        import_key: {
          type: Sequelize.STRING(64),
          allowNull: true,
          unique: true,
        },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        updated_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        ...timestamps,
      })
      await queryInterface.addIndex('delivery_tours', ['date'])
    }

    if (!existing.has('delivery_stops')) {
      await queryInterface.createTable('delivery_stops', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        tour_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'delivery_tours', key: 'id' },
          onDelete: 'CASCADE',
        },
        position: { type: Sequelize.INTEGER, allowNull: false },
        customer: { type: Sequelize.STRING(200), allowNull: false },
        street: {
          type: Sequelize.STRING(200),
          allowNull: false,
          defaultValue: '',
        },
        zip: { type: Sequelize.STRING(16), allowNull: false, defaultValue: '' },
        city: {
          type: Sequelize.STRING(120),
          allowNull: false,
          defaultValue: '',
        },
        phone: { type: Sequelize.STRING(40), allowNull: true },
        time_window: { type: Sequelize.STRING(64), allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        items: { type: Sequelize.JSON, allowNull: false, defaultValue: '[]' },
        pickup_point_id: {
          type: Sequelize.STRING(64),
          allowNull: true,
          references: { model: 'pickup_points', key: 'id' },
          onDelete: 'SET NULL',
        },
        status: {
          type: Sequelize.STRING(8),
          allowNull: false,
          defaultValue: 'open',
        },
        completed_at: { type: Sequelize.DATE, allowNull: true },
        failure_reason: { type: Sequelize.STRING(200), allowNull: true },
        goods_disposition: { type: Sequelize.STRING(32), allowNull: true },
        lat: { type: Sequelize.FLOAT, allowNull: true },
        lon: { type: Sequelize.FLOAT, allowNull: true },
        geocode_source: { type: Sequelize.STRING(32), allowNull: true },
        geocode_precision: { type: Sequelize.STRING(16), allowNull: true },
        import_key: {
          type: Sequelize.STRING(64),
          allowNull: true,
          unique: true,
        },
        ...timestamps,
      })
      await queryInterface.addIndex('delivery_stops', ['tour_id', 'position'])
      await queryInterface.addIndex('delivery_stops', ['pickup_point_id'])
    }

    if (!existing.has('delivery_geocache')) {
      await queryInterface.createTable('delivery_geocache', {
        key: { type: Sequelize.STRING(300), primaryKey: true },
        lat: { type: Sequelize.FLOAT, allowNull: false },
        lon: { type: Sequelize.FLOAT, allowNull: false },
        display_name: { type: Sequelize.TEXT, allowNull: true },
        precision: { type: Sequelize.STRING(16), allowNull: true },
        ...timestamps,
      })
    }

    const [rows] = await queryInterface.sequelize.query(
      'SELECT id FROM delivery_depot WHERE id = ?',
      { replacements: [DEPOT.id] }
    )
    if (rows.length === 0) {
      const now = new Date()
      await queryInterface.bulkInsert('delivery_depot', [
        { ...DEPOT, created_at: now, updated_at: now },
      ])
    }
  },

  async down(queryInterface) {
    const existing = await tableSet(queryInterface)
    for (const table of [...TABLES].reverse()) {
      if (existing.has(table)) await queryInterface.dropTable(table)
    }
  },
}
