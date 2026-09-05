import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import BackingListClient from './BackingListClient'
import { fetchPickupPoints, fetchPreorderSummary } from '../preorderApi'
import type { PickupPoint, PreorderSummary } from '../preorderTypes'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/admin/delivery/preorders/backliste',
}))

jest.mock('../preorderApi', () => ({
  fetchPickupPoints: jest.fn(),
  fetchPreorderSummary: jest.fn(),
}))

const mockFetchPickupPoints = fetchPickupPoints as jest.MockedFunction<
  typeof fetchPickupPoints
>
const mockFetchSummary = fetchPreorderSummary as jest.MockedFunction<
  typeof fetchPreorderSummary
>

/** Der 12.09.2026 ist ein Samstag. */
const DATE = '2026-09-12'

const POINT: PickupPoint = {
  id: 'kindergarten-moersbach',
  name: 'Kindergarten Mörsbach',
  street: '',
  zip: '',
  city: 'Zweibrücken-Mörsbach',
  weekday: 6,
  window: '09:00-09:30',
  orderDeadline: { weekday: 5, time: '12:00' },
  notes: null,
  active: true,
  lat: null,
  lon: null,
  geocodeSource: null,
  geocodePrecision: null,
}

const SUMMARY: PreorderSummary = {
  date: DATE,
  pickupPointId: POINT.id,
  deadline: '2026-09-11T10:00:00.000Z',
  hasPickupStop: true,
  count: 3,
  total: 24.6,
  open: 3,
  handedOver: 0,
  notCollected: 0,
  cancelled: 1,
  byProduct: [
    { productId: 'bauernbrot', name: 'Bauernbrot', unit: 'Stück', qty: 6 },
    { productId: 'kaisersemmel', name: 'Kaisersemmel', unit: 'Stück', qty: 24 },
  ],
}

describe('BackingListClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPickupPoints.mockResolvedValue([POINT])
    mockFetchSummary.mockResolvedValue(SUMMARY)
  })

  it('zeigt die Menge je Produkt für den Liefertag', async () => {
    renderWithTheme(
      <BackingListClient initialDate={DATE} initialPickupPointId={POINT.id} />
    )

    expect(
      screen.getByRole('heading', { name: 'Backliste Vorbestellungen' })
    ).toBeInTheDocument()

    expect(await screen.findByText('Bauernbrot')).toBeInTheDocument()
    expect(mockFetchSummary).toHaveBeenCalledWith(DATE, POINT.id)
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    // Fuß der Liste: Anzahl, Stückzahl, Betrag und die stornierten daneben.
    expect(
      screen.getByText(/3 Vorbestellungen · 30 Stück · 24,60 € zu kassieren/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/1 storniert \(nicht enthalten\)/)
    ).toBeInTheDocument()
  })

  it('nennt den Liefertag mit Wochentag und die Sammelstelle', async () => {
    renderWithTheme(
      <BackingListClient initialDate={DATE} initialPickupPointId={POINT.id} />
    )

    expect(
      await screen.findByText(/Samstag, 12\.09\.2026 · Kindergarten Mörsbach/)
    ).toBeInTheDocument()
  })

  it('druckt das Blatt über den Browser', async () => {
    const user = userEvent.setup()
    const print = jest.fn()
    Object.defineProperty(window, 'print', { value: print, writable: true })

    renderWithTheme(
      <BackingListClient initialDate={DATE} initialPickupPointId={POINT.id} />
    )
    await user.click(await screen.findByRole('button', { name: 'Drucken' }))
    expect(print).toHaveBeenCalled()
  })

  // Der Admin-Bereich ist dunkel, und `TableCell` setzt seine Textfarbe
  // selbst. Ohne eine Regel, die auch die Zellen trifft, druckte das Blatt
  // weiß auf weiß - in der Backstube hinge dann nur die Überschrift.
  it('erzwingt im Druck schwarze Schrift bis in die Tabellenzellen', async () => {
    const { container } = renderWithTheme(
      <BackingListClient initialDate={DATE} initialPickupPointId={POINT.id} />
    )
    await screen.findByText('Bauernbrot')

    expect(container.querySelector('.backing-list-root')).not.toBeNull()
    // Emotion schreibt die Regeln je nach Modus in den Text des <style> oder
    // direkt ins CSSOM - beides einsammeln.
    const printCss = Array.from(document.querySelectorAll('style'))
      .map((style) => {
        const text = style.textContent ?? ''
        if (text) return text
        const sheet = (style as HTMLStyleElement).sheet
        return sheet
          ? Array.from(sheet.cssRules)
              .map((rule) => rule.cssText)
              .join('')
          : ''
      })
      .join('')
      .replace(/\s+/g, '')
    expect(printCss).toContain('.backing-list-root,.backing-list-root*')
    expect(printCss).toContain('color:#000!important')
    // AppBar, Navigation und Breadcrumb gehören nicht auf das Blatt.
    expect(printCss).toContain('.MuiAppBar-root')
  })

  it('sagt es, wenn für den Tag nichts vorbestellt ist', async () => {
    mockFetchSummary.mockResolvedValue({
      ...SUMMARY,
      count: 0,
      total: 0,
      open: 0,
      cancelled: 0,
      byProduct: [],
    })
    renderWithTheme(
      <BackingListClient initialDate={DATE} initialPickupPointId={POINT.id} />
    )

    await waitFor(() =>
      expect(mockFetchSummary).toHaveBeenCalledWith(DATE, POINT.id)
    )
    expect(
      await screen.findByText('Für diesen Tag ist nichts vorbestellt.')
    ).toBeInTheDocument()
  })

  it('zeigt die Fehlermeldung des Servers an', async () => {
    mockFetchSummary.mockRejectedValue(
      new Error(
        'Für die Backliste wird ein Datum im Format JJJJ-MM-TT gebraucht.'
      )
    )
    renderWithTheme(
      <BackingListClient initialDate={DATE} initialPickupPointId={POINT.id} />
    )

    expect(
      await screen.findByText(
        'Für die Backliste wird ein Datum im Format JJJJ-MM-TT gebraucht.'
      )
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Erneut versuchen' })
      ).toBeInTheDocument()
    )
  })
})
