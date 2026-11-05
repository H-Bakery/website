import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import DashboardClient from './DashboardClient'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@bakery/shared/data-access', () => ({
  apiClient: { get: jest.fn() },
}))

jest.mock('@bakery/shared/contexts', () => ({
  useNotifications: () => ({ notifications: [], isLoading: false }),
}))

jest.mock('../../components/targets/TargetsTile', () => ({
  __esModule: true,
  default: () => <div data-testid="targets-tile" />,
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock }
}

// Erfundene Produkte, nur Form und Anzahl zählen.
const PRODUCTS = [
  { id: 'a', available: true },
  { id: 'b', available: true },
  { id: 'c', available: false },
]

function renderDashboard() {
  return renderWithTheme(
    <DashboardClient latestReport={null} reportsAvailable={false} />
  )
}

describe('DashboardClient', () => {
  const original = process.env.NEXT_PUBLIC_PILOT_MODE

  beforeEach(() => {
    apiClient.get.mockReset()
    apiClient.get.mockImplementation((url: string) =>
      Promise.resolve({
        success: true,
        data: url === '/api/products' ? PRODUCTS : [],
      })
    )
  })

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_PILOT_MODE
    else process.env.NEXT_PUBLIC_PILOT_MODE = original
  })

  it('zeigt ohne Pilotbetrieb alle Kacheln und Schnellzugriffe', async () => {
    delete process.env.NEXT_PUBLIC_PILOT_MODE
    renderDashboard()
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/api/orders')
    )
    expect(apiClient.get).toHaveBeenCalledWith('/api/production')
    expect(screen.getByText('Offene Bestellungen')).toBeInTheDocument()
    expect(screen.getByText('Produktionsübersicht')).toBeInTheDocument()
    expect(screen.getByText('Letzte Aktivitäten')).toBeInTheDocument()
    expect(screen.getByText('Inventar')).toBeInTheDocument()
  })

  it('blendet im Pilotbetrieb die Mock-Kacheln aus', async () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = '1'
    renderDashboard()
    expect(await screen.findByText('API erreichbar')).toBeInTheDocument()

    // Nur echte Daten: Produkte (hq), Kasse, Tagesziel, Systemstatus.
    expect(apiClient.get).toHaveBeenCalledTimes(1)
    expect(apiClient.get).toHaveBeenCalledWith('/api/products')
    expect(screen.getByText('Produkte gesamt')).toBeInTheDocument()
    expect(screen.getByTestId('targets-tile')).toBeInTheDocument()

    expect(screen.queryByText('Offene Bestellungen')).not.toBeInTheDocument()
    expect(screen.queryByText('Produktionsübersicht')).not.toBeInTheDocument()
    expect(screen.queryByText('Letzte Aktivitäten')).not.toBeInTheDocument()
  })

  it('zeigt im Pilotbetrieb nur Schnellzugriffe auf erlaubte Seiten', async () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = '1'
    renderDashboard()
    await screen.findByText('API erreichbar')
    ;['Produkte', 'Kassenberichte', 'Analysen'].forEach((title) =>
      expect(
        screen.getByRole('heading', { level: 2, name: title })
      ).toBeInTheDocument()
    )
    ;[
      'Bestellungen',
      'Inventar',
      'Produktion',
      'Lieferungen',
      'Backliste',
    ].forEach((title) =>
      expect(
        screen.queryByRole('heading', { level: 2, name: title })
      ).not.toBeInTheDocument()
    )
  })
})
