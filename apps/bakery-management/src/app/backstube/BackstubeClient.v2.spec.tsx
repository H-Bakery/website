import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import BackstubeClient from './BackstubeClient'
import { fakeSession, WithSession } from '../../lib/testing/fakeSession'
import * as api from '../../lib/backzettelApi'
import {
  CONFIG_RESPONSE_V2,
  SAT,
  SUN,
  V2_TUE,
  saturdayV2Confirmed,
  sundayBakeList,
  sundayV2Sheet,
  tuesdayBakeList,
} from '../../lib/backzettelFixtures'

jest.mock('../../lib/backzettelApi', () => {
  const actual = jest.requireActual('../../lib/backzettelApi')
  return {
    ...actual,
    fetchBackzettelConfig: jest.fn(),
    fetchBackzettelDay: jest.fn(),
    fetchBakeList: jest.fn(),
    fetchPrep: jest.fn(),
    setLineDone: jest.fn(),
    acknowledgeDelta: jest.fn(),
    acknowledgeDeltas: jest.fn(),
  }
})
const mocked = api as jest.Mocked<typeof api>

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/backstube',
}))

function at(date: string, hour: number): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0)
}

function renderTablet(now: Date) {
  return render(
    <WithSession
      value={fakeSession({ role: 'backstube', sessionKind: 'station' })}
    >
      <BackstubeClient clock={() => now} />
    </WithSession>
  )
}

/** Ein leerer Teigtag-Zettel (kein Teigtag) für einen beliebigen Tag. */
function emptySheet(date: string, weekday: number, weekdayName: string) {
  return sundayV2Sheet({
    date,
    weekday,
    weekdayName,
    bakeDates: [{ date, weekday, weekdayName, label: 'heute', lineCount: 0 }],
  })
}

describe('Backstube-Tablet - Teigtag-Zettel und Backliste (Z10)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchBackzettelConfig.mockResolvedValue(CONFIG_RESPONSE_V2)
    mocked.fetchBackzettelDay.mockImplementation(async (date: string) => {
      if (date === SAT) return saturdayV2Confirmed()
      if (date === SUN) return sundayV2Sheet()
      return emptySheet(date, 2, 'Dienstag')
    })
    mocked.fetchBakeList.mockImplementation(async (date: string) =>
      date === SUN ? sundayBakeList() : tuesdayBakeList({ date })
    )
  })

  it('Teigtag: Zettel mit großer Maschinen-Leiste und Zeilen je Backtag', async () => {
    renderTablet(at(SAT, 3))
    const strip = within(await screen.findByTestId('machine-strip'))
    expect(
      strip.getByTestId('machine-liters-test-korn-teig')
    ).toHaveTextContent('6 L')
    expect(
      strip.getByTestId('machine-liters-test-flit-teig')
    ).toHaveTextContent('unbekannt')
    expect(screen.getByRole('tab', { name: 'Zettel' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByTestId('bs-doughs-today')).toHaveTextContent(
      'Teige heute: Korn + Holz'
    )
    const groups = screen
      .getAllByTestId(/^bs-bakeday-/)
      .map((el) => el.getAttribute('data-testid'))
    expect(groups).toEqual([
      `bs-bakeday-${SAT}`,
      `bs-bakeday-${SUN}`,
      `bs-bakeday-${V2_TUE}`,
    ])
    const sunday = within(screen.getByTestId(`bs-bakeday-${SUN}`))
    expect(sunday.getByText('Teig für Sonntag, 29.11.')).toBeInTheDocument()
    expect(screen.getByTestId(`bs-bruch-${SUN}`)).toHaveTextContent(
      'Testdoppel: 7 Bruch × 1.250 g – 66 Testdoppel · +4 frei'
    )
    // unter der Backtag-Überschrift ohne „· für …“
    expect(
      within(screen.getByTestId(`bs-line-test-doppel|@${SUN}`)).getByText(
        'Testdoppel'
      )
    ).toBeInTheDocument()
    // Nachtrag für Dienstag nennt den Backtag
    expect(screen.getByTestId('bs-deltas')).toHaveTextContent(
      'Testdoppel · für Di 01.12.'
    )
    expect(mocked.fetchBakeList).not.toHaveBeenCalled()
  })

  it('Sonntag (kein Teigtag): öffnet mit „Backen“ und zeigt Samstagsteig', async () => {
    renderTablet(at(SUN, 3))
    const list = within(await screen.findByTestId('bs-bake-list'))
    expect(mocked.fetchBakeList).toHaveBeenCalledWith(SUN)
    expect(screen.getByRole('tab', { name: 'Backen' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(list.getByTestId('bs-bake-sources')).toHaveTextContent(
      'Teig vom Samstag · Entwurf'
    )
    expect(list.getByTestId('bs-bake-draft')).toBeInTheDocument()
    expect(
      list.getByTestId(`bs-bake-total-test-doppel|@${SUN}`)
    ).toHaveTextContent('66')
    expect(
      within(list.getByTestId(`bs-bake-test-doppel|@${SUN}`)).getByText(
        /Teig vom Samstag/
      )
    ).toBeInTheDocument()
  })

  it('Backen: offene Grundmenge steht da, die Menge mit „≥“', async () => {
    const base = sundayBakeList()
    const [section] = base.sections
    mocked.fetchBakeList.mockResolvedValue({
      ...base,
      sections: [
        {
          ...section,
          lines: section.lines.map((l) =>
            l.key === `test-doppel|@${SUN}`
              ? { ...l, baseUnset: true, totalIsMinimum: true }
              : l
          ),
        },
      ],
    })
    renderTablet(at(SUN, 3))
    const list = within(await screen.findByTestId('bs-bake-list'))
    expect(
      list.getByTestId(`bs-bake-base-unset-test-doppel|@${SUN}`)
    ).toHaveTextContent('Grundmenge offen')
    expect(
      list.getByTestId(`bs-bake-total-test-doppel|@${SUN}`)
    ).toHaveTextContent('≥ 66')
  })

  it('die Reiter-Wahl gilt nur für ihren Tag', async () => {
    renderTablet(at(SUN, 3))
    await screen.findByTestId('bs-bake-list')
    fireEvent.click(screen.getByRole('tab', { name: 'Zettel' }))
    expect(screen.getByRole('tab', { name: 'Zettel' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.queryByTestId('bs-bake-list')).not.toBeInTheDocument()
    // nächster Backtag (Dienstag): wieder seine Vorgabe (leer → Backen)
    fireEvent.click(screen.getByTestId('bs-choice-morgen'))
    await waitFor(() =>
      expect(mocked.fetchBakeList).toHaveBeenCalledWith(V2_TUE)
    )
    expect(screen.getByRole('tab', { name: 'Backen' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('„Gesehen“ auf der Backliste quittiert beim Zettel des Teigtags', async () => {
    mocked.acknowledgeDelta.mockResolvedValue({
      id: 31,
      acknowledgedAt: '2026-12-01T03:00:00.000Z',
      acknowledgedBy: { id: 2, displayName: 'Test Backstube' },
    } as never)
    renderTablet(at(V2_TUE, 3))
    const list = within(await screen.findByTestId('bs-bake-list'))
    expect(
      list.getByTestId(`bs-bake-delta-test-doppel|@${V2_TUE}`)
    ).toHaveTextContent('Nachtrag +3')
    fireEvent.click(
      list.getByRole('button', { name: 'Nachtrag Testdoppel gesehen' })
    )
    await waitFor(() =>
      expect(mocked.acknowledgeDelta).toHaveBeenCalledWith(SAT, 31)
    )
    await waitFor(() => expect(mocked.fetchBakeList).toHaveBeenCalledTimes(2))
  })

  it('Fehler der Backliste: deutsche Meldung, kein „Failed to fetch“', async () => {
    mocked.fetchBakeList.mockRejectedValue(new TypeError('Failed to fetch'))
    renderTablet(at(SUN, 3))
    expect(
      await screen.findByText(
        'Keine Verbindung zum Server – bitte WLAN prüfen.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()
  })
})
