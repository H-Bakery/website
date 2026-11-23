'use strict'

const TABLES = [
  'receipts',
  'receipt_vat_lines',
  'receipt_files',
  'receipt_extractions',
  'transaction_links',
]

module.exports = {
  TABLES,
  async up(q, S) {
    await q.sequelize.transaction(async (transaction) => {
      const options = { transaction }
      const id = { type: S.INTEGER, primaryKey: true, autoIncrement: true }
      const required = (type) => ({ type, allowNull: false })
      const choice = (...values) => required(S.ENUM(...values))
      const receiptId = {
        ...required(S.INTEGER),
        references: { model: 'receipts', key: 'id' },
        onDelete: 'CASCADE',
      }
      const actor = {
        type: S.INTEGER,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      }

      await q.createTable(
        'receipts',
        {
          id,
          status: choice('neu', 'erkannt', 'geprueft', 'verworfen'),
          kind: choice('eingangsrechnung', 'kassenbeleg', 'gutschrift'),
          supplier_name: S.STRING,
          supplier_vat_id: S.STRING,
          supplier_iban: S.STRING,
          invoice_number: S.STRING,
          invoice_date: S.DATEONLY,
          due_date: S.DATEONLY,
          gross_cents: S.INTEGER,
          currency: { ...required(S.STRING(3)), defaultValue: 'EUR' },
          payment: choice(
            'ueberweisung',
            'lastschrift',
            'bar',
            'karte',
            'offen'
          ),
          skonto_rate: S.DECIMAL(6, 3),
          skonto_due_date: S.DATEONLY,
          extracted_by: S.ENUM(
            'xml',
            'textlayer',
            'manuell',
            'tesseract',
            'vlm_local',
            'mistral'
          ),
          confidence: S.FLOAT,
          field_flags: { ...required(S.TEXT), defaultValue: '{}' },
          confirmed_by: actor,
          confirmed_at: S.DATE,
          created_by: actor,
          created_at: required(S.DATE),
          upload_date: required(S.DATEONLY),
          booking_hint: S.STRING(40),
        },
        options
      )

      await q.createTable(
        'receipt_vat_lines',
        {
          id,
          receipt_id: receiptId,
          rate: required(S.DECIMAL(6, 3)),
          net_cents: required(S.INTEGER),
          vat_cents: required(S.INTEGER),
        },
        options
      )
      await q.createTable(
        'receipt_files',
        {
          id,
          receipt_id: receiptId,
          role: choice('original', 'xml'),
          mime: required(S.STRING),
          sha256: { ...required(S.STRING(64)), unique: true },
          path: required(S.STRING),
          page: required(S.INTEGER),
          size: required(S.INTEGER),
        },
        options
      )
      await q.createTable(
        'receipt_extractions',
        {
          id,
          receipt_id: receiptId,
          file_id: {
            ...required(S.INTEGER),
            references: { model: 'receipt_files', key: 'id' },
            onDelete: 'CASCADE',
          },
          engine: required(S.STRING),
          version: required(S.STRING),
          raw: S.TEXT,
          fields: S.TEXT,
          duration_ms: required(S.INTEGER),
          error: S.STRING,
          created_at: required(S.DATE),
        },
        options
      )
      await q.createTable(
        'transaction_links',
        {
          id,
          transaction_id: required(S.STRING(40)),
          kind: choice('invoice', 'receipt'),
          target_id: required(S.INTEGER),
          amount_cents: required(S.INTEGER),
          discount_cents: { ...required(S.INTEGER), defaultValue: 0 },
          matched_by: choice('auto', 'manual'),
          score: S.INTEGER,
          status: choice('vorgeschlagen', 'bestaetigt', 'abgelehnt'),
          confirmed_by: actor,
          confirmed_at: S.DATE,
          booking_date: required(S.DATEONLY),
          booking_amount_cents: required(S.INTEGER),
          counterparty_key: required(S.STRING),
        },
        options
      )
      await q.addIndex('receipt_vat_lines', ['receipt_id'], options)
      await q.addIndex('receipt_files', ['receipt_id', 'page'], {
        ...options,
        unique: true,
      })
      await q.addIndex(
        'receipt_extractions',
        ['receipt_id', 'file_id'],
        options
      )
      await q.addIndex(
        'transaction_links',
        ['transaction_id', 'kind', 'target_id'],
        { ...options, unique: true }
      )
      await q.addIndex('transaction_links', ['kind', 'target_id'], options)
    })
  },

  async down(q, S) {
    await q.sequelize.transaction(async (transaction) => {
      const rows = await q.sequelize.query('SELECT id FROM receipts LIMIT 1', {
        transaction,
        type: S.QueryTypes.SELECT,
      })
      const links = await q.sequelize.query(
        'SELECT id FROM transaction_links LIMIT 1',
        { transaction, type: S.QueryTypes.SELECT }
      )
      if (rows.length || links.length)
        throw new Error(
          'Belege und Buchungsverknüpfungen würden verloren gehen.'
        )
      for (const table of [...TABLES].reverse())
        await q.dropTable(table, { transaction })
    })
  },
}
