'use strict'

/**
 * Ausgangsrechnungen (ZUGFeRD/Factur-X) - additive Migration.
 *
 * `invoices`: eine Rechnung als eingefrorener Stand. Ein Entwurf (`entwurf`)
 * ist änderbar; mit dem Ausstellen (`ausgestellt`) werden Verkäufer, Summen
 * und die XML festgeschrieben und nie wieder angefasst. Korrektur = stornieren
 * (`storniert`) und neu ausstellen. `number` ist die vom Inhaber eingetragene
 * Rechnungsnummer (das alte System läuft parallel, die App zählt nicht selbst);
 * eindeutig, bei Entwürfen NULL. `preorder_id`/`preorder_code` verweisen auf
 * die Vorbestellung, ohne Fremdschlüssel: die Rechnung hält alles selbst und
 * überlebt die Anonymisierung der Vorbestellung nach 90 Tagen (Aufbewahrung
 * nach § 14b UStG).
 *
 * `invoice_lines`: Positionen mit Bruttopreis in Cent, Steuersatz und den
 * daraus gerechneten Beträgen (`services/invoice.core.js`).
 *
 * Geld steht in ganzen Cent (INTEGER), nicht als DECIMAL.
 *
 * Idempotent: Tabellen und Indizes werden nur angelegt, wenn sie fehlen.
 */

/** Tables this migration creates (the pilot baseline test lists them). */
const TABLES = ['invoices', 'invoice_lines']

const NUMBER_INDEX = 'invoices_number_unique'
const PREORDER_INDEX = 'invoices_preorder_id'
const LINES_INDEX = 'invoice_lines_invoice_position'

async function tableNames(queryInterface) {
  return (await queryInterface.showAllTables()).map((t) =>
    typeof t === 'string' ? t : t.tableName
  )
}

async function ensureIndex(queryInterface, table, name, fields, unique) {
  const indexes = await queryInterface.showIndex(table)
  if (!indexes.some((i) => i.name === name)) {
    await queryInterface.addIndex(table, fields, { name, unique })
  }
}

module.exports = {
  TABLES,

  async up(queryInterface, Sequelize) {
    const tables = await tableNames(queryInterface)

    if (!tables.includes('invoices')) {
      await queryInterface.createTable('invoices', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        number: { type: Sequelize.STRING(40), allowNull: true },
        status: {
          type: Sequelize.STRING(16),
          allowNull: false,
          defaultValue: 'entwurf',
        },
        preorder_id: { type: Sequelize.INTEGER, allowNull: true },
        preorder_code: { type: Sequelize.STRING(32), allowNull: true },
        buyer_name: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: '',
        },
        buyer_care_of: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: '',
        },
        buyer_street: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: '',
        },
        buyer_postcode: {
          type: Sequelize.STRING(16),
          allowNull: false,
          defaultValue: '',
        },
        buyer_city: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: '',
        },
        buyer_country: {
          type: Sequelize.STRING(2),
          allowNull: false,
          defaultValue: 'DE',
        },
        invoice_date: { type: Sequelize.DATEONLY, allowNull: true },
        delivery_date: { type: Sequelize.DATEONLY, allowNull: true },
        payment_term_days: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 14,
        },
        payment_text: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: '',
        },
        due_date: { type: Sequelize.DATEONLY, allowNull: true },
        note: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
        // Festgeschrieben beim Ausstellen: Verkäufer (mit Bankverbindung),
        // Summen je Steuersatz und die eingebettete XML.
        seller: { type: Sequelize.JSON, allowNull: true },
        totals: { type: Sequelize.JSON, allowNull: true },
        xml: { type: Sequelize.TEXT, allowNull: true },
        issued_at: { type: Sequelize.DATE, allowNull: true },
        issued_by: { type: Sequelize.INTEGER, allowNull: true },
        cancelled_at: { type: Sequelize.DATE, allowNull: true },
        cancelled_by: { type: Sequelize.INTEGER, allowNull: true },
        cancel_reason: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: '',
        },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        updated_by: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      })
    }
    // SQLite lässt in einem UNIQUE-Index beliebig viele NULL zu: Entwürfe
    // ohne Nummer stören sich nicht, vergebene Nummern sind eindeutig.
    await ensureIndex(
      queryInterface,
      'invoices',
      NUMBER_INDEX,
      ['number'],
      true
    )
    await ensureIndex(
      queryInterface,
      'invoices',
      PREORDER_INDEX,
      ['preorder_id'],
      false
    )

    if (!tables.includes('invoice_lines')) {
      await queryInterface.createTable('invoice_lines', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        invoice_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'invoices', key: 'id' },
          onDelete: 'CASCADE',
        },
        position: { type: Sequelize.INTEGER, allowNull: false },
        product_id: {
          type: Sequelize.STRING(128),
          allowNull: false,
          defaultValue: '',
        },
        name: { type: Sequelize.STRING, allowNull: false },
        unit: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'Stück',
        },
        quantity: { type: Sequelize.DECIMAL(12, 3), allowNull: false },
        unit_price_gross_cents: { type: Sequelize.INTEGER, allowNull: false },
        vat_rate: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
        gross_cents: { type: Sequelize.INTEGER, allowNull: false },
        net_cents: { type: Sequelize.INTEGER, allowNull: false },
        net_unit_price: { type: Sequelize.STRING(24), allowNull: false },
        net_basis_quantity: { type: Sequelize.STRING(16), allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      })
    }
    await ensureIndex(
      queryInterface,
      'invoice_lines',
      LINES_INDEX,
      ['invoice_id', 'position'],
      false
    )
  },

  async down(queryInterface) {
    const tables = await tableNames(queryInterface)
    if (tables.includes('invoice_lines')) {
      await queryInterface.dropTable('invoice_lines')
    }
    if (tables.includes('invoices')) {
      await queryInterface.dropTable('invoices')
    }
  },
}
