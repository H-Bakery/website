import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import { ApiError } from '@bakery/shared/data-access'
import AbholListeClient from './AbholListeClient'
import {
  bulkPreorderStatus,
  changePreorderStatus,
  fetchPickupPoints,
  fetchPreorderDay,
  type BulkStatusAnswer,
  type BulkStatusResult,
} from '../../../../lib/preordersApi'
import {
  ONLY_DATE,
  POINT,
  day,
  preorder,
} from '../../../../lib/testing/preorderFixtures'
import { WithSession, fakeSession } from '../../../../lib/testing/fakeSession'
import type { PilotRole } from '../../../../lib/roles'
import type { Preorder, PreorderDay } from '../../../../lib/preordersTypes'

jest.mock('../../../../lib/preordersApi', () => ({
  ...jest.requireActual('../../../../lib/preordersApi'),
  bulkPreorderStatus: jest.fn(),
  changePreorderStatus: jest.fn(),
  fetchPickupPoints: jest.fn(),
  fetchPreorderDay: jest.fn(),
}))

const mockDay = fetchPreorderDay as jest.MockedFunction<typeof fetchPreorderDay>
const mockStatus = changePreorderStatus as jest.MockedFunction<
  typeof changePreorderStatus
>
const mockBulk = bulkPreorderStatus as jest.MockedFunction<
  typeof bulkPreorderStatus
>

function bulkAnswer(results: BulkStatusResult[]): BulkStatusAnswer {
  const counts = { ok: 0, conflict: 0, anonymized: 0, not_found: 0, refused: 0 }
  for (const r of results) counts[r.result]++
  return { counts, results }
}

const DATE = '2026-11-12' // Donnerstag = „heute" in den Tests

const erika = preorder({
  id: 1,
  code: 'LA-2026-11-12-01',
  pickupDate: DATE,
  customerName: 'Erika Beispiel',
  pickupTime: '09:00',
  paid: true,
  updatedAt: '2026-11-12T08:00:00.000Z',
})
const max = preorder({
  id: 2,
  code: 'LA-2026-11-12-02',
  pickupDate: DATE,
  customerName: 'Max Muster',
  customerPhone: null,
  pickupTime: '08:30',
  paid: false,
  items: [
    {
      productId: 'mustersemmel',
      name: 'Mustersemmel',
      variant: 'nuss',
      unit: 'Stück',
      unitPrice: 0.6,
      quantity: 6,
      lineTotal: 3.6,
    },
  ],
  total: 3.6,
  updatedAt: '2026-11-12T08:01:00.000Z',
})
const paula = preorder({
  id: 3,
  code: 'LA-2026-11-12-03',
  pickupDate: DATE,
  customerName: 'Paula Probe',
  pickupTime: '08:30',
  status: 'bereit',
  updatedAt: '2026-11-12T08:02:00.000Z',
})
const storno = preorder({
  id: 4,
  code: 'LA-2026-11-12-04',
  pickupDate: DATE,
  customerName: 'Stefan Storno',
  status: 'storniert',
})

function ladenDay(preorders: Preorder[] = [erika, max, paula, storno]) {
  return day({
    date: DATE,
    pickupPointId: 'laden',
    preorders,
    summary: {
      count: 3,
      total: 13.2,
      byStatus: { offen: 2, bereit: 1, abgeholt: 0, storniert: 1 },
      notCollected: 0,
      paid: 1,
      unpaidTotal: 8.4,
      byChannel: { telefon: 3 },
    },
  })
}

function renderAs(
  role: PilotRole,
  props: { initialDate?: string; initialPlace?: string } = {
    initialDate: DATE,
    initialPlace: 'laden',
  }
) {
  return renderWithTheme(
    <WithSession value={fakeSession({ role })}>
      <AbholListeClient {...props} />
    </WithSession>
  )
}

function row(code: string) {
  return screen.getByTestId(`abhol-${code}`)
}

function stale(): Error {
  return Object.assign(
    new Error('Die Vorbestellung wurde inzwischen geändert.'),
    {
      code: 'stale_preorder',
    }
  )
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 10, 12, 10), doNotFake: ONLY_DATE })
  jest.clearAllMocks()
  ;(fetchPickupPoints as jest.Mock).mockResolvedValue([POINT])
  mockDay.mockResolvedValue(ladenDay())
  mockStatus.mockImplementation(async (id, change) => {
    const base = [erika, max, paula].find((p) => p.id === id) as Preorder
    return {
      ...base,
      ...(change.status ? { status: change.status } : {}),
      ...(change.paid !== undefined ? { paid: change.paid } : {}),
      notCollected: change.notCollected ?? base.notCollected,
      pickedUpAt:
        change.status === 'abgeholt' ? '2026-11-12T09:14:00.000Z' : null,
      updatedAt: '2026-11-12T09:14:00.000Z',
    }
  })
  mockBulk.mockImplementation(async (list, change) =>
    bulkAnswer(
      list.map((p) => ({
        id: p.id,
        result: 'ok' as const,
        data: {
          ...([erika, max, paula].find((x) => x.id === p.id) as Preorder),
          ...(change.status ? { status: change.status } : {}),
          notCollected: change.notCollected ?? false,
          updatedAt: '2026-11-12T09:20:00.000Z',
        },
      }))
    )
  )
})

afterEach(() => jest.useRealTimers())

describe('AbholListeClient (P2)', () => {
  it('lädt Tag und Ort, gruppiert nach Uhrzeit, Stornierte am Ende', async () => {
    renderAs('verkauf')
    expect(
      await screen.findByRole('heading', { name: 'Abholliste Laden' })
    ).toBeInTheDocument()
    expect(mockDay).toHaveBeenCalledWith(DATE, 'laden')
    const groups = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
    expect(groups).toEqual(['08:30 Uhr · 2', '09:00 Uhr · 1', 'Storniert · 1'])
    const early = screen.getByRole('region', { name: '08:30 Uhr' })
    expect(
      within(early)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent)
    ).toEqual(['Max Muster', 'Paula Probe'])
    // Sorte steht an der Position
    expect(
      within(row('LA-2026-11-12-02')).getByText(/Mustersemmel \(Nuss\)/)
    ).toBeInTheDocument()
    // Stornierte haben keine Aktionen
    expect(
      within(row('LA-2026-11-12-04')).queryByRole('button')
    ).not.toBeInTheDocument()
    expect(screen.getByText('Noch zu kassieren')).toBeInTheDocument()
  })

  it('bezahlt: ein Tipp übergibt, „Rückgängig" stellt den alten Stand her', async () => {
    const user = userEvent.setup()
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    await user.click(
      screen.getByRole('button', { name: 'Erika Beispiel übergeben' })
    )
    expect(mockStatus).toHaveBeenCalledWith(
      1,
      { status: 'abgeholt' },
      '2026-11-12T08:00:00.000Z'
    )
    expect(await screen.findByText('Erika Beispiel übergeben.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Rückgängig' }))
    await waitFor(() =>
      expect(mockStatus).toHaveBeenLastCalledWith(
        1,
        { status: 'offen', paid: true, notCollected: false },
        '2026-11-12T09:14:00.000Z'
      )
    )
    // nach jeder Aktion still neu geladen
    expect(mockDay.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('nicht bezahlt: fragt nach dem Geld, „Bezahlt und übergeben"', async () => {
    const user = userEvent.setup()
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-02')
    await user.click(
      screen.getByRole('button', { name: 'Max Muster übergeben' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/3,60/)).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: 'Bezahlt und übergeben' })
    )
    expect(mockStatus).toHaveBeenCalledWith(
      2,
      { status: 'abgeholt', paid: true },
      '2026-11-12T08:01:00.000Z'
    )
  })

  it('übergibt auch ohne Zahlung (Rechnung) und markiert bezahlt einzeln', async () => {
    const user = userEvent.setup()
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-03')
    await user.click(
      screen.getByRole('button', { name: 'Paula Probe: als bezahlt markieren' })
    )
    expect(mockStatus).toHaveBeenCalledWith(
      3,
      { paid: true },
      '2026-11-12T08:02:00.000Z'
    )
    await user.click(
      screen.getByRole('button', { name: 'Max Muster übergeben' })
    )
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Ohne Zahlung übergeben',
      })
    )
    expect(mockStatus).toHaveBeenLastCalledWith(
      2,
      { status: 'abgeholt', paid: false },
      '2026-11-12T08:01:00.000Z'
    )
  })

  it('Fahrer: „Bezahlt" ohne „Rückgängig" - eine Zahlung nimmt nur der Verkauf zurück (W4-verify r2)', async () => {
    const user = userEvent.setup()
    renderAs('fahrer', {})
    await screen.findByTestId('abhol-LA-2026-11-12-03')
    await user.click(
      screen.getByRole('button', { name: 'Paula Probe: als bezahlt markieren' })
    )
    expect(mockStatus).toHaveBeenCalledWith(
      3,
      { paid: true },
      '2026-11-12T08:02:00.000Z'
    )
    expect(await screen.findByText('Paula Probe: bezahlt.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull()
  })

  it('Sitzung endet mitten in der Übergabe: „Nicht gespeichert" bleibt stehen (W4-verify r2)', async () => {
    const user = userEvent.setup()
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-02')
    mockStatus.mockRejectedValueOnce(
      Object.assign(new Error('Sitzung abgelaufen.'), { status: 401 })
    )
    await user.click(
      screen.getByRole('button', { name: 'Max Muster übergeben' })
    )
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Bezahlt und übergeben',
      })
    )
    expect(
      await screen.findByText(
        /LA-2026-11-12-02 \(Max Muster\): Die Übergabe mit Zahlung wurde NICHT gespeichert/
      )
    ).toBeInTheDocument()
  })

  it('meldet „bereit" über das Menü und bündelt „Alle offenen als bereit"', async () => {
    const user = userEvent.setup()
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-02')
    await user.click(
      screen.getByRole('button', { name: 'Weitere Aktionen für Max Muster' })
    )
    await user.click(screen.getByRole('menuitem', { name: 'Bereit (gepackt)' }))
    expect(mockStatus).toHaveBeenCalledWith(
      2,
      { status: 'bereit' },
      '2026-11-12T08:01:00.000Z'
    )
    mockStatus.mockClear()
    await user.click(
      screen.getByRole('button', { name: /Alle offenen als bereit markieren/ })
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Als bereit markieren' })
    )
    // Ein Request für alle (W4), mit der geladenen Fassung je Bestellung.
    await waitFor(() => expect(mockBulk).toHaveBeenCalledTimes(1))
    expect(mockStatus).not.toHaveBeenCalled()
    const [list, change] = mockBulk.mock.calls[0]
    expect(list.map((p) => p.id).sort()).toEqual([1, 2])
    expect(change).toEqual({ status: 'bereit' })
    expect(
      await screen.findByText('2 Bestellungen als bereit markiert.')
    ).toBeVisible()
  })

  it('Tagesabschluss: alle Wartenden als „nicht abgeholt" - erst am Abholtag', async () => {
    const user = userEvent.setup()
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    await user.click(
      screen.getByRole('button', { name: /Tagesabschluss: Rest/ })
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(3)
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Als nicht abgeholt markieren',
      })
    )
    await waitFor(() => expect(mockBulk).toHaveBeenCalledTimes(1))
    const [list, change] = mockBulk.mock.calls[0]
    expect(change).toEqual({ notCollected: true })
    expect(list.map((p) => [p.id, p.updatedAt])).toEqual(
      expect.arrayContaining([[3, '2026-11-12T08:02:00.000Z']])
    )
    expect(list).toHaveLength(3)
  })

  it('Sammelaktion: Konflikt, anonymisiert und abgelehnt - je eine eigene Meldung', async () => {
    const user = userEvent.setup()
    mockBulk.mockResolvedValueOnce(
      bulkAnswer([
        { id: 1, result: 'ok', data: { ...erika, notCollected: true } },
        {
          id: 2,
          result: 'conflict',
          error: 'stale_preorder',
          message: 'Die Vorbestellung wurde inzwischen geändert.',
        },
        {
          id: 3,
          result: 'anonymized',
          error: 'anonymized',
          message: 'anonymisiert',
        },
      ])
    )
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    await user.click(
      screen.getByRole('button', { name: /Tagesabschluss: Rest/ })
    )
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Als nicht abgeholt markieren',
      })
    )
    expect(
      await screen.findByText('1 Bestellung als nicht abgeholt markiert.')
    ).toBeVisible()
    const notice = await screen.findByText(/inzwischen an anderer Stelle/)
    expect(notice.textContent).toContain(
      '1 Bestellung wurde inzwischen an anderer Stelle geändert und nicht angefasst.'
    )
    expect(notice.textContent).toContain(
      '1 Bestellung ist schon anonymisiert (Datenschutz)'
    )
    expect(notice.textContent).toContain('Die Liste ist neu geladen.')
  })

  it('Sammelaktion: Neuladen scheitert - kein „neu geladen", Liste bleibt, Hinweis offline', async () => {
    const user = userEvent.setup()
    mockBulk.mockResolvedValueOnce(
      bulkAnswer([
        { id: 1, result: 'ok', data: { ...erika, status: 'bereit' } },
        { id: 2, result: 'conflict', error: 'stale_preorder' },
      ])
    )
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    mockDay.mockRejectedValue(new Error('Failed to fetch'))
    await user.click(
      screen.getByRole('button', { name: /Alle offenen als bereit markieren/ })
    )
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Als bereit markieren',
      })
    )
    const notice = await screen.findByText(/inzwischen an anderer Stelle/)
    expect(notice.textContent).not.toContain('Die Liste ist neu geladen')
    expect(notice.textContent).toContain(
      'Die Liste konnte nicht neu geladen werden'
    )
    // letzter Stand bleibt sichtbar, mit Hinweis
    expect(screen.getByTestId('abhol-LA-2026-11-12-02')).toBeInTheDocument()
    expect(screen.getByTestId('abholliste-stale')).toHaveTextContent(
      /Keine Verbindung zum Server - die Liste konnte nicht neu geladen werden\. Angezeigt wird der Stand von \d\d:\d\d\./
    )
  })

  it('Sammelaktion ohne Verbindung: nichts gespeichert, Dialog bleibt offen', async () => {
    const user = userEvent.setup()
    mockBulk.mockRejectedValueOnce(new Error('Failed to fetch'))
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    await user.click(
      screen.getByRole('button', { name: /Alle offenen als bereit markieren/ })
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Als bereit markieren' })
    )
    expect(
      await within(dialog).findByText(
        'Keine Verbindung zum Server - es wurde nichts gespeichert. Bitte WLAN prüfen und erneut versuchen.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText(/als bereit markiert\./)).toBeNull()

    // 5xx: eigener Satz, auch hier nichts gespeichert
    mockBulk.mockRejectedValueOnce(
      new ApiError('Interner Fehler.', 502, 'bad_gateway')
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Als bereit markieren' })
    )
    expect(
      await within(dialog).findByText(
        /Der Server hat einen Fehler gemeldet - es wurde nichts gespeichert/
      )
    ).toBeInTheDocument()

    // 4xx: die deutsche Meldung der API
    mockBulk.mockRejectedValueOnce(
      new ApiError('Keine Berechtigung.', 403, 'forbidden')
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Als bereit markieren' })
    )
    expect(
      await within(dialog).findByText('Keine Berechtigung.')
    ).toBeInTheDocument()
  })

  it('Ladefehler: Meldung mit „Erneut versuchen", danach die Liste', async () => {
    const user = userEvent.setup()
    mockDay.mockRejectedValueOnce(
      new ApiError('Die Abholliste ist gerade nicht verfügbar.', 500, 'x')
    )
    renderAs('verkauf')
    const alert = await screen.findByText(
      'Die Abholliste ist gerade nicht verfügbar.'
    )
    expect(alert).toBeVisible()
    expect(screen.queryByTestId('abhol-LA-2026-11-12-01')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(
      await screen.findByTestId('abhol-LA-2026-11-12-01')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Die Abholliste ist gerade nicht verfügbar.')
    ).toBeNull()
  })

  it('Ladefehler ohne Verbindung: sagt es so', async () => {
    mockDay.mockRejectedValueOnce(new Error('Failed to fetch'))
    renderAs('verkauf')
    expect(
      await screen.findByText(
        'Keine Verbindung zum Server - die Abholliste konnte nicht geladen werden. Bitte WLAN prüfen.'
      )
    ).toBeVisible()
  })

  it('stilles Nachladen scheitert: Liste bleibt, Hinweis, „Erneut laden" holt sie', async () => {
    const user = userEvent.setup()
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    mockDay.mockRejectedValueOnce(new Error('Request timeout'))
    act(() => {
      fireEvent.focus(window)
    })
    expect(await screen.findByTestId('abholliste-stale')).toBeVisible()
    expect(screen.getByTestId('abhol-LA-2026-11-12-01')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Erneut laden' }))
    await waitFor(() =>
      expect(screen.queryByTestId('abholliste-stale')).toBeNull()
    )
  })

  it('Telefonnummer ist ein Touch-Ziel von mindestens 44 px', async () => {
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    const link = within(row('LA-2026-11-12-01')).getByRole('link', {
      name: erika.customerPhone as string,
    })
    expect(link.getAttribute('href')).toMatch(/^tel:\+?\d+$/)
    expect(link).toHaveStyle({ minHeight: '44px', minWidth: '44px' })
    expect(link).toHaveStyle({ display: 'inline-flex' })
  })

  it('„heute" rollt weiter: Tagesabschluss wird am Abholtag frei (Fokus/Sichtbarkeit)', async () => {
    const tomorrow = '2026-11-13'
    mockDay.mockResolvedValue({ ...ladenDay(), date: tomorrow } as PreorderDay)
    renderAs('verkauf', { initialDate: tomorrow, initialPlace: 'laden' })
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    const button = () =>
      screen.getByRole('button', { name: /Tagesabschluss: Rest/ })
    expect(button()).toBeDisabled()
    // Tablet bleibt über Nacht offen
    jest.setSystemTime(new Date(2026, 10, 13, 7, 30))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(button()).toBeEnabled())
  })

  it('„Nicht abgeholt" im Menü erst ab dem Abholtag', async () => {
    const user = userEvent.setup()
    const tomorrow = '2026-11-13'
    const later = preorder({
      ...paula,
      pickupDate: tomorrow,
      code: 'LA-2026-11-13-01',
    })
    mockDay.mockResolvedValue(
      day({ date: tomorrow, pickupPointId: 'laden', preorders: [later] })
    )
    renderAs('verkauf', { initialDate: tomorrow, initialPlace: 'laden' })
    await screen.findByTestId('abhol-LA-2026-11-13-01')
    await user.click(
      screen.getByRole('button', { name: 'Weitere Aktionen für Paula Probe' })
    )
    expect(
      screen.queryByRole('menuitem', { name: 'Nicht abgeholt' })
    ).not.toBeInTheDocument()
  })

  it('Tagesabschluss ist vor dem Abholtag gesperrt', async () => {
    mockDay.mockResolvedValue({
      ...ladenDay(),
      date: '2026-11-13',
    } as PreorderDay)
    renderAs('verkauf', { initialDate: '2026-11-13', initialPlace: 'laden' })
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    expect(
      screen.getByRole('button', { name: /Tagesabschluss: Rest/ })
    ).toBeDisabled()
  })

  it('sucht nach Name und laufender Nummer', async () => {
    const user = userEvent.setup()
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    const search = screen.getByRole('textbox', {
      name: 'Name oder Code suchen',
    })
    await user.type(search, 'paula')
    expect(
      screen.queryByTestId('abhol-LA-2026-11-12-01')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('abhol-LA-2026-11-12-03')).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, '2')
    expect(screen.getByTestId('abhol-LA-2026-11-12-02')).toBeInTheDocument()
    expect(
      screen.queryByTestId('abhol-LA-2026-11-12-03')
    ).not.toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'niemand')
    expect(
      screen.getByText('Keine Bestellung zu „niemand“.')
    ).toBeInTheDocument()
  })

  it('anderes Gerät war schneller: Hinweis, neu geladen, nichts überschrieben', async () => {
    const user = userEvent.setup()
    mockStatus.mockRejectedValueOnce(stale())
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    const loadsBefore = mockDay.mock.calls.length
    await user.click(
      screen.getByRole('button', { name: 'Erika Beispiel übergeben' })
    )
    // Oben über der Liste und unten als Hinweis, wo getippt wurde.
    expect(
      await screen.findAllByText(
        /LA-2026-11-12-01: Die Vorbestellung wurde inzwischen geändert\. Es wurde nichts überschrieben\. Die Liste ist neu geladen/
      )
    ).toHaveLength(2)
    expect(mockDay.mock.calls.length).toBeGreaterThan(loadsBefore)
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull()
  })

  it('Übergabe ohne Antwort und ohne frische Liste: „unklar", unten am Bildschirm, bleibt stehen (W4-Verifikation)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-02')
    mockStatus.mockRejectedValueOnce(new Error('Failed to fetch'))
    mockDay.mockRejectedValueOnce(new Error('Failed to fetch'))
    await user.click(
      screen.getByRole('button', { name: 'Max Muster übergeben' })
    )
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Bezahlt und übergeben',
      })
    )
    const messages = await screen.findAllByText(
      /LA-2026-11-12-02: Keine Verbindung zum Server - ob das gespeichert wurde, ist unklar/
    )
    expect(messages).toHaveLength(2)
    // Die Snackbar (unten) verschwindet nicht von selbst.
    await act(async () => {
      jest.advanceTimersByTime(20_000)
    })
    expect(
      screen.getAllByText(/ob das gespeichert wurde, ist unklar/)
    ).toHaveLength(2)
  })

  it('WLAN wieder da: die frische Liste löst „unklar" auf (W4-verify r2)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-02')
    mockStatus.mockRejectedValueOnce(new Error('Failed to fetch'))
    mockDay.mockRejectedValueOnce(new Error('Failed to fetch'))
    await user.click(
      screen.getByRole('button', { name: 'Max Muster übergeben' })
    )
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Bezahlt und übergeben',
      })
    )
    await screen.findAllByText(/ob das gespeichert wurde, ist unklar/)
    mockDay.mockResolvedValue(
      ladenDay([
        erika,
        { ...max, status: 'abgeholt', paid: true },
        paula,
        storno,
      ])
    )
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(
      await screen.findByText(
        'LA-2026-11-12-02: Die Verbindung ist wieder da - gespeichert ist es.'
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/ob das gespeichert wurde, ist unklar/)
    ).toBeNull()
  })

  it('Übergabe mit Geld, aber schon ohne Zahlung übergeben: Zahlung NICHT erfasst, bleibt stehen (W4-verify r2)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderAs('fahrer')
    await screen.findByTestId('abhol-LA-2026-11-12-02')
    mockStatus.mockRejectedValueOnce(stale())
    mockDay.mockResolvedValue(
      ladenDay([
        erika,
        { ...max, status: 'abgeholt', paid: false },
        paula,
        storno,
      ])
    )
    await user.click(
      screen.getByRole('button', { name: 'Max Muster übergeben' })
    )
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Bezahlt und übergeben',
      })
    )
    const notes = await screen.findAllByText(
      /LA-2026-11-12-02: Wurde inzwischen schon übergeben - die Zahlung ist NICHT erfasst/
    )
    expect(notes.length).toBeGreaterThanOrEqual(2)
    await act(async () => {
      jest.advanceTimersByTime(20_000)
    })
    expect(
      screen.getAllByText(/die Zahlung ist NICHT erfasst/).length
    ).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText(/erneut speichern/)).toBeNull()
  })

  it('Übergabe ohne Antwort, aber am Server gespeichert: sagt das statt „nichts gespeichert" (W4-Verifikation)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-02')
    mockStatus.mockRejectedValueOnce(new Error('Failed to fetch'))
    mockDay.mockResolvedValue(
      ladenDay([
        erika,
        { ...max, status: 'abgeholt', paid: true },
        paula,
        storno,
      ])
    )
    await user.click(
      screen.getByRole('button', { name: 'Max Muster übergeben' })
    )
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Bezahlt und übergeben',
      })
    )
    expect(
      await screen.findByText(
        'LA-2026-11-12-02: Die Antwort ging verloren, gespeichert ist es trotzdem.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/nichts gespeichert/)).toBeNull()
  })

  it('zweiter Versuch nach verlorener Antwort: 409, aber schon so gespeichert - „nichts zu tun" (W4-Verifikation)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-02')
    mockStatus.mockRejectedValueOnce(stale())
    mockDay.mockResolvedValue(
      ladenDay([
        erika,
        { ...max, status: 'abgeholt', paid: true },
        paula,
        storno,
      ])
    )
    await user.click(
      screen.getByRole('button', { name: 'Max Muster übergeben' })
    )
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Bezahlt und übergeben',
      })
    )
    expect(
      await screen.findAllByText(
        'LA-2026-11-12-02: Das ist bereits gespeichert - nichts zu tun.'
      )
    ).toHaveLength(2)
    expect(screen.queryByText(/erneut speichern/)).toBeNull()
  })

  it('Fahrer: startet an der Sammelstelle, bestätigt jede Übergabe, kein „bereit"', async () => {
    const user = userEvent.setup()
    const kita = preorder({
      id: 9,
      code: 'MO-2026-11-14-01',
      pickupDate: '2026-11-14',
      pickupTime: null,
      pickupPointId: POINT.id,
      pickupPoint: { id: POINT.id, name: POINT.name, window: POINT.window },
      channel: 'sammelstelle',
      customerName: 'Kim Kita',
      paid: true,
    })
    mockDay.mockResolvedValue(
      day({ date: '2026-11-14', pickupPointId: POINT.id, preorders: [kita] })
    )
    mockStatus.mockResolvedValue({ ...kita, status: 'abgeholt' })
    renderAs('fahrer', {})
    await waitFor(() =>
      expect(mockDay).toHaveBeenCalledWith('2026-11-14', POINT.id)
    )
    expect(
      await screen.findByRole('heading', { name: 'Abholliste Kita Teststraße' })
    ).toBeInTheDocument()
    // An der Sammelstelle gibt es keine Uhrzeiten: Vorgabe nach Name.
    expect(screen.getByRole('heading', { name: 'K · 1' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Alle offenen als bereit/ })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kim Kita übergeben' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Zurücknehmen kann danach nur der Verkauf.')
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Übergeben' }))
    expect(mockStatus).toHaveBeenCalledWith(
      9,
      { status: 'abgeholt' },
      kita.updatedAt
    )
    expect(await screen.findByText('Kim Kita übergeben.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(
      screen.getByRole('button', { name: 'Weitere Aktionen für Kim Kita' })
    )
    expect(
      screen.queryByRole('menuitem', { name: 'Bereit (gepackt)' })
    ).not.toBeInTheDocument()
    // Samstag ist noch nicht da („heute" = Donnerstag): erst ab dem Abholtag.
    expect(
      screen.queryByRole('menuitem', { name: 'Nicht abgeholt' })
    ).not.toBeInTheDocument()
  })

  it('druckt eine eigene A4-Tabelle: ganze Liste ohne Stornierte, mit Unterschrift', async () => {
    const user = userEvent.setup()
    const print = jest.fn()
    window.print = print
    const { container } = renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    // Suche wirkt nicht auf den Ausdruck
    await user.type(
      screen.getByRole('textbox', { name: 'Name oder Code suchen' }),
      'paula'
    )
    const sheet = container.querySelector('.abholliste-print') as HTMLElement
    expect(sheet).not.toBeNull()
    const headers = Array.from(sheet.querySelectorAll('th')).map(
      (th) => th.textContent
    )
    expect(headers).toEqual([
      '✓',
      'Code',
      'Name',
      'Artikel',
      'Summe',
      'Bezahlt',
      'n.\u00a0a.',
      'Unterschrift',
    ])
    // W4-Verifikation: auf Papier lässt sich „bezahlt“ und „nicht abgeholt“
    // ankreuzen, wie es die Kurzanleitung Fahrer sagt.
    const paidCells = Array.from(sheet.querySelectorAll('td.paid')).map(
      (td) => td.textContent
    )
    expect(paidCells).toEqual(expect.arrayContaining(['☑ ja', '☐']))
    expect(sheet.querySelector('.legend')?.textContent).toContain(
      'n. a. = nicht'
    )
    const text = sheet.textContent ?? ''
    expect(text).toContain('Erika Beispiel')
    expect(text).toContain('Max Muster')
    expect(text).toContain('6 × Mustersemmel (Nuss)')
    expect(text).not.toContain('Stefan Storno')
    expect(text).toContain('1 storniert (nicht aufgeführt)')
    await user.click(screen.getByRole('button', { name: 'Drucken' }))
    expect(print).toHaveBeenCalled()
  })

  it('ohne Zahlung übergeben: Betrag bleibt sichtbar, auf dem Bildschirm und im Druck (W4-Verifikation)', async () => {
    const base = ladenDay()
    mockDay.mockResolvedValue({
      ...base,
      summary: {
        ...base.summary,
        handedOverUnpaid: 1,
        handedOverUnpaidTotal: 6.4,
      },
    })
    const { container } = renderAs('verkauf')
    await screen.findByTestId('abhol-LA-2026-11-12-01')
    expect(
      screen.getByText('+ 6,40 € ohne Zahlung übergeben')
    ).toBeInTheDocument()
    const sheet = container.querySelector('.abholliste-print') as HTMLElement
    expect(sheet.textContent).toMatch(/\(\+ 6,40\s€ ohne Zahlung übergeben\)/)
  })

  it('ohne Bestellungen: Hinweis und für den Verkauf „Vorbestellung erfassen"', async () => {
    mockDay.mockResolvedValue(ladenDay([]))
    renderAs('verkauf')
    expect(
      await screen.findByText('Für diesen Tag ist hier nichts vorbestellt.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Vorbestellung erfassen' })
    ).toHaveAttribute('href', `/admin/preorders/neu?date=${DATE}`)
  })
})
