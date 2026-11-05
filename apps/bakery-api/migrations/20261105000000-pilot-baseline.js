'use strict'

/**
 * Pilot baseline (roadmap B2): the whole schema of the pilot in one migration.
 *
 * Replaces the 17 legacy migrations, which are archived in `./archive/` and no
 * longer loaded (neither by `src/db/migrations.ts` nor by `sequelize-cli`,
 * which does not read subdirectories).
 *
 * Tables:
 *   users, refresh_tokens, audit_log                     (B3, shared audit)
 *   Partners, PartnerDeliveryTemplates, PartnerVisits,
 *   PartnerVisitItems                                    (TASK-037, unchanged)
 *   pickup_points, preorders, preorder_items             (B7)
 *   backzettel_days, backzettel_lines, backzettel_deltas (Z3, roadmap §5.3)
 *
 * New tables use snake_case names and columns. The partner tables keep the
 * names and camelCase columns of migration 20260830120000 exactly, because
 * their models and `partner-stats.core.js` depend on them; only the
 * `PartnerVisits.staffId` reference points at `users` now.
 *
 * ## Existing databases (idempotent)
 *
 * A database that already ran the legacy migrations still has their names in
 * `SequelizeMeta`, so Umzug runs this baseline once more on it. Therefore:
 *
 * - Every table is created only if it does not exist yet (case-insensitive:
 *   SQLite treats `Users` and `users` as the same table). The partner tables
 *   of 20260830120000 are identical and keep their data.
 * - A legacy users table (`Users` from the old migration, or `users` from the
 *   old `sync()`, recognised by the missing `password_hash` column) is
 *   rebuilt in place: rows keep their `id` (so `PartnerVisits.staffId` stays
 *   valid), get `display_name` from first/last name, role `admin` → `inhaber`,
 *   everything else → `verkauf`, `active = 0` and the unusable password hash
 *   `LEGACY_PASSWORD_HASH`. Nobody can log in with such an account until B3's
 *   `create-user` sets a new password. Old bcrypt hashes are not carried over.
 * - The other legacy tables (Products, Orders, Cash, ...) are left alone: the
 *   pilot does not read them. Removing them is a separate cleanup.
 *
 * Weekday conventions: `PartnerDeliveryTemplates.weekday` and
 * `Partners.deliveryDays` are ISO (1 = Monday ... 7 = Sunday);
 * `pickup_points.weekday` and `order_deadline.weekday` are JavaScript
 * weekdays (0 = Sunday ... 6 = Saturday), as in `delivery-preorders.core.js`
 * and the mock contract (D3).
 */

/** Password hash of migrated legacy users: never a valid scrypt hash. */
const LEGACY_PASSWORD_HASH = '!legacy-user-disabled'

const ROLES = ['inhaber', 'verkauf', 'backstube', 'fahrer']
const CHANNELS = ['laden', 'telefon', 'whatsapp', 'shop', 'sammelstelle']
const PREORDER_STATUS = ['offen', 'bereit', 'abgeholt', 'storniert']
const BACKZETTEL_STATUS = ['draft', 'confirmed']

/** Every table this migration owns, in creation order (down drops reversed). */
const TABLES = [
  'users',
  'refresh_tokens',
  'audit_log',
  'Partners',
  'PartnerDeliveryTemplates',
  'PartnerVisits',
  'PartnerVisitItems',
  'pickup_points',
  'preorders',
  'preorder_items',
  'backzettel_days',
  'backzettel_lines',
  'backzettel_deltas',
]

async function existingTables(queryInterface) {
  const tables = await queryInterface.showAllTables()
  return new Map(
    tables.map((t) => {
      const name = typeof t === 'string' ? t : t.tableName
      return [String(name).toLowerCase(), String(name)]
    })
  )
}

/**
 * Creates `name` unless a table of that name (any case) exists.
 * @returns {Promise<boolean>} true if the table was created now
 */
async function createIfMissing(queryInterface, name, attributes, indexes) {
  const tables = await existingTables(queryInterface)
  if (tables.has(name.toLowerCase())) return false
  await queryInterface.createTable(name, attributes)
  for (const index of indexes || []) {
    await queryInterface.addIndex(name, index.fields, index.options || {})
  }
  return true
}

function timestamps(Sequelize, { underscored = true, updated = true } = {}) {
  const created = underscored ? 'created_at' : 'createdAt'
  const result = { [created]: { allowNull: false, type: Sequelize.DATE } }
  if (updated) {
    result[underscored ? 'updated_at' : 'updatedAt'] = {
      allowNull: false,
      type: Sequelize.DATE,
    }
  }
  return result
}

function idColumn(Sequelize) {
  return {
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
    type: Sequelize.INTEGER,
  }
}

/** Nullable reference to `users.id`; the row survives a deleted user. */
function userRef(Sequelize) {
  return {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  }
}

/**
 * "No variant" is '' everywhere (preorder_items, backzettel_lines,
 * backzettel_deltas), never NULL: a UNIQUE index treats NULLs as distinct, an
 * expression index (IFNULL) breaks Sequelize's describeTable() on SQLite, and
 * one convention lets the Z2 sums join and group across the three tables.
 */
function variantColumn(Sequelize) {
  return { type: Sequelize.STRING(64), allowNull: false, defaultValue: '' }
}

function usersAttributes(Sequelize) {
  return {
    id: idColumn(Sequelize),
    username: { type: Sequelize.STRING(64), allowNull: false, unique: true },
    display_name: { type: Sequelize.STRING(120), allowNull: false },
    role: { type: Sequelize.ENUM(...ROLES), allowNull: false },
    // scrypt (D12), format decided in B3.
    password_hash: { type: Sequelize.STRING, allowNull: false },
    // Station PIN (D5); null = this user cannot switch in by PIN.
    pin_hash: { type: Sequelize.STRING, allowNull: true },
    active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    ...timestamps(Sequelize),
  }
}

/**
 * Rebuilds a legacy users table into the pilot shape (SQLite only), keeping
 * row ids. See the header comment.
 */
async function migrateLegacyUsers(queryInterface, Sequelize, tableName) {
  const sequelize = queryInterface.sequelize
  if (sequelize.getDialect() !== 'sqlite') {
    throw new Error(
      `Legacy table "${tableName}" found; the automatic rebuild only supports SQLite.`
    )
  }
  const columns = await queryInterface.describeTable(tableName)
  const has = (column) => Object.prototype.hasOwnProperty.call(columns, column)
  const q = (identifier) => `"${identifier.replace(/"/g, '""')}"`

  const nameParts = ['firstName', 'lastName'].filter(has)
  const displayName = nameParts.length
    ? `COALESCE(NULLIF(TRIM(${nameParts
        .map((c) => `COALESCE(${q(c)}, '')`)
        .join(" || ' ' || ")}), ''), ${q('username')})`
    : q('username')
  const role = has('role')
    ? `CASE ${q('role')} WHEN 'admin' THEN 'inhaber' ELSE 'verkauf' END`
    : `'verkauf'`
  const createdAt = has('createdAt')
    ? `COALESCE(${q('createdAt')}, CURRENT_TIMESTAMP)`
    : has('created_at')
    ? `COALESCE(${q('created_at')}, CURRENT_TIMESTAMP)`
    : 'CURRENT_TIMESTAMP'
  const updatedAt = has('updatedAt')
    ? `COALESCE(${q('updatedAt')}, CURRENT_TIMESTAMP)`
    : has('updated_at')
    ? `COALESCE(${q('updated_at')}, CURRENT_TIMESTAMP)`
    : 'CURRENT_TIMESTAMP'

  const [fk] = await sequelize.query('PRAGMA foreign_keys', {
    type: Sequelize.QueryTypes.SELECT,
  })
  const foreignKeysWereOn = Number(Object.values(fk || {})[0]) === 1
  const usersViolations = async () =>
    (
      await sequelize.query('PRAGMA foreign_key_check', {
        type: Sequelize.QueryTypes.SELECT,
      })
    ).filter((row) => String(row.parent).toLowerCase() === 'users').length
  const violationsBefore = await usersViolations()

  // SQLite's table rebuild (https://sqlite.org/lang_altertable.html#otheralter):
  // foreign keys off *outside* the transaction (the pragma is a no-op inside
  // one) so the DROP does not cascade into PartnerVisits & co., then
  // create/copy/drop/rename atomically, then foreign_key_check before commit.
  //
  // Plain BEGIN/COMMIT on the default connection, not sequelize.transaction():
  // Sequelize opens a separate connection per transaction (with
  // foreign_keys = ON), so the pragma above would not apply there. Umzug runs
  // migrations without a transaction, at startup, before anything else uses
  // the connection.
  await sequelize.query('PRAGMA foreign_keys = OFF')
  try {
    await sequelize.query('BEGIN IMMEDIATE')
    try {
      // Leftover of a run that crashed before this was atomic.
      await sequelize.query('DROP TABLE IF EXISTS "users__b2"')
      await queryInterface.createTable('users__b2', usersAttributes(Sequelize))
      await sequelize.query(
        `INSERT INTO "users__b2" (id, username, display_name, role, password_hash, pin_hash, active, created_at, updated_at)
         SELECT ${q('id')}, ${q(
          'username'
        )}, ${displayName}, ${role}, :hash, NULL, 0, ${createdAt}, ${updatedAt}
         FROM ${q(tableName)}`,
        { replacements: { hash: LEGACY_PASSWORD_HASH } }
      )
      await sequelize.query(`DROP TABLE ${q(tableName)}`)
      // References written as "Users" (PartnerVisits.staffId) resolve to the
      // new table: SQLite compares table names case-insensitively.
      await sequelize.query('ALTER TABLE "users__b2" RENAME TO "users"')
      const violationsAfter = await usersViolations()
      if (violationsAfter > violationsBefore) {
        throw new Error(
          `Rebuilding "${tableName}" would leave ${
            violationsAfter - violationsBefore
          } dangling reference(s) to users; rolled back.`
        )
      }
      await sequelize.query('COMMIT')
    } catch (error) {
      await sequelize.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  } finally {
    if (foreignKeysWereOn) await sequelize.query('PRAGMA foreign_keys = ON')
  }
}

module.exports = {
  LEGACY_PASSWORD_HASH,
  TABLES,
  ROLES,
  CHANNELS,
  PREORDER_STATUS,
  BACKZETTEL_STATUS,

  up: async (queryInterface, Sequelize) => {
    // ---------------------------------------------------------------- users
    const before = await existingTables(queryInterface)
    if (before.has('users')) {
      const tableName = before.get('users')
      const columns = await queryInterface.describeTable(tableName)
      if (!columns.password_hash) {
        await migrateLegacyUsers(queryInterface, Sequelize, tableName)
      }
    }
    await createIfMissing(queryInterface, 'users', usersAttributes(Sequelize), [
      { fields: ['role'] },
      { fields: ['active'] },
    ])

    // ------------------------------------------------------- refresh_tokens
    // Rotation (B3): every refresh issues a new token, the old one gets
    // `revoked_at` and `replaced_by` = id of its successor. Only the hash of
    // the token is stored.
    await createIfMissing(
      queryInterface,
      'refresh_tokens',
      {
        id: idColumn(Sequelize),
        token_hash: { type: Sequelize.STRING, allowNull: false, unique: true },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        expires_at: { type: Sequelize.DATE, allowNull: false },
        revoked_at: { type: Sequelize.DATE, allowNull: true },
        replaced_by: { type: Sequelize.INTEGER, allowNull: true },
        user_agent: { type: Sequelize.STRING, allowNull: true },
        ...timestamps(Sequelize, { updated: false }),
      },
      [{ fields: ['user_id'] }, { fields: ['expires_at'] }]
    )

    // ------------------------------------------------------------ audit_log
    // Append-only. Shared by preorders, Backzettel and user admin.
    await createIfMissing(
      queryInterface,
      'audit_log',
      {
        id: idColumn(Sequelize),
        user_id: userRef(Sequelize),
        action: { type: Sequelize.STRING(64), allowNull: false },
        entity: { type: Sequelize.STRING(64), allowNull: false },
        entity_id: { type: Sequelize.STRING(64), allowNull: true },
        data: { type: Sequelize.JSON, allowNull: true },
        ...timestamps(Sequelize, { updated: false }),
      },
      [
        { fields: ['entity', 'entity_id'] },
        { fields: ['user_id'] },
        { fields: ['created_at'] },
      ]
    )

    // ------------------------------------------- partners (as 20260830120000)
    await createIfMissing(queryInterface, 'Partners', {
      id: idColumn(Sequelize),
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      street: { type: Sequelize.STRING, allowNull: true },
      zip: { type: Sequelize.STRING, allowNull: true },
      city: { type: Sequelize.STRING, allowNull: true },
      contactName: { type: Sequelize.STRING, allowNull: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: true },
      // ISO weekdays, 1 = Monday ... 7 = Sunday.
      deliveryDays: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      settlementModel: {
        type: Sequelize.ENUM('commission', 'firm_sale'),
        allowNull: false,
        defaultValue: 'commission',
      },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      ...timestamps(Sequelize, { underscored: false }),
    })

    await createIfMissing(
      queryInterface,
      'PartnerDeliveryTemplates',
      {
        id: idColumn(Sequelize),
        partnerId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Partners', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        weekday: { type: Sequelize.INTEGER, allowNull: false },
        // [{ productId, productSlug, quantity }]
        items: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
        active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        ...timestamps(Sequelize, { underscored: false }),
      },
      [
        {
          fields: ['partnerId', 'weekday'],
          options: { unique: true, name: 'unique_partner_weekday_template' },
        },
      ]
    )

    await createIfMissing(
      queryInterface,
      'PartnerVisits',
      {
        id: idColumn(Sequelize),
        partnerId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Partners', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        businessDate: { type: Sequelize.DATEONLY, allowNull: false },
        visitAt: { type: Sequelize.DATE, allowNull: false },
        visitType: {
          type: Sequelize.ENUM('initial', 'refill', 'pickup'),
          allowNull: false,
          defaultValue: 'refill',
        },
        sequence: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        staffId: userRef(Sequelize),
        staffName: { type: Sequelize.STRING, allowNull: true },
        note: { type: Sequelize.TEXT, allowNull: true },
        ...timestamps(Sequelize, { underscored: false }),
      },
      [{ fields: ['partnerId', 'businessDate'] }, { fields: ['businessDate'] }]
    )

    await createIfMissing(
      queryInterface,
      'PartnerVisitItems',
      {
        id: idColumn(Sequelize),
        visitId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'PartnerVisits', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        productId: { type: Sequelize.INTEGER, allowNull: false },
        productSlug: { type: Sequelize.STRING, allowNull: false },
        productName: { type: Sequelize.STRING, allowNull: false },
        unitPrice: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        },
        // NULL = not counted (≠ 0 = cabinet was empty).
        countedQty: { type: Sequelize.INTEGER, allowNull: true },
        deliveredQty: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        ...timestamps(Sequelize, { underscored: false }),
      },
      [{ fields: ['visitId'] }, { fields: ['productSlug'] }]
    )

    // -------------------------------------------------------- pickup_points
    // Sammelstellen (Mörsbach). Shape follows the mock contract (D3,
    // `normalizePickupPointInput`); the address is street/zip/city.
    await createIfMissing(queryInterface, 'pickup_points', {
      id: { type: Sequelize.STRING(64), allowNull: false, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      street: { type: Sequelize.STRING, allowNull: false, defaultValue: '' },
      zip: { type: Sequelize.STRING(10), allowNull: false, defaultValue: '' },
      city: { type: Sequelize.STRING, allowNull: false, defaultValue: '' },
      // JavaScript weekday of the handover, 0 = Sunday ... 6 = Saturday.
      weekday: { type: Sequelize.INTEGER, allowNull: false },
      // Handover window "HH:MM-HH:MM".
      window: { type: Sequelize.STRING(11), allowNull: true },
      // Order deadline { weekday (0-6), time "HH:MM" }; null = none.
      order_deadline: { type: Sequelize.JSON, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      lat: { type: Sequelize.FLOAT, allowNull: true },
      lon: { type: Sequelize.FLOAT, allowNull: true },
      geocode_source: { type: Sequelize.STRING(32), allowNull: true },
      geocode_precision: { type: Sequelize.STRING(32), allowNull: true },
      ...timestamps(Sequelize),
    })

    // ------------------------------------------------------------ preorders
    // Cancelled, never deleted. Customer name/phone are cleared by the GDPR
    // job (P4), which sets `anonymized_at` - hence nullable.
    await createIfMissing(
      queryInterface,
      'preorders',
      {
        id: idColumn(Sequelize),
        // Human-readable reference, e.g. "MO-2026-11-21-03".
        code: { type: Sequelize.STRING(32), allowNull: false, unique: true },
        channel: { type: Sequelize.ENUM(...CHANNELS), allowNull: false },
        customer_name: { type: Sequelize.STRING, allowNull: true },
        customer_phone: { type: Sequelize.STRING(40), allowNull: true },
        pickup_date: { type: Sequelize.DATEONLY, allowNull: false },
        // "HH:MM" at the Laden; null at a pickup point (its window applies).
        pickup_time: { type: Sequelize.STRING(5), allowNull: true },
        pickup_point_id: {
          type: Sequelize.STRING(64),
          allowNull: true,
          references: { model: 'pickup_points', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        status: {
          type: Sequelize.ENUM(...PREORDER_STATUS),
          allowNull: false,
          defaultValue: 'offen',
        },
        paid: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        note: { type: Sequelize.TEXT, allowNull: true },
        // When it was handed over (mock: `handedOverAt`); null unless abgeholt.
        picked_up_at: { type: Sequelize.DATE, allowNull: true },
        created_by: userRef(Sequelize),
        updated_by: userRef(Sequelize),
        anonymized_at: { type: Sequelize.DATE, allowNull: true },
        ...timestamps(Sequelize),
      },
      [
        { fields: ['pickup_date'] },
        { fields: ['pickup_point_id', 'pickup_date'] },
        { fields: ['status'] },
      ]
    )

    await createIfMissing(
      queryInterface,
      'preorder_items',
      {
        id: idColumn(Sequelize),
        preorder_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'preorders', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        // hq product slug (`id` in the frontmatter).
        product_id: { type: Sequelize.STRING(128), allowNull: false },
        // Snapshots at entry time: later hq edits do not change old orders.
        product_name: { type: Sequelize.STRING, allowNull: false },
        unit: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'Stück',
        },
        unit_price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        quantity: { type: Sequelize.INTEGER, allowNull: false },
        // Filling etc., validated against the Backzettel item's `variants`.
        // '' = no variant, as in backzettel_lines/backzettel_deltas, so sums
        // per product and variant (Z2, B7 /api/preorders/sums) join and group
        // without COALESCE.
        variant: variantColumn(Sequelize),
        ...timestamps(Sequelize),
      },
      [{ fields: ['preorder_id'] }, { fields: ['product_id'] }]
    )

    // ----------------------------------------------- backzettel (§5.3, Z3)
    await createIfMissing(queryInterface, 'backzettel_days', {
      date: { type: Sequelize.DATEONLY, allowNull: false, primaryKey: true },
      status: {
        type: Sequelize.ENUM(...BACKZETTEL_STATUS),
        allowNull: false,
        defaultValue: 'draft',
      },
      season_factor: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 1.0,
      },
      confirmed_by: userRef(Sequelize),
      confirmed_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    })

    await createIfMissing(
      queryInterface,
      'backzettel_lines',
      {
        id: idColumn(Sequelize),
        date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          references: { model: 'backzettel_days', key: 'date' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        // Backzettel item id from hq/config/backzettel.yaml.
        item_id: { type: Sequelize.STRING(128), allowNull: false },
        // '' = item without variants (see variantColumn).
        variant: variantColumn(Sequelize),
        base: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        },
        seasonal: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        },
        preorders: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        },
        // Upper limit (tray/batch); null = none.
        cap: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        correction: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        },
        correction_reason: { type: Sequelize.TEXT, allowNull: true },
        correction_by: userRef(Sequelize),
        total: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        },
        done_at: { type: Sequelize.DATE, allowNull: true },
        done_by: userRef(Sequelize),
        ...timestamps(Sequelize),
      },
      [
        // One line per day, item and variant.
        {
          fields: ['date', 'item_id', 'variant'],
          options: { unique: true, name: 'backzettel_lines_date_item_variant' },
        },
      ]
    )

    // Preorders that arrived after the day was confirmed.
    await createIfMissing(
      queryInterface,
      'backzettel_deltas',
      {
        id: idColumn(Sequelize),
        date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          references: { model: 'backzettel_days', key: 'date' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        item_id: { type: Sequelize.STRING(128), allowNull: false },
        variant: variantColumn(Sequelize),
        qty: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        preorder_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'preorders', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        ...timestamps(Sequelize, { updated: false }),
      },
      [{ fields: ['date'] }, { fields: ['preorder_id'] }]
    )
  },

  /**
   * Drops every baseline table, including partner data. Meant for tests and a
   * fresh development database only.
   */
  down: async (queryInterface) => {
    for (const table of [...TABLES].reverse()) {
      await queryInterface.dropTable(table)
    }
  },
}
