/**
 * Loader-Tests für die Kassenberichte. Die Fixtures sind synthetisch und
 * liegen in einem temporären Verzeichnis, das über `HQ_REPORTS_DIR`
 * eingehängt wird - kein Test liest echte Tagesfiles aus `hq`.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  getDailyReport,
  getLatestDailyReport,
  getMonthlyReport,
  listDailyReports,
  listReportDates,
  reportsAvailable,
  shiftDate,
} from './reports'

let root: string
const originalEnv = process.env.HQ_REPORTS_DIR

function tx(
  items: Array<{
    product: string
    product_id: string
    quantity: number
    price: number
  }>,
  overrides: Record<string, unknown> = {}
) {
  const withTotals = items.map((i) => ({ ...i, total: i.quantity * i.price }))
  return {
    id: `T${Math.random().toString(36).slice(2)}`,
    timestamp: '2026-05-05T07:30:00+02:00',
    type: 'sale',
    user: 'Kasse',
    payment: 'Bar',
    total: withTotals.reduce((s, i) => s + i.total, 0),
    ...overrides,
    items: withTotals,
  }
}

const BROT = { product: 'Testbrot', product_id: '1', quantity: 1, price: 4 }
const HOERNCHEN = {
  product: 'Testhörnchen',
  product_id: '2',
  quantity: 2,
  price: 1.5,
}

function writeDay(name: string, date: string, transactions: unknown[]) {
  const dir = path.join(root, 'converted')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, name),
    JSON.stringify({
      date,
      register_id: '4711',
      report_number: 1,
      company: 'Testbäckerei',
      transactions,
    })
  )
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mgmt-reports-'))
  process.env.HQ_REPORTS_DIR = root
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  if (originalEnv === undefined) delete process.env.HQ_REPORTS_DIR
  else process.env.HQ_REPORTS_DIR = originalEnv
  jest.restoreAllMocks()
})

describe('reports loader', () => {
  it('antwortet ohne Verzeichnis mit Hinweis und leerem Ergebnis, nicht mit Absturz', () => {
    process.env.HQ_REPORTS_DIR = path.join(root, 'fehlt')

    expect(reportsAvailable()).toBe(false)
    expect(listReportDates()).toEqual([])
    expect(getLatestDailyReport()).toBeNull()
    expect(getDailyReport('2026-05-05')).toEqual({
      status: 'no-data',
      date: '2026-05-05',
      weekday: 'Dienstag',
    })

    const list = listDailyReports('2026-05-04', '2026-05-06')
    expect(list.available).toBe(false)
    expect(list.days.map((d) => d.status)).toEqual([
      'no-data',
      'no-data',
      'no-data',
    ])
    expect(list.summary.status).toBe('no-data')
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('HQ reports directory not found')
    )
  })

  it('liest einen Tag mit Positionen und rechnet Unbar als Karte', () => {
    writeDay('2026-05-05_4711.json', '2026-05-05', [
      tx([BROT], { payment: 'Bar' }),
      tx([HOERNCHEN], { payment: 'Unbar' }),
    ])

    const report = getDailyReport('2026-05-05')
    expect(report.status).toBe('ok')
    if (report.status !== 'ok') return
    expect(report.revenue).toBe(7)
    expect(report.receiptCount).toBe(2)
    expect(report.avgReceipt).toBe(3.5)
    expect(report.payments.card).toEqual({ amount: 3, count: 1 })
    expect(report.payments.cash).toEqual({ amount: 4, count: 1 })
    expect(report.products.map((p) => p.productName)).toEqual([
      'Testbrot',
      'Testhörnchen',
    ])
  })

  it('listet Lücken als „kein Bericht" und addiert den zweiten Abschluss', () => {
    writeDay('2026-05-05_4711.json', '2026-05-05', [tx([BROT])])
    writeDay('2026-05-05_4711_2.json', '2026-05-05', [tx([BROT])])
    writeDay('2026-05-07_4711.json', '2026-05-07', [
      tx([BROT]),
      tx([BROT], { type: 'storno', total: -4 }),
    ])

    const list = listDailyReports('2026-05-04', '2026-05-07')
    expect(list.available).toBe(true)
    expect(list.days.map((d) => [d.date, d.status])).toEqual([
      ['2026-05-04', 'no-data'],
      ['2026-05-05', 'ok'],
      ['2026-05-06', 'no-data'],
      ['2026-05-07', 'ok'],
    ])
    const tuesday = list.days[1]
    expect(tuesday.status === 'ok' && tuesday.closingCount).toBe(2)
    expect(tuesday.status === 'ok' && tuesday.revenue).toBe(8)
    // Listeneinträge tragen keine Positionen
    expect((tuesday as { products?: unknown }).products).toBeUndefined()

    expect(list.summary.status).toBe('ok')
    if (list.summary.status !== 'ok') return
    expect(list.summary.dayCount).toBe(2)
    expect(list.summary.missingDays).toEqual(['2026-05-04', '2026-05-06'])
    // Storno-Paar am Donnerstag: Umsatz 0, ein Bon
    expect(list.summary.revenue).toBe(8)
    expect(list.summary.receiptCount).toBe(3)
    expect(list.summary.stornoCount).toBe(1)
  })

  it('weist ungültige Zeiträume ab, ohne zu werfen', () => {
    const list = listDailyReports('2026-05-07', '2026-05-05')
    expect(list.days).toEqual([])
    expect(list.summary.status).toBe('no-data')
    expect(getDailyReport('Dienstag').status).toBe('no-data')
  })

  it('liefert Monat, jüngsten Tag und Datumsverschiebung', () => {
    writeDay('2026-04-30_4711.json', '2026-04-30', [tx([BROT])])
    writeDay('2026-05-05_4711.json', '2026-05-05', [tx([BROT])])
    writeDay('2026-05-09_4711.json', '2026-05-09', [tx([HOERNCHEN])])

    const month = getMonthlyReport('2026-05')
    expect(month.status).toBe('ok')
    expect(month.label).toBe('Mai 2026')
    expect(month.dayCount).toBe(2)
    expect(month.days.map((d) => d.date)).toEqual(['2026-05-05', '2026-05-09'])
    expect(getMonthlyReport('2026-5').status).toBe('no-data')

    expect(listReportDates()).toEqual([
      '2026-04-30',
      '2026-05-05',
      '2026-05-09',
    ])
    const latest = getLatestDailyReport()
    expect(latest?.status).toBe('ok')
    expect(latest?.date).toBe('2026-05-09')
    expect(shiftDate('2026-05-09', -30)).toBe('2026-04-09')
  })
})
