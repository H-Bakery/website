import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import BackzettelOverviewClient from './BackzettelOverviewClient'
import * as api from '../../../lib/backzettelApi'
import {
  CONFIG_RESPONSE,
  TEST_CONFIG,
  saturdayConfirmed,
  saturdayDraft,
} from '../../../lib/backzettelFixtures'
import { fakeSession, WithSession } from '../../../lib/testing/fakeSession'

jest.mock('../../../lib/backzettelApi', () => {
  const actual = jest.requireActual('../../../lib/backzettelApi')
  return {
    ...actual,
    fetchBackzettelConfig: jest.fn(),
    fetchBackzettelDay: jest.fn(),
  }
})
const mocked = api as jest.Mocked<typeof api>

// Do 2026-11-26: Do, Fr, Sa, So, (Mo Ruhetag), Di, Mi
const TODAY = '2026-11-26'

describe('Backzettel-Übersicht', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchBackzettelConfig.mockResolvedValue(CONFIG_RESPONSE)
    mocked.fetchBackzettelDay.mockImplementation(async (date: string) => {
      if (date === '2026-11-28') return saturdayConfirmed()
      return saturdayDraft({ date, deltas: [], warnings: [] })
    })
  })

  it('listet die Produktionstage der kommenden Woche ohne Montag', async () => {
    render(<BackzettelOverviewClient today={TODAY} />)
    const list = await screen.findByTestId('day-list')
    await waitFor(() =>
      expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(6)
    )
    const ids = within(list)
      .getAllByTestId(/^day-\d/)
      .map((el) => el.getAttribute('data-testid'))
    expect(ids).toEqual([
      'day-2026-11-26',
      'day-2026-11-27',
      'day-2026-11-28',
      'day-2026-11-29',
      'day-2026-12-01',
      'day-2026-12-02',
    ])
    expect(mocked.fetchBackzettelDay).not.toHaveBeenCalledWith('2026-11-30')
    expect(within(list).getByText('heute')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Die kommenden Produktionstage (Di–So). Montag ist Ruhetag.'
      )
    ).toBeInTheDocument()
  })

  it('verlinkt die Grundmengen nur für Rollen, die sie öffnen dürfen (Z4)', async () => {
    const { unmount } = render(
      <WithSession value={fakeSession({ role: 'backstube' })}>
        <BackzettelOverviewClient today={TODAY} />
      </WithSession>
    )
    expect(
      await screen.findByRole('link', { name: 'Grundmengen' })
    ).toHaveAttribute('href', '/admin/backzettel/grundmengen')
    unmount()
    render(
      <WithSession value={fakeSession({ role: 'verkauf' })}>
        <BackzettelOverviewClient today={TODAY} />
      </WithSession>
    )
    await screen.findByTestId('day-list')
    expect(
      screen.queryByRole('link', { name: 'Grundmengen' })
    ).not.toBeInTheDocument()
  })

  it('Untertitel folgt config.days', async () => {
    mocked.fetchBackzettelConfig.mockResolvedValue({
      ...CONFIG_RESPONSE,
      config: { ...TEST_CONFIG, days: [3, 4, 5, 6] },
    })
    render(<BackzettelOverviewClient today={TODAY} />)
    expect(
      await screen.findByText(
        'Die kommenden Produktionstage (Mi–Sa). Montag, Dienstag und Sonntag sind Ruhetage.'
      )
    ).toBeInTheDocument()
  })

  it('stellt den nächsten Produktionstag vorn heraus, mit Status und Nachträgen', async () => {
    mocked.fetchBackzettelDay.mockImplementation(async (date: string) =>
      date === '2026-11-27'
        ? saturdayConfirmed({ date })
        : saturdayDraft({ date, warnings: [] })
    )
    render(<BackzettelOverviewClient today={TODAY} />)
    const next = within(await screen.findByTestId('next-day'))
    expect(next.getByText('Freitag, 27.11.2026')).toBeInTheDocument()
    expect(await next.findByText('Freigegeben')).toBeInTheDocument()
    expect(next.getByText('1 Nachtrag offen')).toBeInTheDocument()
    expect(next.getByRole('link', { name: /Öffnen/ })).toHaveAttribute(
      'href',
      '/admin/backzettel/2026-11-27'
    )
    const sat = within(screen.getByTestId('day-2026-11-28'))
    expect(await sat.findByText('Entwurf')).toBeInTheDocument()
    expect(sat.getByText('Vorbestellungen in 1 Zeile')).toBeInTheDocument()
    expect(sat.getByText('Hefeteig')).toBeInTheDocument()
  })

  it('ohne Stammdaten: Hinweis und Tage als „Keine Stammdaten"', async () => {
    mocked.fetchBackzettelConfig.mockResolvedValue({
      ...CONFIG_RESPONSE,
      status: 'no-config',
      config: null,
      errors: [
        { path: '', message: 'Die Backzettel-Stammdaten fehlen in hq.' },
      ],
    })
    mocked.fetchBackzettelDay.mockImplementation(async (date: string) => ({
      date,
      status: 'no-config',
      reasons: [],
    }))
    render(<BackzettelOverviewClient today={TODAY} />)
    expect(await screen.findByTestId('no-config')).toHaveTextContent(
      'Die Backzettel-Stammdaten fehlen in hq.'
    )
    const list = await screen.findByTestId('day-list')
    expect(await within(list).findAllByText('Keine Stammdaten')).toHaveLength(6)
  })

  it('ein Fehler an einem Tag lässt die anderen stehen', async () => {
    mocked.fetchBackzettelDay.mockImplementation(async (date: string) => {
      if (date === '2026-11-29') throw new Error('Keine Verbindung zum Server')
      return saturdayDraft({ date, warnings: [] })
    })
    render(<BackzettelOverviewClient today={TODAY} />)
    const sun = within(await screen.findByTestId('day-2026-11-29'))
    expect(
      await sun.findByText('Keine Verbindung zum Server')
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('day-2026-11-28')).getByText('Entwurf')
    ).toBeInTheDocument()
  })
})
