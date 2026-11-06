import React from 'react'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import BackstubeClient from './BackstubeClient'
import { fakeSession, WithSession } from '../../lib/testing/fakeSession'
import type { SessionContextValue } from '../../lib/session'
import * as api from '../../lib/backzettelApi'
import { formatTimestamp } from '../../lib/backzettelFormat'
import {
  CONFIG_RESPONSE,
  SAT,
  TUE,
  saturdayConfirmed,
  saturdayDraft,
} from '../../lib/backzettelFixtures'
import type { PilotRole } from '../../lib/roles'

jest.mock('../../lib/backzettelApi', () => {
  const actual = jest.requireActual('../../lib/backzettelApi')
  return {
    ...actual,
    fetchBackzettelConfig: jest.fn(),
    fetchBackzettelDay: jest.fn(),
    fetchPrep: jest.fn(),
    setLineDone: jest.fn(),
    acknowledgeDelta: jest.fn(),
  }
})
const mocked = api as jest.Mocked<typeof api>

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => '/backstube',
}))

/** Ortszeit; Samstag 28.11.2026 03:00 = Backschicht läuft. */
function at(date: string, hour: number): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0)
}

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

function renderTablet(
  options: {
    role?: PilotRole
    now?: Date
    session?: SessionContextValue
  } = {}
) {
  const now = options.now ?? at(SAT, 3)
  const session =
    options.session ??
    fakeSession({ role: options.role ?? 'backstube', sessionKind: 'station' })
  return render(
    <WithSession value={session}>
      <BackstubeClient clock={() => now} />
    </WithSession>
  )
}

const WECK = 'test-weck|'
const ZOPF_NUSS = 'test-zopf|nuss'

describe('Backstube-Tablet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchBackzettelConfig.mockResolvedValue(CONFIG_RESPONSE)
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayConfirmed())
    mocked.fetchPrep.mockResolvedValue({
      date: '2026-11-29',
      weekday: 7,
      weekdayName: 'Sonntag',
      status: 'draft',
      prepDate: SAT,
      prepDateProvisional: false,
      prep: [
        { id: 'sauerteig', name: 'Testsauerteig', variant: 'misch' },
        { id: 'bruehstueck', name: 'Testbrühstück', variant: null },
      ],
      configStatus: 'ok',
    })
  })

  it('zeigt vor 12 Uhr den laufenden Backtag, Samstag mit Hefeteig zuerst', async () => {
    renderTablet()
    expect(await screen.findByTestId('bs-hefeteig')).toBeInTheDocument()
    expect(mocked.fetchBackzettelDay).toHaveBeenCalledWith(SAT)
    expect(screen.getByTestId('bs-date')).toHaveTextContent(
      'Samstag, 28.11.2026'
    )
    expect(screen.getByTestId('bs-choice-heute')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    const order = Array.from(
      document.querySelectorAll(
        '[data-testid^="bs-hefeteig"], [data-testid^="bs-section-"]'
      )
    ).map((el) => el.getAttribute('data-testid'))
    expect(order).toEqual([
      'bs-hefeteig',
      'bs-section-brot',
      'bs-section-broetchen',
      'bs-section-hefeteig',
    ])
    const hefeteig = within(screen.getByTestId('bs-hefeteig'))
    expect(hefeteig.getByText('6 × 500 g')).toBeInTheDocument()
    expect(hefeteig.getByText('3 kg')).toBeInTheDocument()
    expect(hefeteig.getByText('2,4 kg')).toBeInTheDocument()
    // Gesamt groß, Liter mit Einheit, Zusammensetzung klein
    expect(screen.getByTestId(`bs-total-${WECK}`)).toHaveTextContent('65')
    expect(screen.getByTestId('bs-total-test-kornbrot|')).toHaveTextContent(
      '2,25 l'
    )
    expect(screen.getByTestId(`bs-line-${WECK}`)).toHaveTextContent(
      'Basis 60 · CAP 10 · Korr. −5 (Testgrund)'
    )
    expect(screen.getByTestId('bs-progress')).toHaveTextContent(
      '0 von 4 erledigt'
    )
  })

  it('zeigt an anderen Tagen Hefeteig erst nach den Zeilen', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(
      saturdayConfirmed({ date: TUE, weekday: 2, weekdayName: 'Dienstag' })
    )
    renderTablet({ now: at(TUE, 4) })
    expect(await screen.findByTestId('bs-hefeteig')).toBeInTheDocument()
    const order = Array.from(
      document.querySelectorAll(
        '[data-testid^="bs-hefeteig"], [data-testid^="bs-section-"]'
      )
    ).map((el) => el.getAttribute('data-testid'))
    expect(order[order.length - 1]).toBe('bs-hefeteig')
  })

  it('ab 12 Uhr den nächsten Backtag; Heute/Morgen schaltet um', async () => {
    mocked.fetchBackzettelDay.mockImplementation(async (date) =>
      date === SAT
        ? saturdayConfirmed()
        : saturdayConfirmed({ date, weekday: 5, weekdayName: 'Freitag' })
    )
    renderTablet({ now: at('2026-11-27', 15) })
    await screen.findByTestId('bs-progress')
    expect(mocked.fetchBackzettelDay).toHaveBeenLastCalledWith(SAT)
    expect(screen.getByTestId('bs-choice-morgen')).toHaveTextContent('Morgen')
    expect(screen.getByTestId('bs-choice-morgen')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    fireEvent.click(screen.getByTestId('bs-choice-heute'))
    await waitFor(() =>
      expect(screen.getByTestId('bs-date')).toHaveTextContent(
        'Freitag, 27.11.2026'
      )
    )
    expect(mocked.fetchBackzettelDay).toHaveBeenLastCalledWith('2026-11-27')
  })

  it('Entwurf: Banner „Noch nicht freigegeben", Zahlen da, kein Haken', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayDraft())
    renderTablet()
    expect(await screen.findByTestId('bs-draft-banner')).toHaveTextContent(
      'Noch nicht freigegeben'
    )
    expect(screen.getByTestId(`bs-total-${WECK}`)).toHaveTextContent('65')
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByTestId('bs-progress')).not.toBeInTheDocument()
  })

  it('hakt sofort ab und behält den Haken vom Server', async () => {
    const pending = deferred<api.LineDoneResult>()
    mocked.setLineDone.mockReturnValue(pending.promise)
    renderTablet()
    const tick = await screen.findByRole('checkbox', {
      name: 'Testweck abhaken',
    })
    fireEvent.click(tick)
    // optimistisch: sofort gesetzt, Fortschritt zählt mit
    expect(screen.getByTestId(`bs-tick-${WECK}`)).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByTestId('bs-progress')).toHaveTextContent(
      '1 von 4 erledigt'
    )
    const weckId = mocked.setLineDone.mock.calls[0][1]
    expect(mocked.setLineDone).toHaveBeenCalledWith(SAT, weckId, true)

    await act(async () => {
      pending.resolve({
        id: weckId,
        date: SAT,
        itemId: 'test-weck',
        variant: null,
        doneAt: '2026-11-28T03:10:00.000Z',
        doneBy: { id: 3, displayName: 'Test Bäcker' },
      })
    })
    expect(screen.getByTestId(`bs-line-${WECK}`)).toHaveTextContent(
      'Test Bäcker'
    )
    expect(screen.getByTestId(`bs-line-${WECK}`)).toHaveAttribute(
      'data-done',
      'true'
    )
  })

  it('nimmt den Haken zurück, wenn der Server ablehnt', async () => {
    mocked.setLineDone.mockRejectedValue(new TypeError('Failed to fetch'))
    renderTablet()
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Testweck abhaken' })
    )
    expect(
      await screen.findByText(
        'Nicht gespeichert: Keine Verbindung zum Server – bitte WLAN prüfen.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()
    expect(screen.getByTestId(`bs-tick-${WECK}`)).toHaveAttribute(
      'aria-checked',
      'false'
    )
    expect(screen.getByTestId('bs-progress')).toHaveTextContent(
      '0 von 4 erledigt'
    )
  })

  it('zeigt nach erneuter Freigabe, was schon gebacken war (W4-verify r2)', async () => {
    const confirmed = saturdayConfirmed()
    const weck = confirmed.sections[1].lines[0]
    weck.previouslyDone = {
      qty: weck.total - 8,
      at: '2026-11-28T03:00:00.000Z',
      by: { id: 3, displayName: 'Test Bäcker' },
    }
    mocked.fetchBackzettelDay.mockResolvedValue(confirmed)
    renderTablet()
    const hint = await screen.findByTestId(`bs-previously-done-${WECK}`)
    expect(hint).toHaveTextContent(
      `bereits ${weck.total - 8} erledigt (${formatTimestamp(
        '2026-11-28T03:00:00.000Z'
      )} · Test Bäcker) - noch +8`
    )
    expect(screen.getByTestId(`bs-tick-${WECK}`)).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('Haken entfernen schickt undone', async () => {
    const confirmed = saturdayConfirmed()
    const weck = confirmed.sections[1].lines[0]
    weck.doneAt = '2026-11-28T03:00:00.000Z'
    weck.doneBy = { id: 3, displayName: 'Test Bäcker' }
    mocked.fetchBackzettelDay.mockResolvedValue(confirmed)
    mocked.setLineDone.mockResolvedValue({
      id: weck.id as number,
      date: SAT,
      itemId: 'test-weck',
      variant: null,
      doneAt: null,
      doneBy: null,
    })
    renderTablet()
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Testweck erledigt' })
    )
    await waitFor(() =>
      expect(mocked.setLineDone).toHaveBeenCalledWith(SAT, weck.id, false)
    )
    await waitFor(() =>
      expect(screen.getByTestId(`bs-tick-${WECK}`)).toHaveAttribute(
        'aria-checked',
        'false'
      )
    )
  })

  it('wurde der Tag inzwischen wieder geöffnet, lädt er neu', async () => {
    mocked.setLineDone.mockRejectedValue(
      apiError(409, 'not_confirmed', 'Der Backzettel ist nicht freigegeben.')
    )
    renderTablet()
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Testweck abhaken' })
    )
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayDraft())
    expect(await screen.findByTestId('bs-draft-banner')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Der Backzettel ist nicht freigegeben. Der Backzettel wird neu geladen.'
      )
    ).toBeInTheDocument()
  })

  it('die Meldung verschwindet, sobald ein Neuladen den Tag wieder freigegeben zeigt (W4-verify r2)', async () => {
    mocked.setLineDone.mockRejectedValue(
      apiError(409, 'not_confirmed', 'Der Backzettel ist nicht freigegeben.')
    )
    renderTablet()
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Testweck abhaken' })
    )
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayDraft())
    expect(await screen.findByTestId('bs-draft-banner')).toBeInTheDocument()
    const text =
      'Der Backzettel ist nicht freigegeben. Der Backzettel wird neu geladen.'
    expect(screen.getByText(text)).toBeInTheDocument()
    // wieder freigegeben: das nächste Neuladen (60 s / Zurückkommen)
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayConfirmed())
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() =>
      expect(screen.queryByTestId('bs-draft-banner')).not.toBeInTheDocument()
    )
    expect(screen.queryByText(text)).not.toBeInTheDocument()
  })

  it('ein Neuladen während des Abhakens überschreibt den Haken nicht', async () => {
    const pending = deferred<api.LineDoneResult>()
    mocked.setLineDone.mockReturnValue(pending.promise)
    renderTablet()
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Testweck abhaken' })
    )
    const calls = mocked.fetchBackzettelDay.mock.calls.length
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(mocked.fetchBackzettelDay.mock.calls.length).toBe(calls + 1)
    // Die Antwort (noch ohne Haken) darf die Anzeige nicht zurückdrehen.
    expect(screen.getByTestId(`bs-tick-${WECK}`)).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await act(async () => {
      pending.resolve({
        id: 1,
        date: SAT,
        itemId: 'test-weck',
        variant: null,
        doneAt: '2026-11-28T03:10:00.000Z',
        doneBy: { id: 3, displayName: 'Test Bäcker' },
      })
    })
    expect(screen.getByTestId(`bs-tick-${WECK}`)).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  it('Nachtrag: Badge an der Zeile und „Gesehen" quittiert', async () => {
    mocked.acknowledgeDelta.mockResolvedValue({
      ...saturdayConfirmed().deltas[0],
      acknowledgedAt: '2026-11-28T03:05:00.000Z',
      acknowledgedBy: { id: 3, displayName: 'Test Bäcker' },
    })
    renderTablet()
    const card = await screen.findByTestId('bs-deltas')
    expect(card).toHaveTextContent('1 Nachtrag seit der Freigabe')
    expect(card).toHaveTextContent('LA-2026-11-28-03')
    expect(card).toHaveTextContent('1 bereits gesehen')
    const badge = screen.getByTestId(`bs-delta-badge-${ZOPF_NUSS}`)
    expect(badge).toHaveTextContent('Nachtrag +2')
    expect(badge).toHaveAttribute('data-open', 'true')

    fireEvent.click(
      within(card).getByRole('button', {
        name: 'Nachtrag Testzopf gefüllt – Testnussfüllung gesehen',
      })
    )
    await waitFor(() =>
      expect(screen.queryByTestId('bs-deltas')).not.toBeInTheDocument()
    )
    expect(mocked.acknowledgeDelta).toHaveBeenCalledWith(SAT, 7)
    expect(screen.getByTestId(`bs-delta-badge-${ZOPF_NUSS}`)).toHaveAttribute(
      'data-open',
      'false'
    )
  })

  it('Nachträge: Hinweis auf zusätzlichen Teig und Füllung, Viertel als ganze Backmenge (W4-Verifikation)', async () => {
    const base = saturdayConfirmed()
    mocked.fetchBackzettelDay.mockResolvedValue({
      ...base,
      sections: base.sections.map((s) => ({
        ...s,
        lines: s.lines.map((l) =>
          l.key === ZOPF_NUSS
            ? { ...l, delta: { qty: 0.25, open: 1, count: 1, bake: 1 } }
            : l
        ),
      })),
      deltaExtras: {
        doughs: [
          {
            id: 'hefeteig-test',
            name: 'Testhefeteig',
            pieces: 1,
            totalPieces: 9,
            dough_g: 500,
            totalDough_g: 4500,
            batches: 1,
            weighing: [{ piece_g: 500, pieces: 1, total: 9 }],
          },
        ],
        fillings: [
          {
            id: 'nuss',
            name: 'Testnussfüllung',
            grams: 400,
            totalGrams: 2000,
          },
        ],
      },
    })
    renderTablet()
    const badge = await screen.findByTestId(`bs-delta-badge-${ZOPF_NUSS}`)
    expect(badge).toHaveTextContent('Nachtrag +0,25 · 1 mehr backen')
    const extras = screen.getByTestId('delta-extras')
    expect(extras).toHaveTextContent('Nachträge seit der Freigabe')
    expect(extras).toHaveTextContent('+1 × 500 g abwiegen')
    expect(extras).toHaveTextContent('Testnussfüllung: +400 g')
  })

  it('lädt alle 60 s und beim Zurückkommen neu', async () => {
    jest.useFakeTimers()
    try {
      renderTablet()
      await screen.findByTestId('bs-progress')
      const calls = mocked.fetchBackzettelDay.mock.calls.length
      await act(async () => {
        jest.advanceTimersByTime(60 * 1000)
      })
      expect(mocked.fetchBackzettelDay.mock.calls.length).toBe(calls + 1)
      await act(async () => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(mocked.fetchBackzettelDay.mock.calls.length).toBe(calls + 2)
    } finally {
      jest.useRealTimers()
    }
  })

  it('holt die Stammdaten nach, wenn der erste Abruf scheiterte (W4-Verifikation)', async () => {
    jest.useFakeTimers()
    try {
      mocked.fetchBackzettelConfig
        .mockReset()
        .mockRejectedValueOnce(new Error('Netzwerkfehler'))
        .mockResolvedValue(CONFIG_RESPONSE)
      renderTablet()
      await screen.findByTestId('bs-progress')
      expect(mocked.fetchBackzettelConfig).toHaveBeenCalledTimes(1)
      await act(async () => {
        jest.advanceTimersByTime(60 * 1000)
      })
      expect(mocked.fetchBackzettelConfig).toHaveBeenCalledTimes(2)
      // Einmal geladen, wird nicht bei jedem Lauf erneut gefragt.
      await act(async () => {
        jest.advanceTimersByTime(60 * 1000)
      })
      expect(mocked.fetchBackzettelConfig).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  it('noch nicht erfasste Nachträge: Hinweis und Nachladen nach 5 s (W4)', async () => {
    jest.useFakeTimers()
    try {
      mocked.fetchBackzettelDay
        .mockResolvedValueOnce(saturdayConfirmed({ deltasPending: true }))
        .mockResolvedValue(saturdayConfirmed({ deltasPending: false }))
      renderTablet()
      expect(await screen.findByTestId('bs-deltas-pending')).toHaveTextContent(
        'gerade übernommen'
      )
      const calls = mocked.fetchBackzettelDay.mock.calls.length
      await act(async () => {
        jest.advanceTimersByTime(api.DELTAS_PENDING_RELOAD_MS)
      })
      expect(mocked.fetchBackzettelDay.mock.calls.length).toBe(calls + 1)
      await waitFor(() =>
        expect(
          screen.queryByTestId('bs-deltas-pending')
        ).not.toBeInTheDocument()
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('freigegeben ohne Stammdaten: sagt, dass Nachträge fehlen können', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(
      saturdayConfirmed({
        configStatus: 'no-config',
        configChangedSinceConfirm: null,
        deltasPending: null,
      })
    )
    renderTablet()
    expect(
      await screen.findByTestId('bs-confirmed-no-config')
    ).toHaveTextContent('nicht als Nachtrag')
    expect(screen.queryByTestId('bs-deltas-pending')).not.toBeInTheDocument()
  })

  it('behält den Zettel, wenn ein Neuladen scheitert', async () => {
    renderTablet()
    await screen.findByTestId('bs-progress')
    mocked.fetchBackzettelDay.mockRejectedValueOnce(
      new TypeError('Failed to fetch')
    )
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(
      await screen.findByText(/Keine Verbindung zum Server – bitte WLAN prüfen/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()
    expect(screen.getByTestId(`bs-total-${WECK}`)).toHaveTextContent('65')
  })

  it('Proxy-Fehler und Serverfehler erscheinen deutsch, nie als HTTP-Text', async () => {
    renderTablet()
    await screen.findByTestId('bs-progress')
    mocked.fetchBackzettelDay.mockRejectedValueOnce(
      Object.assign(new Error('HTTP 502: Bad Gateway'), { status: 502 })
    )
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(
      await screen.findByText(/Keine Verbindung zum Server – bitte WLAN prüfen/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/Bad Gateway/)).not.toBeInTheDocument()

    mocked.fetchBackzettelDay.mockRejectedValueOnce(
      apiError(403, 'forbidden', 'Keine Berechtigung für diese Aktion.')
    )
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(
      await screen.findByText(
        /Neu laden fehlgeschlagen: Keine Berechtigung für diese Aktion\./
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/Keine Verbindung/)).not.toBeInTheDocument()
  })

  describe('folgt der Tagesregel wieder, wenn sie umspringt', () => {
    function renderWithClock(start: Date) {
      const clock = { now: start }
      render(
        <WithSession
          value={fakeSession({ role: 'backstube', sessionKind: 'station' })}
        >
          <BackstubeClient clock={() => clock.now} />
        </WithSession>
      )
      return clock
    }

    async function nextMinute() {
      await act(async () => {
        jest.advanceTimersByTime(60 * 1000)
      })
    }

    beforeEach(() => {
      mocked.fetchBackzettelDay.mockImplementation(async (date) =>
        date === '2026-11-30'
          ? { date, status: 'ruhetag', weekday: null, message: 'Ruhetag' }
          : saturdayConfirmed({ date })
      )
    })

    it('12 Uhr: eine Wahl „Heute" vom Vormittag weicht dem nächsten Backtag', async () => {
      jest.useFakeTimers()
      try {
        const clock = renderWithClock(at('2026-11-27', 11))
        await screen.findByTestId('bs-progress')
        expect(screen.getByTestId('bs-date')).toHaveTextContent('27.11.2026')
        fireEvent.click(screen.getByTestId('bs-choice-morgen'))
        fireEvent.click(screen.getByTestId('bs-choice-heute'))
        await waitFor(() =>
          expect(screen.getByTestId('bs-date')).toHaveTextContent('27.11.2026')
        )

        clock.now = new Date(2026, 10, 27, 12, 1)
        await nextMinute()
        await waitFor(() =>
          expect(screen.getByTestId('bs-date')).toHaveTextContent(
            'Samstag, 28.11.2026'
          )
        )
        expect(screen.getByTestId('bs-choice-morgen')).toHaveAttribute(
          'aria-pressed',
          'true'
        )
        expect(mocked.fetchBackzettelDay).toHaveBeenLastCalledWith(SAT)
      } finally {
        jest.useRealTimers()
      }
    })

    it('Mitternacht: „Heute" vom Sonntag zeigt am Montag nicht den Ruhetag', async () => {
      jest.useFakeTimers()
      try {
        const clock = renderWithClock(at('2026-11-29', 15))
        await screen.findByTestId('bs-progress')
        fireEvent.click(screen.getByTestId('bs-choice-heute'))
        await waitFor(() =>
          expect(screen.getByTestId('bs-date')).toHaveTextContent('29.11.2026')
        )

        clock.now = new Date(2026, 10, 30, 0, 30)
        await nextMinute()
        await waitFor(() =>
          expect(screen.getByTestId('bs-date')).toHaveTextContent('01.12.2026')
        )
        expect(screen.queryByTestId('bs-ruhetag')).not.toBeInTheDocument()
        expect(mocked.fetchBackzettelDay).not.toHaveBeenCalledWith('2026-11-30')
      } finally {
        jest.useRealTimers()
      }
    })
  })

  it('Vorbereitung heute: für den nächsten Backtag', async () => {
    renderTablet()
    await screen.findByTestId('bs-progress')
    fireEvent.click(screen.getByRole('tab', { name: 'Vorbereitung heute' }))
    const prep = await screen.findByTestId('bs-prep')
    expect(mocked.fetchPrep).toHaveBeenCalledWith('2026-11-29')
    // gilt immer dem nächsten Backtag: kein Heute/Morgen, Kopf = heute
    expect(screen.queryByTestId('bs-choice-heute')).not.toBeInTheDocument()
    expect(screen.getByTestId('bs-date')).toHaveTextContent(
      'Heute, Samstag, 28.11.2026'
    )
    expect(prep).toHaveTextContent('Für Sonntag, 29.11.2026')
    expect(prep).toHaveTextContent('Heute ab 14 Uhr vorbereiten.')
    expect(prep).toHaveTextContent('Testsauerteig (Misch)')
    expect(prep).toHaveTextContent('Testbrühstück')
    expect(prep).toHaveTextContent('noch nicht freigegeben')
  })

  it('Vorbereitung am Sonntag für Dienstag: Vortag ist Ruhetag', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue({
      date: '2026-11-30',
      status: 'ruhetag',
      weekday: null,
      message: 'Ruhetag',
    })
    mocked.fetchPrep.mockResolvedValue({
      date: '2026-12-01',
      weekday: 2,
      weekdayName: 'Dienstag',
      status: 'confirmed',
      prepDate: '2026-11-30',
      prepDateProvisional: true,
      prep: [],
      configStatus: 'ok',
    })
    renderTablet({ now: at('2026-11-29', 15) })
    await waitFor(() => expect(mocked.fetchBackzettelDay).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('tab', { name: 'Vorbereitung heute' }))
    const prep = await screen.findByTestId('bs-prep')
    expect(mocked.fetchPrep).toHaveBeenCalledWith('2026-12-01')
    expect(prep).toHaveTextContent('Vorzubereiten am Montag, 30.11.2026.')
    expect(screen.getByTestId('bs-prep-provisional')).toBeInTheDocument()
    expect(prep).toHaveTextContent('Keine Vorbereitung eingetragen.')
  })

  it('Ruhetag und fehlende Stammdaten ohne Zahlen', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue({
      date: '2026-11-30',
      status: 'ruhetag',
      weekday: null,
      message: 'Ruhetag',
    })
    const { unmount } = renderTablet({ now: at('2026-11-30', 8) })
    fireEvent.click(await screen.findByTestId('bs-choice-heute'))
    expect(await screen.findByTestId('bs-ruhetag')).toHaveTextContent('Ruhetag')
    unmount()

    mocked.fetchBackzettelDay.mockResolvedValue({
      date: SAT,
      status: 'no-config',
      reasons: [{ message: 'Datei fehlt' }],
    })
    renderTablet()
    expect(await screen.findByTestId('bs-no-config')).toHaveTextContent(
      'Stammdaten'
    )
    expect(screen.queryByTestId(/^bs-total-/)).not.toBeInTheDocument()
  })

  it('hat ein eigenes Abmelden und führt zur Station zurück', async () => {
    const session = fakeSession({
      role: 'backstube',
      sessionKind: 'station',
      logout: jest.fn(async () => '/station'),
    })
    renderTablet({ session })
    await screen.findByTestId('bs-progress')
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/station'))
    expect(session.logout).toHaveBeenCalled()
  })

  it('Backstube sieht den Weg zur Planung, ohne Haken-Rechte kein Haken', async () => {
    renderTablet()
    await screen.findByTestId('bs-progress')
    expect(
      screen.getByRole('link', { name: 'Planung & Druck' })
    ).toHaveAttribute('href', `/admin/backzettel/${SAT}`)
  })

  it('„Zur Verwaltung" nur mit persönlicher Sitzung, nicht an der Station', async () => {
    const { unmount } = renderTablet()
    await screen.findByTestId('bs-progress')
    expect(
      screen.queryByRole('link', { name: 'Zur Verwaltung' })
    ).not.toBeInTheDocument()
    unmount()

    renderTablet({
      session: fakeSession({ role: 'inhaber', sessionKind: 'personal' }),
    })
    await screen.findByTestId('bs-progress')
    expect(
      screen.getByRole('link', { name: 'Zur Verwaltung' })
    ).toHaveAttribute('href', '/admin')
  })

  it('Verkauf (nur lesen) bekommt weder Haken noch „Gesehen"', async () => {
    renderTablet({ role: 'verkauf' })
    await screen.findByTestId('bs-progress')
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(
      within(screen.getByTestId('bs-deltas')).queryByRole('button')
    ).not.toBeInTheDocument()
  })
})
