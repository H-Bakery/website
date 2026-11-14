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
    acknowledgeDeltas: jest.fn(),
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
      '2,25 L'
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

  it('Entwurf: Banner „Noch nicht freigegeben“, Zahlen da, kein Haken', async () => {
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
    expect(mocked.setLineDone).toHaveBeenCalledWith(
      SAT,
      weckId,
      true,
      expect.any(Number)
    )

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
      expect(mocked.setLineDone).toHaveBeenCalledWith(
        SAT,
        weck.id,
        false,
        expect.any(Number)
      )
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

  it('Haken aus veralteter Ansicht: Menge geändert → nicht abgehakt, neu geladen, Hinweis (W4-verify r4)', async () => {
    const shown = saturdayConfirmed()
    const weck = shown.sections
      .flatMap((sec) => sec.lines)
      .find((l) => l.key === WECK)!
    mocked.setLineDone.mockRejectedValue(
      apiError(
        409,
        'line_changed',
        `Menge geändert: jetzt ${weck.total + 6} statt ${
          weck.total
        }. Der Haken wurde nicht gesetzt.`
      )
    )
    renderTablet()
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Testweck abhaken' })
    )
    await waitFor(() =>
      expect(mocked.setLineDone).toHaveBeenCalledWith(
        SAT,
        weck.id,
        true,
        weck.total
      )
    )
    const bigger = {
      ...shown,
      sections: shown.sections.map((sec) => ({
        ...sec,
        lines: sec.lines.map((l) =>
          l.key === WECK ? { ...l, correction: 6, total: l.total + 6 } : l
        ),
      })),
    }
    mocked.fetchBackzettelDay.mockResolvedValue(bigger)
    expect(
      await screen.findByText(
        `Menge geändert: jetzt ${weck.total + 6} statt ${
          weck.total
        }. Der Haken wurde nicht gesetzt. Der Backzettel wird neu geladen.`
      )
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(2)
    )
    expect(screen.getByTestId(`bs-tick-${WECK}`)).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('„Gesehen“ auf einen schon eingerechneten Nachtrag (404) lädt neu (W4-verify r4)', async () => {
    mocked.acknowledgeDelta.mockRejectedValue(
      apiError(
        404,
        'not_found',
        'Dieser Nachtrag ist nicht mehr offen - der Backzettel wurde inzwischen neu freigegeben.'
      )
    )
    renderTablet()
    const card = await screen.findByTestId('bs-deltas')
    mocked.fetchBackzettelDay.mockResolvedValue(
      saturdayConfirmed({ deltas: [] })
    )
    fireEvent.click(within(card).getByRole('button', { name: /gesehen/ }))
    await waitFor(() =>
      expect(screen.queryByTestId('bs-deltas')).not.toBeInTheDocument()
    )
    expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(2)
    expect(
      screen.getByText(/nicht mehr offen.*Der Backzettel wird neu geladen\./)
    ).toBeInTheDocument()
  })

  it('Nachträge je Zeile zusammengefasst, ein „Gesehen“ je Zeile und „Alle gesehen“ (W4-verify r4)', async () => {
    const base = saturdayConfirmed()
    const zopf = base.deltas[0]
    const deltas = [
      zopf,
      { ...zopf, id: 9, qty: 3, preorderCode: 'MO-2026-11-28-01' },
      { ...zopf, id: 10, qty: -1, kind: 'changed', preorderCode: null },
      {
        ...zopf,
        id: 11,
        key: WECK,
        itemId: 'test-weck',
        name: 'Testweck',
        variant: null,
        qty: 4,
      },
    ]
    mocked.fetchBackzettelDay.mockResolvedValue({ ...base, deltas })
    mocked.acknowledgeDeltas.mockImplementation(async (_d, ids) =>
      ids.map((id) => ({
        ...deltas.find((x) => x.id === id)!,
        acknowledgedAt: '2026-11-28T03:05:00.000Z',
        acknowledgedBy: { id: 3, displayName: 'Test Bäcker' },
      }))
    )
    renderTablet()
    const card = await screen.findByTestId('bs-deltas')
    expect(card).toHaveTextContent('4 Nachträge seit der Freigabe · 2 Zeilen')
    const group = within(card).getByTestId(`bs-delta-group-${ZOPF_NUSS}`)
    expect(group).toHaveTextContent('+3')
    expect(group).toHaveTextContent('3 Änderungen')
    expect(
      within(card).getAllByRole('button', { name: /gesehen/ })
    ).toHaveLength(3)
    fireEvent.click(
      within(group).getByRole('button', {
        name: '3 Nachträge Testzopf gefüllt – Testnussfüllung gesehen',
      })
    )
    await waitFor(() =>
      expect(mocked.acknowledgeDeltas).toHaveBeenCalledWith(SAT, [7, 9, 10])
    )
    await waitFor(() =>
      expect(
        screen.queryByTestId(`bs-delta-group-${ZOPF_NUSS}`)
      ).not.toBeInTheDocument()
    )
    expect(screen.getByTestId('bs-deltas')).toHaveTextContent(
      '1 Nachtrag seit der Freigabe'
    )
    expect(screen.queryByTestId('bs-deltas-ack-all')).not.toBeInTheDocument()
  })

  it('die große Zahl im Nachtrags-Kasten ist die Backmenge, nicht die Viertelsumme (W4-verify r5)', async () => {
    const base = saturdayConfirmed()
    const zopf = base.deltas[0]
    const deltas = [
      { ...zopf, qty: 6 },
      { ...zopf, id: 9, qty: 0.5, preorderCode: 'MO-2026-11-28-01' },
      {
        ...zopf,
        id: 11,
        key: WECK,
        itemId: 'test-weck',
        name: 'Testweck',
        variant: null,
        qty: -0.25,
      },
    ]
    mocked.fetchBackzettelDay.mockResolvedValue({
      ...base,
      deltas,
      sections: base.sections.map((s) => ({
        ...s,
        lines: s.lines.map((l) =>
          l.key === ZOPF_NUSS
            ? {
                ...l,
                delta: {
                  qty: 6.5,
                  open: 2,
                  count: 2,
                  bake: 7,
                  openQty: 6.5,
                  bakeOpen: 7,
                },
              }
            : l.key === WECK
            ? {
                ...l,
                delta: {
                  qty: -0.25,
                  open: 1,
                  count: 1,
                  bake: 0,
                  openQty: -0.25,
                  bakeOpen: 0,
                },
              }
            : l
        ),
      })),
    })
    renderTablet()
    const card = await screen.findByTestId('bs-deltas')
    const zopfGroup = within(card).getByTestId(`bs-delta-group-${ZOPF_NUSS}`)
    expect(within(zopfGroup).getByText('+7')).toBeInTheDocument()
    expect(within(zopfGroup).queryByText('+6,5')).toBeNull()
    expect(
      within(card).getByTestId(`bs-delta-bake-${ZOPF_NUSS}`)
    ).toHaveTextContent('Nachtrag +6,5 · 7 mehr backen')
    const weckGroup = within(card).getByTestId(`bs-delta-group-${WECK}`)
    expect(within(weckGroup).getByText('±0')).toBeInTheDocument()
    expect(within(card).getByTestId(`bs-delta-bake-${WECK}`)).toHaveTextContent(
      'nicht weniger backen'
    )
  })

  it('„Alle gesehen“ quittiert alle offenen Nachträge auf einmal', async () => {
    const base = saturdayConfirmed()
    const zopf = base.deltas[0]
    const deltas = [
      zopf,
      {
        ...zopf,
        id: 11,
        key: WECK,
        itemId: 'test-weck',
        name: 'Testweck',
        variant: null,
        qty: 4,
      },
    ]
    mocked.fetchBackzettelDay.mockResolvedValue({ ...base, deltas })
    mocked.acknowledgeDeltas.mockResolvedValue([])
    renderTablet()
    fireEvent.click(await screen.findByTestId('bs-deltas-ack-all'))
    await waitFor(() =>
      expect(mocked.acknowledgeDeltas).toHaveBeenCalledWith(SAT, [7, 11])
    )
    await waitFor(() =>
      expect(screen.queryByTestId('bs-deltas')).not.toBeInTheDocument()
    )
  })

  it('Netz wieder da: das Neuladen ersetzt den alten Fehler durch den nächsten Schritt (W4-verify r3)', async () => {
    mocked.setLineDone.mockRejectedValue(new TypeError('Failed to fetch'))
    renderTablet()
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Testweck abhaken' })
    )
    const old =
      'Nicht gespeichert: Keine Verbindung zum Server – bitte WLAN prüfen.'
    expect(await screen.findByText(old)).toBeInTheDocument()
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(
      await screen.findByText(
        'Die Verbindung ist wieder da. Der letzte Haken wurde nicht gespeichert - bitte noch einmal abhaken.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(old)).not.toBeInTheDocument()
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

  it('Nachtrag: Badge an der Zeile und „Gesehen“ quittiert', async () => {
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
    expect(extras).toHaveTextContent('1 × 500 g zusätzlich abwiegen')
    expect(extras).toHaveTextContent('Testnussfüllung: +400 g')
    // Groß zum Abwiegen (W4-verify r4)
    const big = within(extras)
      .getAllByText(/^\+\d/)
      .map((el) => el.textContent)
    expect(big).toEqual(expect.arrayContaining(['+1 × 500 g', '+400 g']))
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

    it('12 Uhr: eine Wahl „Heute“ vom Vormittag weicht dem nächsten Backtag', async () => {
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

    it('Mitternacht: „Heute“ vom Sonntag zeigt am Montag nicht den Ruhetag', async () => {
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
    fireEvent.click(screen.getByRole('tab', { name: 'Vorbereitung' }))
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
    fireEvent.click(screen.getByRole('tab', { name: 'Vorbereitung' }))
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

  it('„Zur Verwaltung“ nur mit persönlicher Sitzung, nicht an der Station', async () => {
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

  it('Backstubenleitung hakt ab und quittiert wie die Backstube', async () => {
    renderTablet({ role: 'backstubenleiter' })
    await screen.findByTestId('bs-progress')
    expect(screen.queryAllByRole('checkbox').length).toBeGreaterThan(0)
  })

  it('Verkauf (nur lesen) bekommt weder Haken noch „Gesehen“', async () => {
    renderTablet({ role: 'verkauf' })
    await screen.findByTestId('bs-progress')
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(
      within(screen.getByTestId('bs-deltas')).queryByRole('button')
    ).not.toBeInTheDocument()
  })
})

describe('Backstube-Tablet: UI-Runde 1', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchBackzettelConfig.mockResolvedValue(CONFIG_RESPONSE)
  })

  /** Weck abgehakt um 04:00, danach ein Nachtrag +12 (schon gesehen). */
  function weckDoneThenDelta(): api.BackzettelDay {
    const base = saturdayConfirmed()
    return {
      ...base,
      sections: base.sections.map((s) => ({
        ...s,
        lines: s.lines.map((l) =>
          l.key === WECK
            ? {
                ...l,
                doneAt: '2026-11-28T03:00:00.000Z',
                doneBy: { id: 2, displayName: 'Test Backstube' },
                delta: { qty: 12, open: 0, count: 1, bake: 12, bakeOpen: 0 },
              }
            : l
        ),
      })),
      deltas: [
        {
          id: 20,
          key: WECK,
          itemId: 'test-weck',
          name: 'Testweck',
          unit: 'Stück',
          variant: null,
          qty: 12,
          kind: 'added',
          preorderId: 50,
          preorderCode: 'LA-2026-11-28-09',
          createdAt: '2026-11-28T03:30:00.000Z',
          acknowledgedAt: '2026-11-28T03:40:00.000Z',
          acknowledgedBy: { id: 2, displayName: 'Test Backstube' },
        },
      ],
    }
  }

  it('ein Nachtrag nach dem Abhaken lässt die Zeile offen, auch wenn er gesehen ist', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(weckDoneThenDelta())
    renderTablet({ now: at(SAT, 5) })
    const row = await screen.findByTestId(`bs-line-${WECK}`)
    expect(row).toHaveAttribute('data-done', 'false')
    expect(row).toHaveAttribute('data-reopened', 'true')
    expect(screen.getByTestId(`bs-after-done-${WECK}`)).toHaveTextContent(
      'danach Nachtrag: noch +12 backen'
    )
    expect(screen.getByTestId(`bs-after-done-qty-${WECK}`)).toHaveTextContent(
      '+12'
    )
    expect(screen.getByTestId(`bs-tick-${WECK}`)).toHaveAttribute(
      'aria-checked',
      'mixed'
    )
    // zählt nicht als erledigt
    expect(screen.getByTestId('bs-progress')).toHaveTextContent(
      '0 von 4 erledigt'
    )
  })

  it('ein Tipp auf den Haken setzt ihn neu (undone + done), danach ist die Zeile erledigt', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(weckDoneThenDelta())
    mocked.setLineDone.mockImplementation(async (_d, id, done) => ({
      id,
      date: SAT,
      itemId: 'test-weck',
      variant: null,
      doneAt: done ? '2026-11-28T04:10:00.000Z' : null,
      doneBy: done ? { id: 2, displayName: 'Test Backstube' } : null,
    }))
    renderTablet({ now: at(SAT, 5) })
    fireEvent.click(await screen.findByTestId(`bs-tick-${WECK}`))
    await waitFor(() => expect(mocked.setLineDone).toHaveBeenCalledTimes(2))
    const weckId = mocked.setLineDone.mock.calls[0][1]
    expect(mocked.setLineDone.mock.calls[0]).toEqual([SAT, weckId, false])
    expect(mocked.setLineDone.mock.calls[1]).toEqual([SAT, weckId, true, 65])
    await waitFor(() =>
      expect(screen.getByTestId(`bs-line-${WECK}`)).toHaveAttribute(
        'data-done',
        'true'
      )
    )
    expect(
      screen.queryByTestId(`bs-after-done-qty-${WECK}`)
    ).not.toBeInTheDocument()
  })

  it('offene Grundmenge: Abzeichen an der Zeile', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayConfirmed())
    renderTablet()
    expect(
      await screen.findByTestId('bs-base-unset-test-zopf|mohn')
    ).toHaveTextContent('Grundmenge offen')
    expect(screen.queryByTestId(`bs-base-unset-${WECK}`)).toBeNull()
  })

  it('Hinweise stehen oben als Warnung, nicht unten als Info', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(
      saturdayConfirmed({
        warnings: [
          {
            code: 'unmapped_product',
            message: 'Testsemmel gehört zu keinem Posten.',
          },
          { code: 'base_unset', message: 'Grundmenge offen: Testzopf.' },
          {
            code: 'unmapped_product',
            message: 'Testtorte gehört zu keinem Posten.',
          },
        ],
      })
    )
    renderTablet()
    const warnings = await screen.findByTestId('bs-warnings')
    expect(warnings).toHaveClass('MuiAlert-standardWarning')
    expect(warnings).toHaveTextContent('Hinweise (3)')
    const order = Array.from(
      document.querySelectorAll(
        '[data-testid="bs-warnings"], [data-testid^="bs-section-"]'
      )
    ).map((el) => el.getAttribute('data-testid'))
    expect(order[0]).toBe('bs-warnings')
  })
})

describe('Backstube-Tablet: Aufbau (UI-Umbau 2026-11)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchBackzettelConfig.mockResolvedValue(CONFIG_RESPONSE)
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayConfirmed())
  })

  it('Überblick: je Abschnitt ein Sprungknopf mit „erledigt von“', async () => {
    const scrollIntoView = jest.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    renderTablet()
    const overview = within(await screen.findByTestId('bs-overview'))
    expect(overview.getByTestId('bs-progress')).toHaveTextContent(
      '0 von 4 erledigt'
    )
    expect(
      overview.getByRole('button', { name: 'Hefeteig: 0 von 2' })
    ).toBeInTheDocument()
    const broetchen = overview.getByRole('button', {
      name: 'Brötchen: 0 von 1',
    })
    // Hefeteig & Füllungen ist Ansicht ohne Haken - nur der Name.
    expect(
      overview.getByRole('button', { name: 'Hefeteig & Füllungen' })
    ).toBeInTheDocument()

    fireEvent.click(broetchen)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(
      document.getElementById('bs-anchor-broetchen')
    )
    expect(document.getElementById('bs-anchor-broetchen')).toBe(
      screen.getByTestId('bs-section-broetchen')
    )
  })

  it('Fortschritt im Kopf zählt beim Abhaken mit; Stand steht oben', async () => {
    mocked.setLineDone.mockReturnValue(new Promise(() => undefined))
    renderTablet()
    await screen.findByTestId('bs-progress')
    const bar = screen.getByTestId('bs-header-progress')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByTestId('bs-loaded-at')).toHaveTextContent('Stand 03:00')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Testweck abhaken' }))
    expect(bar).toHaveAttribute('aria-valuenow', '25')
    expect(bar).toHaveAccessibleName('1 von 4 erledigt')
    expect(
      within(screen.getByTestId('bs-overview')).getByRole('button', {
        name: 'Brötchen: 1 von 1',
      })
    ).toBeInTheDocument()
  })

  it('offene Nachträge stehen vor dem Überblick und den Zeilen', async () => {
    renderTablet()
    await screen.findByTestId('bs-overview')
    const order = Array.from(
      document.querySelectorAll(
        '[data-testid="bs-deltas"], [data-testid="bs-overview"], [data-testid^="bs-section-"]'
      )
    ).map((el) => el.getAttribute('data-testid'))
    expect(order.slice(0, 2)).toEqual(['bs-deltas', 'bs-overview'])
    // Seitenspalte und Zeilen getrennt (zwei Spalten ab 1080 px).
    expect(
      within(screen.getByTestId('bs-aside')).getByTestId('bs-deltas')
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('bs-main')).getByTestId('bs-section-brot')
    ).toBeInTheDocument()
  })

  it('Entwurf: Überblick nennt je Abschnitt nur die Zahl der Zeilen', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayDraft())
    renderTablet()
    const overview = within(await screen.findByTestId('bs-overview'))
    expect(overview.getByTestId('bs-draft-banner')).toBeInTheDocument()
    expect(
      overview.getByRole('button', { name: 'Hefeteig: 2 Zeilen' })
    ).toBeInTheDocument()
    expect(
      overview.getByRole('button', { name: 'Brot: 1 Zeile' })
    ).toBeInTheDocument()
    // Kein Fortschritt im Kopf, solange nichts abgehakt werden kann.
    expect(screen.getByTestId('bs-header-progress')).toHaveStyle({
      visibility: 'hidden',
    })
  })

  it('ein gescheiterter Haken meldet sich unten fest im Bild', async () => {
    mocked.setLineDone.mockRejectedValue(
      apiError(500, 'internal', 'Interner Fehler')
    )
    renderTablet()
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Testweck abhaken' })
    )
    const alert = await screen.findByText(/^Nicht gespeichert:/)
    const box = alert.closest('[data-print="hide"]') as HTMLElement
    expect(getComputedStyle(box).position).toBe('fixed')
    fireEvent.click(within(box).getByRole('button', { name: /close/i }))
    expect(screen.queryByText(/^Nicht gespeichert:/)).not.toBeInTheDocument()
  })
})
