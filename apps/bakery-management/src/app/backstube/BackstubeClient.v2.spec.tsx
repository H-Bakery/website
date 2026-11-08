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
    setLineBaked: jest.fn(),
    setDeltasBaked: jest.fn(),
  }
})
const mocked = api as jest.Mocked<typeof api>

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/backstube',
}))

function apiError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { status, code })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

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

  it('kein Teigtag, aber Teig für heute (lead 0): kein „Heute kein Teig“', async () => {
    const korn = saturdayV2Confirmed().machine?.find((m) =>
      m.doughIds.includes('test-korn-teig')
    )
    expect(korn).toBeDefined()
    mocked.fetchBackzettelDay.mockImplementation(async (date: string) =>
      date === SUN
        ? sundayV2Sheet({ machine: korn ? [korn] : [], doughs: [] })
        : emptySheet(date, 2, 'Dienstag')
    )
    renderTablet(at(SUN, 3))
    await screen.findByTestId('bs-bake-list')
    fireEvent.click(screen.getByRole('tab', { name: 'Zettel' }))
    const today = await screen.findByTestId('bs-doughs-today')
    expect(today).toHaveTextContent('Teige heute: Korn + Holz')
    expect(today).not.toHaveTextContent('Heute kein Teig')
  })

  it('kein Teigtag ohne Teig: „Heute kein Teig“', async () => {
    renderTablet(at(SUN, 3))
    await screen.findByTestId('bs-bake-list')
    fireEvent.click(screen.getByRole('tab', { name: 'Zettel' }))
    expect(await screen.findByTestId('bs-doughs-today')).toHaveTextContent(
      'Heute kein Teig'
    )
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

  describe('Backen: gebacken-Haken (O5)', () => {
    const DOPPEL = `test-doppel|@${V2_TUE}`

    it('setzt den Haken sofort und schickt ihn an die Backliste des Backtags', async () => {
      const pending = deferred<api.LineBakedResult>()
      mocked.setLineBaked.mockReturnValue(pending.promise)
      renderTablet(at(V2_TUE, 3))
      const tick = await screen.findByRole('checkbox', {
        name: 'Testdoppel als gebacken abhaken',
      })
      fireEvent.click(tick)
      // optimistisch: schon gesetzt, solange der Server antwortet
      expect(screen.getByTestId(`bs-bake-tick-${DOPPEL}`)).toHaveAttribute(
        'aria-checked',
        'true'
      )
      expect(screen.getByTestId(`bs-bake-tick-${DOPPEL}`)).toBeDisabled()
      expect(mocked.setLineBaked).toHaveBeenCalledWith(V2_TUE, 205, true, 44)
      expect(mocked.setLineDone).not.toHaveBeenCalled()
      pending.resolve({
        id: 205,
        date: SAT,
        bakeDate: V2_TUE,
        itemId: 'test-doppel',
        variant: null,
        bakedAt: '2026-12-01T04:00:00.000Z',
        bakedBy: { id: 2, displayName: 'Test Backstube' },
      })
      await waitFor(() =>
        expect(screen.getByTestId(`bs-bake-baked-${DOPPEL}`)).toHaveTextContent(
          'Test Backstube'
        )
      )
      expect(screen.getByTestId(`bs-bake-tick-${DOPPEL}`)).toHaveAttribute(
        'aria-checked',
        'true'
      )
    })

    it('nimmt den Haken zurück, wenn der Server ablehnt', async () => {
      mocked.setLineBaked.mockRejectedValue(new TypeError('Failed to fetch'))
      renderTablet(at(V2_TUE, 3))
      fireEvent.click(
        await screen.findByRole('checkbox', {
          name: 'Testdoppel als gebacken abhaken',
        })
      )
      expect(
        await screen.findByText(
          'Nicht gespeichert: Keine Verbindung zum Server – bitte WLAN prüfen.'
        )
      ).toBeInTheDocument()
      expect(screen.getByTestId(`bs-bake-tick-${DOPPEL}`)).toHaveAttribute(
        'aria-checked',
        'false'
      )
    })

    it('Zettel wieder geöffnet (409): zurückgenommen, Backliste neu geladen', async () => {
      mocked.setLineBaked.mockRejectedValue(
        apiError(
          409,
          'not_confirmed',
          'Abhaken geht erst, wenn der Backzettel vom Samstag, 28.11. freigegeben ist.'
        )
      )
      renderTablet(at(V2_TUE, 3))
      fireEvent.click(
        await screen.findByRole('checkbox', {
          name: 'Testdoppel als gebacken abhaken',
        })
      )
      expect(
        await screen.findByText(
          'Abhaken geht erst, wenn der Backzettel vom Samstag, 28.11. freigegeben ist. Die Backliste wird neu geladen.'
        )
      ).toBeInTheDocument()
      await waitFor(() => expect(mocked.fetchBakeList).toHaveBeenCalledTimes(2))
      expect(screen.getByTestId(`bs-bake-tick-${DOPPEL}`)).toHaveAttribute(
        'aria-checked',
        'false'
      )
    })

    it('ein vorhandener Haken wird mit „unbaked“ zurückgenommen', async () => {
      const base = tuesdayBakeList()
      mocked.fetchBakeList.mockResolvedValue({
        ...base,
        sections: base.sections.map((sec) => ({
          ...sec,
          lines: sec.lines.map((l) =>
            l.key === DOPPEL
              ? { ...l, bakedAt: '2026-12-01T04:00:00.000Z', bakedBy: null }
              : l
          ),
        })),
      })
      mocked.setLineBaked.mockResolvedValue({
        id: 205,
        date: SAT,
        bakeDate: V2_TUE,
        itemId: 'test-doppel',
        variant: null,
        bakedAt: null,
        bakedBy: null,
      })
      renderTablet(at(V2_TUE, 3))
      fireEvent.click(
        await screen.findByRole('checkbox', { name: 'Testdoppel gebacken' })
      )
      await waitFor(() =>
        expect(mocked.setLineBaked).toHaveBeenCalledWith(V2_TUE, 205, false, 44)
      )
      await waitFor(() =>
        expect(screen.getByTestId(`bs-bake-tick-${DOPPEL}`)).toHaveAttribute(
          'aria-checked',
          'false'
        )
      )
    })

    it('Nachtrag: eigener Haken, quittiert mit, danach neu geladen', async () => {
      const pending = deferred<api.BackzettelDeltaEntry[]>()
      mocked.setDeltasBaked.mockReturnValue(pending.promise)
      renderTablet(at(V2_TUE, 3))
      fireEvent.click(
        await screen.findByRole('checkbox', {
          name: 'Nachtrag Testdoppel als gebacken abhaken',
        })
      )
      expect(mocked.setDeltasBaked).toHaveBeenCalledWith(V2_TUE, [31], true)
      // optimistisch gebacken und gesehen: die Gesehen-Karte oben ist weg
      expect(screen.getByTestId(`bs-bake-dtick-${DOPPEL}`)).toHaveAttribute(
        'aria-checked',
        'true'
      )
      expect(screen.queryByTestId('bs-deltas')).not.toBeInTheDocument()
      pending.resolve([
        {
          ...tuesdayBakeList().deltas[0],
          acknowledgedAt: '2026-12-01T04:00:00.000Z',
          bakedAt: '2026-12-01T04:00:00.000Z',
          bakedBy: { id: 2, displayName: 'Test Backstube' },
        },
      ])
      await waitFor(() => expect(mocked.fetchBakeList).toHaveBeenCalledTimes(2))
    })

    it('Nachtrag: Fehler nimmt Haken und „Gesehen“ zurück', async () => {
      mocked.setDeltasBaked.mockRejectedValue(
        apiError(500, 'internal', 'Serverfehler.')
      )
      renderTablet(at(V2_TUE, 3))
      fireEvent.click(
        await screen.findByRole('checkbox', {
          name: 'Nachtrag Testdoppel als gebacken abhaken',
        })
      )
      expect(
        await screen.findByText(/^Nicht gespeichert: /)
      ).toBeInTheDocument()
      expect(screen.getByTestId(`bs-bake-dtick-${DOPPEL}`)).toHaveAttribute(
        'aria-checked',
        'false'
      )
      expect(screen.getByTestId('bs-deltas')).toBeInTheDocument()
    })

    it('Verkauf sieht die Backliste ohne Haken', async () => {
      render(
        <WithSession
          value={fakeSession({ role: 'verkauf', sessionKind: 'station' })}
        >
          <BackstubeClient clock={() => at(V2_TUE, 3)} />
        </WithSession>
      )
      await screen.findByTestId('bs-bake-list')
      expect(screen.queryByTestId(`bs-bake-tick-${DOPPEL}`)).toBeNull()
      expect(screen.queryByTestId(`bs-bake-dtick-${DOPPEL}`)).toBeNull()
    })
  })
})
