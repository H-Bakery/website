import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import AbholListeClient from './AbholListeClient'
import {
  changePreorderStatus,
  fetchPickupPoints,
  fetchPreorderDay,
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
  changePreorderStatus: jest.fn(),
  fetchPickupPoints: jest.fn(),
  fetchPreorderDay: jest.fn(),
}))

const mockDay = fetchPreorderDay as jest.MockedFunction<typeof fetchPreorderDay>
const mockStatus = changePreorderStatus as jest.MockedFunction<
  typeof changePreorderStatus
>

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
    await waitFor(() => expect(mockStatus).toHaveBeenCalledTimes(2))
    expect(mockStatus.mock.calls.map((c) => c[0]).sort()).toEqual([1, 2])
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
    await waitFor(() => expect(mockStatus).toHaveBeenCalledTimes(3))
    expect(mockStatus).toHaveBeenCalledWith(
      3,
      { notCollected: true },
      '2026-11-12T08:02:00.000Z'
    )
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
    expect(
      await screen.findByText(
        /LA-2026-11-12-01: Die Vorbestellung wurde inzwischen geändert\. Die Liste ist neu geladen/
      )
    ).toBeInTheDocument()
    expect(mockDay.mock.calls.length).toBeGreaterThan(loadsBefore)
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull()
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
    expect(
      screen.getByRole('menuitem', { name: 'Nicht abgeholt' })
    ).toBeInTheDocument()
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
      'Unterschrift',
    ])
    const text = sheet.textContent ?? ''
    expect(text).toContain('Erika Beispiel')
    expect(text).toContain('Max Muster')
    expect(text).toContain('6 × Mustersemmel (Nuss)')
    expect(text).not.toContain('Stefan Storno')
    expect(text).toContain('1 storniert (nicht aufgeführt)')
    await user.click(screen.getByRole('button', { name: 'Drucken' }))
    expect(print).toHaveBeenCalled()
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
