/**
 * Loader der Finanzdaten. Liest ausschließlich synthetische Dateien aus einem
 * Temp-Verzeichnis - nie das echte `hq`.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getFinanceSummary, getHQFinanceDir } from './finance'

/** Erfundene Zusammenfassung mit erfundener IBAN und erfundenen Namen. */
function syntheticSummary(overrides: Record<string, unknown> = {}) {
  return {
    generated_at: '2026-04-01T08:00:00+02:00',
    schema_version: 1,
    period: { from: '2026-01-01', to: '2026-02-28' },
    accounts: ['DE00000000000000000009'],
    transaction_count: 4,
    category_labels: { umsatz: 'Umsatzerlöse', personal: 'Personal' },
    category_kinds: { umsatz: 'einnahme', personal: 'ausgabe' },
    subcategory_labels: {},
    totals: {
      umsatz: { amount: 300, count: 2, income: 300, expense: 0 },
      personal: { amount: -200, count: 2, income: 0, expense: -200 },
    },
    months: [
      {
        month: '2026-01',
        transactions: 2,
        operating_income: 100,
        operating_expense: -50,
        operating_result: 50,
        neutral: 0,
        net_change: 50,
        categories: {},
      },
      {
        month: '2026-02',
        transactions: 2,
        operating_income: 200,
        operating_expense: -150,
        operating_result: 50,
        neutral: 0,
        net_change: 50,
        categories: {},
      },
    ],
    top_counterparties: [
      {
        name: 'Erika Beispielfrau',
        amount: -200,
        count: 2,
        category: 'personal',
      },
    ],
    uncategorized: {
      count: 1,
      amount: -5,
      transactions: [
        {
          date: '2026-01-02',
          amount: -5,
          counterparty: 'Max Beispielmann',
          purpose: 'x',
        },
      ],
    },
    ...overrides,
  }
}

describe('getFinanceSummary', () => {
  let dir: string
  let warn: jest.SpyInstance
  const originalEnv = process.env.HQ_FINANCE_DIR

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-spec-'))
    process.env.HQ_FINANCE_DIR = dir
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warn.mockRestore()
    fs.rmSync(dir, { recursive: true, force: true })
    if (originalEnv === undefined) delete process.env.HQ_FINANCE_DIR
    else process.env.HQ_FINANCE_DIR = originalEnv
  })

  function write(content: unknown) {
    fs.writeFileSync(
      path.join(dir, 'finance-summary.json'),
      typeof content === 'string' ? content : JSON.stringify(content)
    )
  }

  it('honours HQ_FINANCE_DIR', () => {
    expect(getHQFinanceDir()).toBe(dir)
  })

  it('falls back to <website>/../hq/data/finance without the override', () => {
    delete process.env.HQ_FINANCE_DIR
    const resolved = getHQFinanceDir()
    expect(resolved.endsWith(path.join('hq', 'data', 'finance'))).toBe(true)
    expect(path.isAbsolute(resolved)).toBe(true)
  })

  it('liefert die bereinigte Zusammenfassung', () => {
    write(syntheticSummary())
    const result = getFinanceSummary()
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.data.months).toHaveLength(2)
    expect(result.data.generated_at).toBe('2026-04-01T08:00:00+02:00')
    expect(result.data).not.toHaveProperty('accounts')
    expect(result.data).not.toHaveProperty('top_counterparties')
    expect(result.data.uncategorized).toEqual({ count: 1, amount: -5 })
    const text = JSON.stringify(result.data)
    expect(text).not.toContain('DE00000000000000000009')
    expect(text).not.toContain('Beispielfrau')
    expect(text).not.toContain('Beispielmann')
    expect(warn).not.toHaveBeenCalled()
  })

  it('fehlendes Verzeichnis: no-data mit Hinweis, ohne Throw', () => {
    process.env.HQ_FINANCE_DIR = path.join(dir, 'gibt-es-nicht')
    const result = getFinanceSummary()
    expect(result).toEqual({
      status: 'no-data',
      reason: expect.stringContaining('nicht gefunden'),
    })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('HQ finance directory not found')
    )
  })

  it('fehlende Datei: no-data mit Hinweis', () => {
    const result = getFinanceSummary()
    expect(result.status).toBe('no-data')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('HQ finance summary not found')
    )
  })

  it('falsche schema_version: no-data, keine Beispieldaten', () => {
    write(syntheticSummary({ schema_version: 2 }))
    const result = getFinanceSummary()
    expect(result.status).toBe('no-data')
    if (result.status !== 'no-data') return
    expect(result.reason).toContain('schema_version')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('HQ finance summary rejected')
    )
  })

  it('kaputtes JSON: no-data', () => {
    write('{ "schema_version": 1, kaputt')
    expect(getFinanceSummary().status).toBe('no-data')
  })
})
