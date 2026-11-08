'use strict'

/**
 * TASK-042 Dienstplan und Urlaubsplanung - additive migration, after the pilot.
 *
 *   employees              staff of the bakery (not logins): display name,
 *                          area (verkauf|backstube|fahrer|buero), calendar
 *                          colour, employment type, weekly hours, entry/exit
 *                          date, `active` (deactivated, never deleted),
 *                          optional `user_id` → users, note (owner only)
 *   vacation_entitlements  one row per employee and year: annual entitlement
 *                          and carryover in days, both nullable (missing =
 *                          "offen", never 0) - a later change does not
 *                          rewrite old years
 *   shift_templates        "Früh 6-12" etc. for quick entry
 *   shifts                 Verkauf only (checked by the API): date, start,
 *                          end (same day), break minutes, note
 *   absences               urlaub|frei|abwesend, geplant|genehmigt, whole
 *                          days from-to, optional half day; no health data
 *
 * Personal data stays in the box's SQLite (D13), never in hq. Rules and
 * formulas: `src/services/vacation.core.js`.
 *
 * Idempotent: tables and indexes are created only if missing. Nothing else
 * is touched.
 */

/** Tables this migration creates (the pilot baseline test lists them). */
const TABLES = [
  'employees',
  'vacation_entitlements',
  'shift_templates',
  'shifts',
  'absences',
]

const INDEXES = [
  {
    table: 'vacation_entitlements',
    name: 'vacation_entitlements_employee_year_unique',
    fields: ['employee_id', 'year'],
    unique: true,
  },
  {
    table: 'shifts',
    name: 'shifts_employee_date',
    fields: ['employee_id', 'date'],
  },
  { table: 'shifts', name: 'shifts_date', fields: ['date'] },
  {
    table: 'absences',
    name: 'absences_employee_start',
    fields: ['employee_id', 'start_date'],
  },
  {
    table: 'absences',
    name: 'absences_range',
    fields: ['start_date', 'end_date'],
  },
]

async function tableSet(queryInterface) {
  return new Set(
    (await queryInterface.showAllTables()).map((t) =>
      String(typeof t === 'string' ? t : t.tableName).toLowerCase()
    )
  )
}

module.exports = {
  TABLES,

  async up(queryInterface, Sequelize) {
    const existing = await tableSet(queryInterface)
    const timestamps = {
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    }
    const id = {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    }
    const employeeRef = {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'employees', key: 'id' },
      onDelete: 'CASCADE',
    }

    if (!existing.has('employees')) {
      await queryInterface.createTable('employees', {
        id,
        display_name: { type: Sequelize.STRING(80), allowNull: false },
        area: { type: Sequelize.STRING(16), allowNull: false },
        color: { type: Sequelize.STRING(7), allowNull: true },
        employment_type: { type: Sequelize.STRING(16), allowNull: true },
        weekly_hours: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
        entry_date: { type: Sequelize.DATEONLY, allowNull: true },
        exit_date: { type: Sequelize.DATEONLY, allowNull: true },
        active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        note: { type: Sequelize.TEXT, allowNull: true },
        ...timestamps,
      })
    }

    if (!existing.has('vacation_entitlements')) {
      await queryInterface.createTable('vacation_entitlements', {
        id,
        employee_id: employeeRef,
        year: { type: Sequelize.INTEGER, allowNull: false },
        entitlement_days: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
        carryover_days: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
        ...timestamps,
      })
    }

    if (!existing.has('shift_templates')) {
      await queryInterface.createTable('shift_templates', {
        id,
        name: { type: Sequelize.STRING(40), allowNull: false },
        start_time: { type: Sequelize.STRING(5), allowNull: false },
        end_time: { type: Sequelize.STRING(5), allowNull: false },
        break_minutes: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        ...timestamps,
      })
    }

    if (!existing.has('shifts')) {
      await queryInterface.createTable('shifts', {
        id,
        employee_id: employeeRef,
        date: { type: Sequelize.DATEONLY, allowNull: false },
        start_time: { type: Sequelize.STRING(5), allowNull: false },
        end_time: { type: Sequelize.STRING(5), allowNull: false },
        break_minutes: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        note: { type: Sequelize.TEXT, allowNull: true },
        ...timestamps,
      })
    }

    if (!existing.has('absences')) {
      await queryInterface.createTable('absences', {
        id,
        employee_id: employeeRef,
        type: { type: Sequelize.STRING(16), allowNull: false },
        status: {
          type: Sequelize.STRING(16),
          allowNull: false,
          defaultValue: 'geplant',
        },
        start_date: { type: Sequelize.DATEONLY, allowNull: false },
        end_date: { type: Sequelize.DATEONLY, allowNull: false },
        half_day: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        note: { type: Sequelize.TEXT, allowNull: true },
        ...timestamps,
      })
    }

    for (const index of INDEXES) {
      const present = await queryInterface.showIndex(index.table)
      if (present.some((i) => i.name === index.name)) continue
      await queryInterface.addIndex(index.table, index.fields, {
        name: index.name,
        unique: Boolean(index.unique),
      })
    }
  },

  async down(queryInterface) {
    const existing = await tableSet(queryInterface)
    for (const table of [...TABLES].reverse()) {
      if (existing.has(table)) await queryInterface.dropTable(table)
    }
  },
}
