import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import BackingListClient, { pieceTotal } from './BackingListClient'
import {
  fetchPickupPoints,
  fetchPreorderDay,
  fetchPreorderSums,
} from '../../../../../lib/preordersApi'
import type {
  PickupPoint,
  PreorderDaySummary,
  PreorderSums,
} from '../../../../../lib/preordersTypes'

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

jest.mock('../../../../../lib/preordersApi', () => ({
  ...jest.requireActual('../../../../../lib/preordersApi'),
  fetchPickupPoints: jest.fn(),
  fetchPreorderDay: jest.fn(),
  fetchPreorderSums: jest.fn(),
}))

const mockFetchPickupPoints = fetchPickupPoints as jest.MockedFunction<
  typeof fetchPickupPoints
>
const mockFetchSummary = fetchPreorderSums as jest.MockedFunction<
  typeof fetchPreorderSums
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
}

/**
 * `GET /api/preorders/sums?date=&pickupPointId=` (W4): Summen je Produkt und
 * Sorte plus Kopfzahlen - ohne Namen und Telefonnummern.
 */
const SUMMARY: PreorderSums = {
  date: DATE,
  pickupPointId: POINT.id,
  preorderCount: 3,
  summary: {
    count: 3,
    total: 24.6,
    byStatus: { offen: 3, bereit: 0, abgeholt: 0, storniert: 1 },
    notCollected: 0,
    paid: 1,
    unpaidTotal: 16.4,
    byChannel: { sammelstelle: 3 },
  },
  items: [
    {
      productId: 'bauernbrot',
      variant: '',
      name: 'Bauernbrot',
      unit: 'Stück',
      quantity: 6,
      preorders: 2,
    },
    {
      productId: 'zopf-gefuellt',
      variant: 'nuss',
      name: 'Zopf gefüllt',
      unit: 'Stück',
      quantity: 24,
      preorders: 3,
    },
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
    // Die Abholliste mit Namen und Telefonnummern wird nicht geladen (W4).
    expect(fetchPreorderDay).not.toHaveBeenCalled()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    // Fuß der Liste: Anzahl, Stückzahl, Betrag und die stornierten daneben.
    expect(
      screen.getByText(
        /3 Vorbestellungen · 30 Stück · 24,60 € Summe · 16,40 € noch zu kassieren/
      )
    ).toBeInTheDocument()
    // Sorten stehen am Produkt (Füllung = Sorte).
    expect(screen.getByText('Zopf gefüllt (Nuss)')).toBeInTheDocument()
    expect(
      screen.getByText(/1 storniert \(nicht enthalten\)/)
    ).toBeInTheDocument()
  })

  it('älterer Server ohne Kopfzahlen: Menge und Anzahl trotzdem', async () => {
    const withoutSummary: PreorderSums = { ...SUMMARY }
    delete withoutSummary.summary
    mockFetchSummary.mockResolvedValue(withoutSummary)
    renderWithTheme(
      <BackingListClient initialDate={DATE} initialPickupPointId={POINT.id} />
    )
    expect(await screen.findByText('Bauernbrot')).toBeInTheDocument()
    expect(screen.getByText('3 Vorbestellungen · 30 Stück')).toBeInTheDocument()
  })

  it('nennt den Liefertag mit Wochentag und die Sammelstelle', async () => {
    renderWithTheme(
      <BackingListClient initialDate={DATE} initialPickupPointId={POINT.id} />
    )

    // Geschütztes Leerzeichen vor „·“: keine Zeile beginnt mit dem Punkt
    // (UI-Runde 1). Die Teile stehen in eigenen Spans.
    const subtitle = /Samstag, 12\.09\.2026\u00a0· Kindergarten Mörsbach/
    expect(
      await screen.findByText(
        (_content, el) =>
          subtitle.test(el?.textContent ?? '') &&
          Array.from(el?.children ?? []).every(
            (child) => !subtitle.test(child.textContent ?? '')
          )
      )
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
      summary: {
        ...(SUMMARY.summary as PreorderDaySummary),
        count: 0,
        total: 0,
        byStatus: { offen: 0, bereit: 0, abgeholt: 0, storniert: 0 },
      },
      items: [],
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

  it('sagt beim langsamen Laden „wird geladen“, nie „nichts vorbestellt“ (UI-Runde 2)', async () => {
    // Sammelstellen hängen (langsames WLAN): vorher stand die ganze Zeit
    // „Für diesen Tag ist nichts vorbestellt.“ - am vollen Samstag.
    let resolvePoints: (points: PickupPoint[]) => void = () => undefined
    mockFetchPickupPoints.mockReturnValue(
      new Promise<PickupPoint[]>((resolve) => {
        resolvePoints = resolve
      })
    )
    let resolveSums: (sums: PreorderSums) => void = () => undefined
    mockFetchSummary.mockReturnValue(
      new Promise<PreorderSums>((resolve) => {
        resolveSums = resolve
      })
    )
    renderWithTheme(<BackingListClient initialDate={DATE} />)

    expect(screen.getByText('Backliste wird geladen …')).toBeInTheDocument()
    expect(
      screen.queryByText('Für diesen Tag ist nichts vorbestellt.')
    ).not.toBeInTheDocument()

    resolvePoints([POINT])
    await waitFor(() =>
      expect(mockFetchSummary).toHaveBeenCalledWith(DATE, POINT.id)
    )
    expect(screen.getByText('Backliste wird geladen …')).toBeInTheDocument()
    expect(
      screen.queryByText('Für diesen Tag ist nichts vorbestellt.')
    ).not.toBeInTheDocument()

    resolveSums(SUMMARY)
    expect(
      await screen.findByRole('table', { name: 'Menge je Produkt' })
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Backliste wird geladen …')
    ).not.toBeInTheDocument()
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

describe('pieceTotal', () => {
  it('zählt Stück nur, wenn alle Zeilen in Stück sind', () => {
    expect(
      pieceTotal([
        { quantity: 12, unit: 'Stück' },
        { quantity: 3, unit: 'Stück' },
      ])
    ).toBe(15)
    // 12 Stück + 2 Blech sind keine „14 Stück“
    expect(
      pieceTotal([
        { quantity: 12, unit: 'Stück' },
        { quantity: 2, unit: 'Blech' },
      ])
    ).toBeNull()
  })
})
