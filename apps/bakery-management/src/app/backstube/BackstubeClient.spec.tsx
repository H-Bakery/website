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
    mocked.setLineDone.mockRejectedValue(new Error('Netzwerkfehler'))
    renderTablet()
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Testweck abhaken' })
    )
    expect(
      await screen.findByText('Nicht gespeichert: Netzwerkfehler')
    ).toBeInTheDocument()
    expect(screen.getByTestId(`bs-tick-${WECK}`)).toHaveAttribute(
      'aria-checked',
      'false'
    )
    expect(screen.getByTestId('bs-progress')).toHaveTextContent(
      '0 von 4 erledigt'
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

  it('behält den Zettel, wenn ein Neuladen scheitert', async () => {
    renderTablet()
    await screen.findByTestId('bs-progress')
    mocked.fetchBackzettelDay.mockRejectedValueOnce(new Error('Offline'))
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(
      await screen.findByText(/Keine Verbindung zum Server/)
    ).toBeInTheDocument()
    expect(screen.getByTestId(`bs-total-${WECK}`)).toHaveTextContent('65')
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
    expect(prep).toHaveTextContent('Testsauerteig (misch)')
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

  it('Verkauf (nur lesen) bekommt weder Haken noch „Gesehen"', async () => {
    renderTablet({ role: 'verkauf' })
    await screen.findByTestId('bs-progress')
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(
      within(screen.getByTestId('bs-deltas')).queryByRole('button')
    ).not.toBeInTheDocument()
  })
})
