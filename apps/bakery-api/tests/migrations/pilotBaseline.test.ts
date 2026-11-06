/**
 * Pilot baseline migration (roadmap B2): fresh schema, models match it,
 * idempotent re-run, and an existing database that ran the 17 legacy
 * migrations keeps its partner data. Synthetic data only.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
import { Model, ModelStatic, QueryTypes, Sequelize } from 'sequelize'

import { openDatabase } from '../../src/db/database'
import { runMigrations } from '../../src/db/migrate'
import { MIGRATIONS, MigrationEntry } from '../../src/db/migrations'
import { initializeModels, PILOT_MODELS } from '../../src/models'

const baseline = require('../../migrations/20261105000000-pilot-baseline.js')
const authMigration = require('../../migrations/20261106000000-auth-sessions-stations.js')
const preordersMigration = require('../../migrations/20261113000000-preorders-b7.js')
const deliveriesMigration = require('../../migrations/20270105000000-delivery-tours-b8.js')
const restMigration = require('../../migrations/20261201000000-rest-am-abend.js')

/** The 17 migrations the server ran before B2, now in migrations/archive/. */
const LEGACY_NAMES = [
  '20250801140000-create-users.js',
  '20250801140100-create-products.js',
  '20250801140200-create-orders.js',
  '20250801140300-create-order-items.js',
  '20250801140400-create-cash.js',
  '20250801140500-create-chats.js',
  '20250801140600-create-unsold-products.js',
  '20250801140700-create-recipes.js',
  '20250801140800-create-inventories.js',
  '20250801140900-create-notifications.js',
  '20250801141000-create-notification-preferences.js',
  '20250801141100-create-notification-templates.js',
  '20250801150000-create-production-tables.js',
  '20250802000000-create-sales-analytics-tables.js',
  '20250802000001-enhance-inventory-schema.js',
  '20250802000002-create-stock-adjustments.js',
  '20260830120000-create-partner-tables.js',
]
const LEGACY: MigrationEntry[] = LEGACY_NAMES.map((name) => ({
  name,
  module: require(`../../migrations/archive/${name}`),
}))

const quiet = { log: () => undefined }

async function freshDb(): Promise<Sequelize> {
  return (await openDatabase({ storage: ':memory:' })).sequelize
}

async function tableNames(sequelize: Sequelize): Promise<string[]> {
  const rows = await sequelize.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    { type: QueryTypes.SELECT }
  )
  return rows.map((r) => r.name).sort()
}

async function columns(sequelize: Sequelize, table: string): Promise<string[]> {
  return Object.keys(
    await sequelize.getQueryInterface().describeTable(table)
  ).sort()
}

async function foreignKeyViolations(sequelize: Sequelize): Promise<unknown[]> {
  return sequelize.query('PRAGMA foreign_key_check', {
    type: QueryTypes.SELECT,
  })
}

describe('pilot baseline on a fresh database', () => {
  let sequelize: Sequelize

  beforeAll(async () => {
    sequelize = await freshDb()
    await runMigrations(sequelize, quiet)
  })
  afterAll(() => sequelize.close())

  it('opens the static list, followed by B3 auth, Z3 Backzettel, B7 preorders, M4 rest and B8 tours', () => {
    expect(MIGRATIONS.map((m) => m.name)).toEqual([
      '20261105000000-pilot-baseline.js',
      '20261106000000-auth-sessions-stations.js',
      '20261112000000-backzettel-z3.js',
      '20261113000000-preorders-b7.js',
      '20261114000000-preorders-paid-amount.js',
      '20261116000000-preorders-request-id.js',
      '20261201000000-rest-am-abend.js',
      '20270105000000-delivery-tours-b8.js',
      '20270106000000-rest-count-line-rows.js',
    ])
  })

  it('creates exactly the pilot tables (with the B3 auth, B7, M4 and B8 tables)', async () => {
    expect(await tableNames(sequelize)).toEqual(
      [
        ...baseline.TABLES,
        ...authMigration.TABLES,
        ...preordersMigration.TABLES,
        ...deliveriesMigration.TABLES,
        ...restMigration.TABLES,
        'SequelizeMeta',
      ].sort()
    )
  })

  it('gives users, preorders and preorder_items the planned columns', async () => {
    expect(await columns(sequelize, 'users')).toEqual(
      [
        'active',
        'created_at',
        'display_name',
        'id',
        'password_hash',
        'pin_hash',
        'role',
        'updated_at',
        'username',
      ].sort()
    )
    expect(await columns(sequelize, 'preorders')).toEqual(
      expect.arrayContaining([
        'code',
        'channel',
        'customer_name',
        'customer_phone',
        'pickup_date',
        'pickup_time',
        'pickup_point_id',
        'status',
        'paid',
        'note',
        'created_by',
        'updated_by',
        'anonymized_at',
        'not_collected_at',
      ])
    )
    expect(await columns(sequelize, 'preorder_items')).toEqual(
      expect.arrayContaining([
        'preorder_id',
        'product_id',
        'product_name',
        'unit_price',
        'quantity',
        'variant',
      ])
    )
    expect(await columns(sequelize, 'backzettel_lines')).toEqual(
      expect.arrayContaining([
        'date',
        'item_id',
        'variant',
        'base',
        'seasonal',
        'preorders',
        'cap',
        'correction',
        'correction_reason',
        'correction_by',
        'total',
        'done_at',
        'done_by',
      ])
    )
  })

  it('has a column for every attribute of every pilot model', async () => {
    await initializeModels(sequelize)
    for (const model of PILOT_MODELS as unknown as ModelStatic<Model>[]) {
      const table = model.getTableName() as string
      const actual = await columns(sequelize, table)
      const expected = Object.values(model.getAttributes()).map(
        (attribute) => attribute.field as string
      )
      expect({
        table,
        missing: expected.filter((c) => !actual.includes(c)),
      }).toEqual({
        table,
        missing: [],
      })
    }
  })

  it('round-trips a preorder with items through the models', async () => {
    await initializeModels(sequelize)
    const { PickupPoint, Preorder, PreorderItem, User, AuditLog } =
      await import('../../src/models')
    const user = await User.create({
      username: 'test.inhaber',
      displayName: 'Test Inhaber',
      role: 'inhaber',
      passwordHash: 'scrypt$synthetic',
    })
    await PickupPoint.create({
      id: 'test-sammelstelle',
      name: 'Test-Sammelstelle',
      weekday: 6,
      orderDeadline: { weekday: 5, time: '12:00' },
    })
    const preorder = await Preorder.create({
      code: 'TE-2026-11-21-01',
      channel: 'sammelstelle',
      customerName: 'Erika Beispiel',
      pickupDate: '2026-11-21',
      pickupPointId: 'test-sammelstelle',
      createdBy: user.id,
    })
    await PreorderItem.create({
      preorderId: preorder.id,
      productId: 'testzopf',
      productName: 'Testzopf',
      unitPrice: 7.5,
      quantity: 2,
      variant: 'nuss',
    })
    await AuditLog.create({
      userId: user.id,
      action: 'create',
      entity: 'preorder',
      entityId: String(preorder.id),
      data: { items: 1 },
    })

    const loaded = await Preorder.findByPk(preorder.id, {
      include: [
        { model: PreorderItem, as: 'items' },
        { model: PickupPoint, as: 'pickupPoint' },
      ],
    })
    expect(loaded?.status).toBe('offen')
    expect(loaded?.paid).toBe(false)
    expect(loaded?.items?.[0]).toMatchObject({ variant: 'nuss', quantity: 2 })
    expect(Number(loaded?.items?.[0].unitPrice)).toBe(7.5)
    expect(
      (loaded as unknown as { pickupPoint: { orderDeadline: unknown } })
        .pickupPoint.orderDeadline
    ).toEqual({ weekday: 5, time: '12:00' })

    await expect(
      Preorder.create({
        code: 'TE-2026-11-21-01',
        channel: 'telefon',
        customerName: 'Max Muster',
        pickupDate: '2026-11-21',
      })
    ).rejects.toThrow()
  })

  it('never serialises password or PIN hashes, however the user was loaded', async () => {
    await initializeModels(sequelize)
    const { User } = await import('../../src/models')
    const created = await User.create({
      username: 'test.geheim',
      displayName: 'Test Geheim',
      role: 'verkauf',
      passwordHash: 'scrypt$synthetic-secret',
      pinHash: 'scrypt$synthetic-pin',
    })
    const withSecrets = await User.scope('withSecrets').findByPk(created.id)
    const explicit = await User.findAll({
      attributes: ['id', 'username', 'passwordHash', 'pinHash'],
      where: { id: created.id },
    })
    const plain = await User.findByPk(created.id)

    // The hashes are readable on the instance where login needs them ...
    expect(withSecrets?.passwordHash).toBe('scrypt$synthetic-secret')
    expect(withSecrets?.pinHash).toBe('scrypt$synthetic-pin')
    // ... but never in JSON.
    for (const user of [created, withSecrets, explicit[0], plain]) {
      const json = JSON.stringify(user)
      expect(json).toContain('test.geheim')
      expect(json).not.toMatch(/synthetic-secret|synthetic-pin/)
      expect(user?.toJSON()).not.toHaveProperty('passwordHash')
      expect(user?.toJSON()).not.toHaveProperty('pinHash')
    }
    // The default scope still keeps them out of ordinary queries.
    expect(plain?.get('passwordHash')).toBeUndefined()
  })

  it("stores 'no variant' as '' in preorder_items, backzettel_lines and backzettel_deltas", async () => {
    for (const table of [
      'preorder_items',
      'backzettel_lines',
      'backzettel_deltas',
    ]) {
      const variant = (
        await sequelize.getQueryInterface().describeTable(table)
      )['variant']
      expect({ table, allowNull: variant.allowNull }).toEqual({
        table,
        allowNull: false,
      })
      expect(String(variant.defaultValue).replace(/'/g, '')).toBe('')
    }
    await initializeModels(sequelize)
    const { PreorderItem, Preorder } = await import('../../src/models')
    const preorder = await Preorder.create({
      code: 'TE-2026-11-28-01',
      channel: 'telefon',
      customerName: 'Erika Beispiel',
      pickupDate: '2026-11-28',
    })
    const item = await PreorderItem.create({
      preorderId: preorder.id,
      productId: 'testbrot',
      productName: 'Testbrot',
      unitPrice: 3,
      quantity: 1,
    })
    expect((await PreorderItem.findByPk(item.id))?.variant).toBe('')
  })

  it('allows one Backzettel line per day, item and variant - also without variant', async () => {
    await sequelize.query(
      "INSERT INTO backzettel_days (date, created_at, updated_at) VALUES ('2026-11-24', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    )
    const [day] = await sequelize.query<{
      status: string
      season_factor: number
    }>(
      "SELECT status, season_factor FROM backzettel_days WHERE date = '2026-11-24'",
      { type: QueryTypes.SELECT }
    )
    expect(day).toEqual({ status: 'draft', season_factor: 1 })

    const insertLine = (variant?: string) =>
      sequelize.query(
        variant === undefined
          ? "INSERT INTO backzettel_lines (date, item_id, created_at, updated_at) VALUES ('2026-11-24', 'testbrot', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
          : "INSERT INTO backzettel_lines (date, item_id, variant, created_at, updated_at) VALUES ('2026-11-24', 'testbrot', :variant, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        { replacements: { variant: variant ?? null } }
      )
    await insertLine()
    await insertLine('nuss')
    await expect(insertLine()).rejects.toMatchObject({
      name: 'SequelizeUniqueConstraintError',
    })
    await expect(insertLine('')).rejects.toMatchObject({
      name: 'SequelizeUniqueConstraintError',
    })
    await expect(insertLine('nuss')).rejects.toMatchObject({
      name: 'SequelizeUniqueConstraintError',
    })
    // A line belongs to a day.
    await expect(
      sequelize.query(
        "INSERT INTO backzettel_lines (date, item_id, created_at, updated_at) VALUES ('2026-12-01', 'testbrot', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
      )
    ).rejects.toThrow(/FOREIGN KEY/)
  })

  it('is idempotent: running up() again changes nothing', async () => {
    const before = await tableNames(sequelize)
    await baseline.up(sequelize.getQueryInterface(), Sequelize)
    expect(await tableNames(sequelize)).toEqual(before)
  })
})

describe('pilot baseline on a database that ran the legacy migrations', () => {
  let sequelize: Sequelize

  beforeAll(async () => {
    sequelize = await freshDb()
    await runMigrations(sequelize, { ...quiet, migrations: LEGACY })

    const now = "'2026-09-01 08:00:00'"
    await sequelize.query(
      `INSERT INTO Users (id, username, password, email, firstName, lastName, role, isActive, createdAt, updatedAt)
       VALUES (7, 'alt.admin', 'bcrypt-synthetic', 'alt@example.org', 'Alt', 'Admin', 'admin', 1, ${now}, ${now}),
              (8, 'alt.staff', 'bcrypt-synthetic', 'staff@example.org', 'Alt', 'Staff', 'staff', 1, ${now}, ${now})`
    )
    await sequelize.query(
      `INSERT INTO Partners (id, name, slug, deliveryDays, settlementModel, active, createdAt, updatedAt)
       VALUES (1, 'Testmarkt', 'testmarkt', '[2,3]', 'commission', 1, ${now}, ${now})`
    )
    await sequelize.query(
      `INSERT INTO PartnerVisits (id, partnerId, businessDate, visitAt, visitType, sequence, staffId, staffName, createdAt, updatedAt)
       VALUES (1, 1, '2026-09-01', ${now}, 'initial', 1, 8, 'Alt Staff', ${now}, ${now})`
    )
    await sequelize.query(
      `INSERT INTO PartnerVisitItems (visitId, productId, productSlug, productName, unitPrice, countedQty, deliveredQty, createdAt, updatedAt)
       VALUES (1, 9001, 'testbrot', 'Testbrot', 2.5, NULL, 10, ${now}, ${now})`
    )

    // What the server does on startup with the new static list.
    await runMigrations(sequelize, quiet)
  })
  afterAll(() => sequelize.close())

  it('records the baseline as executed next to the legacy names', async () => {
    const rows = await sequelize.query<{ name: string }>(
      'SELECT name FROM SequelizeMeta',
      { type: QueryTypes.SELECT }
    )
    expect(rows.map((r) => r.name)).toEqual(
      expect.arrayContaining([
        ...LEGACY_NAMES,
        '20261105000000-pilot-baseline.js',
      ])
    )
  })

  it('keeps the partner data', async () => {
    const visits = await sequelize.query(
      'SELECT v.staffId, v.staffName, i.productSlug, i.countedQty, i.deliveredQty FROM PartnerVisits v JOIN PartnerVisitItems i ON i.visitId = v.id',
      { type: QueryTypes.SELECT }
    )
    expect(visits).toEqual([
      {
        staffId: 8,
        staffName: 'Alt Staff',
        productSlug: 'testbrot',
        countedQty: null,
        deliveredQty: 10,
      },
    ])
  })

  it('rebuilds the legacy users table into the pilot shape, keeping ids, disabled', async () => {
    const tables = await tableNames(sequelize)
    expect(tables).toContain('users')
    expect(tables).not.toContain('Users')
    expect(tables).not.toContain('users__b2')

    const users = await sequelize.query(
      'SELECT id, username, display_name, role, password_hash, pin_hash, active FROM users ORDER BY id',
      { type: QueryTypes.SELECT }
    )
    expect(users).toEqual([
      {
        id: 7,
        username: 'alt.admin',
        display_name: 'Alt Admin',
        role: 'inhaber',
        password_hash: baseline.LEGACY_PASSWORD_HASH,
        pin_hash: null,
        active: 0,
      },
      {
        id: 8,
        username: 'alt.staff',
        display_name: 'Alt Staff',
        role: 'verkauf',
        password_hash: baseline.LEGACY_PASSWORD_HASH,
        pin_hash: null,
        active: 0,
      },
    ])
  })

  it('leaves no dangling foreign keys and creates the new pilot tables', async () => {
    expect(await foreignKeyViolations(sequelize)).toEqual([])
    const tables = await tableNames(sequelize)
    for (const table of baseline.TABLES) expect(tables).toContain(table)
  })

  it('works with the pilot models afterwards', async () => {
    await initializeModels(sequelize)
    const { PartnerVisit, User } = await import('../../src/models')
    const user = await User.create({
      username: 'neu.backstube',
      displayName: 'Neu Backstube',
      role: 'backstube',
      passwordHash: 'scrypt$synthetic',
    })
    expect(user.id).toBeGreaterThan(8)
    const visit = await PartnerVisit.findByPk(1, {
      include: [{ model: User, as: 'staff' }],
    })
    expect(visit?.staff?.username).toBe('alt.staff')
    await visit?.update({ note: 'nach B2 geändert' })
    expect(await foreignKeyViolations(sequelize)).toEqual([])
  })

  it('a second startup runs nothing', async () => {
    const again = await runMigrations(sequelize, quiet)
    expect(again.executed).toEqual([])
    expect(again.pending).toEqual([])
  })
})

describe('pilot baseline on a database with a sync()-shaped users table', () => {
  let sequelize: Sequelize
  const partnerMigration = LEGACY.filter(
    (m) => m.name === '20260830120000-create-partner-tables.js'
  )

  beforeAll(async () => {
    sequelize = await freshDb()
    // What the old `sequelize.sync()` left behind: lowercase `users`, no
    // first/last name, `isActive` instead of `active`.
    await sequelize.query(
      `CREATE TABLE users (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         username VARCHAR(255) NOT NULL UNIQUE,
         password VARCHAR(255) NOT NULL,
         email VARCHAR(255),
         role TEXT DEFAULT 'user',
         isActive TINYINT(1) DEFAULT 1,
         createdAt DATETIME NOT NULL,
         updatedAt DATETIME NOT NULL)`
    )
    const now = "'2026-09-01 08:00:00'"
    await sequelize.query(
      `INSERT INTO users (id, username, password, email, role, isActive, createdAt, updatedAt)
       VALUES (3, 'sync.admin', 'bcrypt-synthetic', 'a@example.org', 'admin', 1, ${now}, ${now}),
              (5, 'sync.user', 'bcrypt-synthetic', 'u@example.org', 'user', 1, ${now}, ${now})`
    )
    await runMigrations(sequelize, { ...quiet, migrations: partnerMigration })
    await sequelize.query(
      `INSERT INTO Partners (id, name, slug, deliveryDays, settlementModel, active, createdAt, updatedAt)
       VALUES (1, 'Testmarkt', 'testmarkt', '[2]', 'commission', 1, ${now}, ${now})`
    )
    await sequelize.query(
      `INSERT INTO PartnerVisits (id, partnerId, businessDate, visitAt, visitType, sequence, staffId, staffName, createdAt, updatedAt)
       VALUES (1, 1, '2026-09-01', ${now}, 'initial', 1, 5, 'Sync User', ${now}, ${now})`
    )
    await runMigrations(sequelize, quiet)
  })
  afterAll(() => sequelize.close())

  it('rebuilds it: display name falls back to the username, roles mapped, disabled', async () => {
    const users = await sequelize.query(
      'SELECT id, username, display_name, role, password_hash, active FROM users ORDER BY id',
      { type: QueryTypes.SELECT }
    )
    expect(users).toEqual([
      {
        id: 3,
        username: 'sync.admin',
        display_name: 'sync.admin',
        role: 'inhaber',
        password_hash: baseline.LEGACY_PASSWORD_HASH,
        active: 0,
      },
      {
        id: 5,
        username: 'sync.user',
        display_name: 'sync.user',
        role: 'verkauf',
        password_hash: baseline.LEGACY_PASSWORD_HASH,
        active: 0,
      },
    ])
    expect(await columns(sequelize, 'users')).not.toContain('isActive')
  })

  it('keeps PartnerVisits.staffId valid and leaves no dangling keys', async () => {
    const [visit] = await sequelize.query<{ staffId: number }>(
      'SELECT staffId FROM PartnerVisits WHERE id = 1',
      { type: QueryTypes.SELECT }
    )
    expect(visit.staffId).toBe(5)
    expect(await foreignKeyViolations(sequelize)).toEqual([])
    expect(await tableNames(sequelize)).not.toContain('users__b2')
  })
})

describe('legacy users rebuild is atomic', () => {
  async function legacyDb(rows: string): Promise<Sequelize> {
    const sequelize = await freshDb()
    // No NOT NULL on username: lets a test plant a row the new table rejects.
    await sequelize.query(
      `CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(255), role TEXT, createdAt DATETIME, updatedAt DATETIME)`
    )
    await sequelize.query(
      `INSERT INTO users (id, username, role) VALUES ${rows}`
    )
    return sequelize
  }

  it('rolls back completely when the copy fails, and keeps foreign keys on', async () => {
    const sequelize = await legacyDb(
      "(1, 'ok.user', 'admin'), (2, NULL, 'user')"
    )
    await expect(runMigrations(sequelize, quiet)).rejects.toThrow()

    expect(await tableNames(sequelize)).toEqual(['SequelizeMeta', 'users'])
    expect(await columns(sequelize, 'users')).toContain('createdAt')
    const rows = await sequelize.query(
      'SELECT id, username FROM users ORDER BY id',
      {
        type: QueryTypes.SELECT,
      }
    )
    expect(rows).toEqual([
      { id: 1, username: 'ok.user' },
      { id: 2, username: null },
    ])
    const [fk] = await sequelize.query<{ foreign_keys: number }>(
      'PRAGMA foreign_keys',
      { type: QueryTypes.SELECT }
    )
    expect(fk.foreign_keys).toBe(1)

    // Fixing the data lets the next start succeed.
    await sequelize.query(
      "UPDATE users SET username = 'fixed.user' WHERE id = 2"
    )
    await runMigrations(sequelize, quiet)
    expect(await columns(sequelize, 'users')).toContain('password_hash')
    await sequelize.close()
  })

  it('cleans up a users__b2 left over by an interrupted earlier run', async () => {
    const sequelize = await legacyDb("(1, 'ok.user', 'admin')")
    await sequelize.query('CREATE TABLE users__b2 (id INTEGER PRIMARY KEY)')
    await runMigrations(sequelize, quiet)
    const tables = await tableNames(sequelize)
    expect(tables).toContain('users')
    expect(tables).not.toContain('users__b2')
    const users = await sequelize.query(
      'SELECT id, username, role FROM users',
      {
        type: QueryTypes.SELECT,
      }
    )
    expect(users).toEqual([{ id: 1, username: 'ok.user', role: 'inhaber' }])
    await sequelize.close()
  })
})

describe('pilot baseline down()', () => {
  it('drops every baseline table (after B7 and B3 auth are undone)', async () => {
    const sequelize = await freshDb()
    await runMigrations(sequelize, quiet)
    await deliveriesMigration.down(sequelize.getQueryInterface(), Sequelize)
    await restMigration.down(sequelize.getQueryInterface(), Sequelize)
    await preordersMigration.down(sequelize.getQueryInterface(), Sequelize)
    await authMigration.down(sequelize.getQueryInterface(), Sequelize)
    expect(
      Object.keys(
        await sequelize.getQueryInterface().describeTable('refresh_tokens')
      )
    ).not.toContain('session_id')
    await baseline.down(sequelize.getQueryInterface(), Sequelize)
    expect(await tableNames(sequelize)).toEqual(['SequelizeMeta'])
    await sequelize.close()
  })
})

describe('M4 Rest am Abend migration (rest_counts)', () => {
  it('creates rest_counts with one row per day, item, variant and product, idempotently', async () => {
    const sequelize = await freshDb()
    await runMigrations(sequelize, quiet)
    expect(await columns(sequelize, 'rest_counts')).toEqual(
      [
        'business_date',
        'counted_by',
        'created_at',
        'factor',
        'id',
        'item_id',
        'item_name',
        'item_unit',
        'line_rows',
        'name',
        'product_id',
        'qty',
        'revision',
        'unit',
        'updated_at',
        'variant',
      ].sort()
    )
    const insert = (variant?: string, productId?: string) =>
      sequelize.query(
        `INSERT INTO rest_counts (business_date, item_id${
          variant === undefined ? '' : ', variant'
        }${
          productId === undefined ? '' : ', product_id'
        }, unit, item_unit, qty, created_at, updated_at) VALUES ('2026-12-01', 'testbrot'${
          variant === undefined ? '' : ', :variant'
        }${
          productId === undefined ? '' : ', :productId'
        }, 'Stück', 'Stück', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        { replacements: { variant, productId } }
      )
    await insert()
    await insert('nuss')
    await insert('', 'testbrot-klein')
    await expect(insert('', '')).rejects.toMatchObject({
      name: 'SequelizeUniqueConstraintError',
    })
    await expect(insert('nuss')).rejects.toMatchObject({
      name: 'SequelizeUniqueConstraintError',
    })
    const before = await tableNames(sequelize)
    await restMigration.up(sequelize.getQueryInterface(), Sequelize)
    expect(await tableNames(sequelize)).toEqual(before)
    await restMigration.down(sequelize.getQueryInterface(), Sequelize)
    expect(await tableNames(sequelize)).not.toContain('rest_counts')
    await sequelize.close()
  })
})

describe('B7 preorders migration', () => {
  it('adds preorders.not_collected_at and the Mörsbach point, idempotently', async () => {
    const sequelize = await freshDb()
    await runMigrations(sequelize, quiet)
    expect(await columns(sequelize, 'preorders')).toContain('not_collected_at')
    const points = () =>
      sequelize.query<{ id: string; weekday: number; window: string }>(
        'SELECT id, weekday, "window" FROM pickup_points',
        { type: QueryTypes.SELECT }
      )
    expect(await points()).toEqual([
      { id: 'kindergarten-moersbach', weekday: 6, window: '09:00-09:30' },
    ])
    await preordersMigration.up(sequelize.getQueryInterface(), Sequelize)
    expect(await points()).toHaveLength(1)
    await preordersMigration.down(sequelize.getQueryInterface(), Sequelize)
    expect(await columns(sequelize, 'preorders')).not.toContain(
      'not_collected_at'
    )
    expect(await tableNames(sequelize)).not.toContain('preorder_codes')
    // the point stays: preorders may reference it
    expect(await points()).toHaveLength(1)
    await sequelize.close()
  })
})

describe('B7 code registry (preorder_codes)', () => {
  it('backfills the codes of existing preorders, idempotently', async () => {
    const sequelize = await freshDb()
    await runMigrations(sequelize, quiet)
    const qi = sequelize.getQueryInterface()
    await preordersMigration.down(qi, Sequelize)
    const now = new Date()
    await qi.bulkInsert('preorders', [
      {
        code: 'LA-2026-11-17-01',
        channel: 'telefon',
        customer_name: 'Testkunde',
        pickup_date: '2026-11-17',
        status: 'offen',
        paid: false,
        created_at: now,
        updated_at: now,
      },
    ])
    await preordersMigration.up(qi, Sequelize)
    await preordersMigration.up(qi, Sequelize)
    expect(
      await sequelize.query('SELECT code FROM preorder_codes', {
        type: QueryTypes.SELECT,
      })
    ).toEqual([{ code: 'LA-2026-11-17-01' }])
    await sequelize.close()
  })
})

describe('B3 auth migration (stations, auth_sessions)', () => {
  it('adds refresh_tokens.session_id and the two tables, idempotently', async () => {
    const sequelize = await freshDb()
    await runMigrations(sequelize, quiet)
    expect(await columns(sequelize, 'refresh_tokens')).toContain('session_id')
    expect(await columns(sequelize, 'stations')).toEqual(
      [
        'created_at',
        'created_by',
        'id',
        'last_used_at',
        'name',
        'revoked_at',
        'token_hash',
        'updated_at',
      ].sort()
    )
    expect(await columns(sequelize, 'auth_sessions')).toEqual(
      [
        'created_at',
        'expires_at',
        'id',
        'kind',
        'revoke_reason',
        'revoked_at',
        'station_id',
        'updated_at',
        'user_agent',
        'user_id',
      ].sort()
    )
    const before = await tableNames(sequelize)
    await authMigration.up(sequelize.getQueryInterface(), Sequelize)
    expect(await tableNames(sequelize)).toEqual(before)
    expect(await foreignKeyViolations(sequelize)).toEqual([])
    await sequelize.close()
  })
})

describe('B3 auth migration: usernames', () => {
  it('lower-cases legacy usernames unless the normalised name is taken', async () => {
    const sequelize = await freshDb()
    await runMigrations(sequelize, {
      ...quiet,
      migrations: MIGRATIONS.filter((m) => m.name.includes('pilot-baseline')),
    })
    const now = "'2026-09-01 08:00:00'"
    await sequelize.query(
      `INSERT INTO users (id, username, display_name, role, password_hash, active, created_at, updated_at)
       VALUES (1, 'Alt.Admin', 'Alt Admin', 'inhaber', '!legacy-user-disabled', 0, ${now}, ${now}),
              (2, ' alt.staff ', 'Alt Staff', 'verkauf', '!legacy-user-disabled', 0, ${now}, ${now}),
              (3, 'Doppelt', 'Doppelt A', 'verkauf', '!legacy-user-disabled', 0, ${now}, ${now}),
              (4, 'doppelt', 'Doppelt B', 'verkauf', '!legacy-user-disabled', 0, ${now}, ${now}),
              (5, 'schon.klein', 'Klein', 'verkauf', '!legacy-user-disabled', 0, ${now}, ${now})`
    )
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    let warnings: string[] = []
    try {
      await runMigrations(sequelize, quiet)
      // Idempotent.
      await authMigration.up(sequelize.getQueryInterface(), Sequelize)
      warnings = warn.mock.calls.map((c) => String(c[0]))
    } finally {
      warn.mockRestore()
    }
    const users = await sequelize.query<{ id: number; username: string }>(
      'SELECT id, username FROM users ORDER BY id',
      { type: QueryTypes.SELECT }
    )
    expect(users).toEqual([
      { id: 1, username: 'alt.admin' },
      { id: 2, username: 'alt.staff' },
      { id: 3, username: 'Doppelt' },
      { id: 4, username: 'doppelt' },
      { id: 5, username: 'schon.klein' },
    ])
    // Only the collision is reported, on each run.
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.every((w) => w.includes('users.id 3'))).toBe(true)
    await sequelize.close()
  })
})

describe('B8 delivery tours migration', () => {
  it('creates the tour tables and the depot row, idempotently, and drops them again', async () => {
    const sequelize = await freshDb()
    await runMigrations(sequelize, quiet)
    for (const table of deliveriesMigration.TABLES) {
      expect(await tableNames(sequelize)).toContain(table)
    }
    expect(await columns(sequelize, 'delivery_stops')).toEqual(
      expect.arrayContaining([
        'tour_id',
        'position',
        'pickup_point_id',
        'import_key',
        'anonymized_at',
      ])
    )
    const depot = () =>
      sequelize.query<{ id: number; city: string }>(
        'SELECT id, city FROM delivery_depot',
        { type: QueryTypes.SELECT }
      )
    expect(await depot()).toEqual([
      { id: 1, city: deliveriesMigration.DEPOT.city },
    ])
    await deliveriesMigration.up(sequelize.getQueryInterface(), Sequelize)
    expect(await depot()).toHaveLength(1)
    await deliveriesMigration.down(sequelize.getQueryInterface(), Sequelize)
    for (const table of deliveriesMigration.TABLES) {
      expect(await tableNames(sequelize)).not.toContain(table)
    }
    await sequelize.close()
  })
})
