'use strict'

/**
 * Rechnungen, Nachbesserung - additive Spalten auf `invoices`.
 *
 * 1. `pdf` (BLOB), `pdf_sha256`, `pdf_stored_at`: das PDF wird beim Ausstellen
 *    einmal erzeugt und festgeschrieben; ausgeliefert werden danach genau
 *    diese Bytes. Vorher entstand es bei jedem Abruf neu - eine Änderung an
 *    Layout, Schrift oder pdfkit hätte alte Rechnungen verändert. In der
 *    Datenbank, nicht als Datei: so ist es ohne weiteres Zutun im Backup der
 *    Box. `cancel_pdf`, `cancel_pdf_sha256`: die Fassung mit Storno-Aufdruck,
 *    getrennt - das Original bleibt abrufbar.
 * 2. `paid`, `paid_on`, `paid_method`: „bereits bezahlt am … (bar/Karte)“.
 *    `preorder_paid_cents`: was die Vorbestellung beim Anlegen als bezahlt
 *    vermerkt hatte (Hinweis am Entwurf).
 * 3. `number_key`: Vergleichsform der Rechnungsnummer (`numberKey()` in
 *    `invoice.core.js`), eindeutig - „RE-7“ und „re-7 “ sind dieselbe Nummer.
 *    Für vorhandene Zeilen nachgetragen.
 * 4. `anonymized_at`: wann ein liegengebliebener Entwurf Name und Anschrift
 *    verloren hat (90-Tage-Lauf). Ausgestellte Rechnungen betrifft das nie.
 *
 * Idempotent: Spalten und Index werden nur angelegt, wenn sie fehlen.
 */
const core = require('../src/services/invoice.core')

const TABLE = 'invoices'
const KEY_INDEX = 'invoices_number_key_unique'

function columns(Sequelize) {
  return {
    number_key: { type: Sequelize.STRING(80), allowNull: true },
    pdf: { type: Sequelize.BLOB, allowNull: true },
    pdf_sha256: { type: Sequelize.STRING(64), allowNull: true },
    pdf_stored_at: { type: Sequelize.DATE, allowNull: true },
    cancel_pdf: { type: Sequelize.BLOB, allowNull: true },
    cancel_pdf_sha256: { type: Sequelize.STRING(64), allowNull: true },
    paid: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    paid_on: { type: Sequelize.DATEONLY, allowNull: true },
    paid_method: {
      type: Sequelize.STRING(8),
      allowNull: false,
      defaultValue: '',
    },
    preorder_paid_cents: { type: Sequelize.INTEGER, allowNull: true },
    anonymized_at: { type: Sequelize.DATE, allowNull: true },
  }
}

module.exports = {
  COLUMNS: [
    'number_key',
    'pdf',
    'pdf_sha256',
    'pdf_stored_at',
    'cancel_pdf',
    'cancel_pdf_sha256',
    'paid',
    'paid_on',
    'paid_method',
    'preorder_paid_cents',
    'anonymized_at',
  ],

  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.describeTable(TABLE)
    for (const [name, definition] of Object.entries(columns(Sequelize))) {
      if (!existing[name]) {
        await queryInterface.addColumn(TABLE, name, definition)
      }
    }

    const [rows] = await queryInterface.sequelize.query(
      'SELECT id, number FROM invoices WHERE number IS NOT NULL AND number_key IS NULL'
    )
    for (const row of rows) {
      await queryInterface.sequelize.query(
        'UPDATE invoices SET number_key = ? WHERE id = ?',
        { replacements: [core.numberKey(row.number), row.id] }
      )
    }

    const indexes = await queryInterface.showIndex(TABLE)
    if (!indexes.some((i) => i.name === KEY_INDEX)) {
      await queryInterface.addIndex(TABLE, ['number_key'], {
        name: KEY_INDEX,
        unique: true,
      })
    }
  },

  async down(queryInterface, Sequelize) {
    const indexes = await queryInterface.showIndex(TABLE)
    if (indexes.some((i) => i.name === KEY_INDEX)) {
      await queryInterface.removeIndex(TABLE, KEY_INDEX)
    }
    const existing = await queryInterface.describeTable(TABLE)
    for (const name of Object.keys(columns(Sequelize))) {
      if (existing[name]) await queryInterface.removeColumn(TABLE, name)
    }
  },
}
