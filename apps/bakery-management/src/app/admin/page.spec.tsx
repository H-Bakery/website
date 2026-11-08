import { render } from '@testing-library/react'

/**
 * Das Dashboard (Server-Komponente) liest die Kassenzahlen nur für Rollen,
 * die das Berichtsarchiv öffnen dürfen - geprüft am Header des Proxys.
 * Sonst stünden sie im RSC-Payload, auch wenn die Oberfläche sie ausblendet.
 */

let mockHeaders: Record<string, string> = {}
jest.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => mockHeaders[name.toLowerCase()] ?? null,
  }),
}))

const mockLatest = jest.fn()
jest.mock('../../lib/reports', () => ({
  getLatestDailyReport: () => mockLatest(),
  reportsAvailable: () => true,
}))

const mockClient = jest.fn()
jest.mock('./DashboardClient', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockClient(props)
    return null
  },
}))

import AdminDashboardPage from './page'

async function renderPage(headers: Record<string, string>) {
  mockHeaders = headers
  render(await AdminDashboardPage())
  return mockClient.mock.calls.at(-1)?.[0]
}

describe('Dashboard-Seite (Server)', () => {
  beforeEach(() => {
    mockLatest.mockReset().mockReturnValue({
      status: 'ok',
      date: '2026-01-06',
      weekday: 'Dienstag',
      revenue: 100,
      receiptCount: 10,
      avgReceipt: 10,
      cashShare: 0.5,
      cardShare: 0.5,
    })
    mockClient.mockReset()
  })

  it('Inhaber: Kassen-Kachel wird gelesen', async () => {
    const props = await renderPage({
      'x-bakery-role': 'inhaber',
      'x-bakery-session-kind': 'personal',
    })
    expect(mockLatest).toHaveBeenCalled()
    expect(props).toMatchObject({ latestReport: { revenue: 100 } })
  })

  it.each(['verkauf', 'backstube'])(
    '%s: keine Kassenzahlen im Payload',
    async (role) => {
      const props = await renderPage({
        'x-bakery-role': role,
        'x-bakery-session-kind': 'station',
      })
      expect(mockLatest).not.toHaveBeenCalled()
      expect(props).toEqual({ latestReport: null, reportsAvailable: false })
    }
  )

  it('ohne geprüften Header: keine Kassenzahlen', async () => {
    const props = await renderPage({})
    expect(mockLatest).not.toHaveBeenCalled()
    expect(props).toEqual({ latestReport: null, reportsAvailable: false })
  })
})
