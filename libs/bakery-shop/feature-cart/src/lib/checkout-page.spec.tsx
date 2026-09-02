/**
 * @fileoverview Die Kasse auf dem Telefon: getippte Angaben überleben den Weg
 * zum Warenkorb, die Abholzeiten sind dieselben, die die Prüfung annimmt, und
 * eine hängende Leitung blockiert die Bestellung nicht mehr für immer.
 */

import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import type { CartItem } from '@bakery/shared/contexts'

import { CheckoutPage } from './checkout-page'
import { CHECKOUT_FORM_STORAGE_KEY } from './checkout-validation'
import { OPENING_HOURS_ROWS, openingWindowFor, toIsoDate } from './pickup'

const mockPush = jest.fn()
const mockSubmitOrder = jest.fn()
const mockClearCart = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

let mockItems: CartItem[] = []

jest.mock('@bakery/shared/contexts', () => ({
  useCart: () => {
    const items = mockItems
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )
    return {
      items,
      summary: {
        totalCount: items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal,
        discount: 0,
        tax: 0,
        total: subtotal,
      },
      isLoading: false,
      clearCart: mockClearCart,
    }
  },
}))

jest.mock('@bakery/shared/data-access', () => ({
  ...jest.requireActual('@bakery/shared/data-access'),
  submitOrder: (...args: unknown[]) => mockSubmitOrder(...args),
}))

/** Eine Warenkorbzeile, so wie `toCartProduct()` sie wirklich anlegt. */
function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 1,
    createdAt: '',
    updatedAt: '',
    name: 'Kornbrot 500g',
    category: 'Brot',
    type: 'fresh',
    price: 2.5,
    unit: 'Stück',
    stock: 999,
    status: 'available',
    quantity: 2,
    ...overrides,
  } as CartItem
}

const wholeTorte = () =>
  ({
    ...line({
      id: 77,
      name: 'Schwarzwälder Kirschtorte',
      category: 'Torten',
      price: 45,
      quantity: 1,
    }),
    slug: 'schwarzwaelder-kirsch-torte',
  } as CartItem)

/**
 * Ein Datum weit genug in der Zukunft, dass keine Vorlaufzeit hineinredet —
 * und zwar auf dem gewünschten Wochentag (0 = Sonntag).
 */
function futureDateOn(weekday: number): string {
  const date = new Date()
  date.setDate(date.getDate() + 60)
  while (date.getDay() !== weekday) date.setDate(date.getDate() + 1)
  return toIsoDate(date)
}

const SUNDAY = futureDateOn(0)
const MONDAY = futureDateOn(1)
const TUESDAY = futureDateOn(2)

function optionsOf(select: HTMLElement): string[] {
  return Array.from(select.querySelectorAll('option')).map(
    (option) => (option as HTMLOptionElement).value
  )
}

function type(testId: string, value: string) {
  fireEvent.change(screen.getByTestId(testId), { target: { value } })
}

function fillValidForm() {
  type('customer-name', 'Erika Mustermann')
  type('customer-phone', '06841 123456')
  type('pickup-date', TUESDAY)
  type('pickup-time', '09:00')
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockClearCart.mockClear()
    mockSubmitOrder.mockReset()
    window.sessionStorage.clear()
    mockItems = [line()]
  })

  /* ------------------------------------------------------------------ */
  /* Abholzeiten                                                         */
  /* ------------------------------------------------------------------ */

  it('bietet ohne Datum keine Uhrzeit an', () => {
    render(<CheckoutPage />)

    // Vorher stand hier der volle Tagesbogen 05:30–13:00 — man konnte 06:00
    // wählen und danach einen Sonntag, an dem erst um 08:00 geöffnet ist.
    expect(optionsOf(screen.getByTestId('pickup-time'))).toEqual([''])
    expect(screen.getByTestId('pickup-time').textContent).toBe('Uhrzeit wählen')
  })

  it('bietet am Sonntag nur die Sonntagszeiten an', () => {
    render(<CheckoutPage />)
    type('pickup-date', SUNDAY)

    const slots = optionsOf(screen.getByTestId('pickup-time'))
    expect(slots).toContain('08:00')
    expect(slots).not.toContain('05:30')
    // Letzter Slot eine halbe Stunde vor Ladenschluss (11:00 Uhr).
    expect(slots[slots.length - 1]).toBe('10:30')
  })

  it('lässt am Ruhetag die volle Liste stehen — den Fehler trägt das Datum', () => {
    render(<CheckoutPage />)
    type('pickup-date', MONDAY)

    // Ein leeres Auswahlfeld wäre hier eine Sackgasse ohne Nutzen: die Uhrzeit
    // wird gar nicht mehr geprüft, abgelehnt wird der Montag.
    expect(optionsOf(screen.getByTestId('pickup-time')).length).toBeGreaterThan(
      1
    )
    fireEvent.click(screen.getByTestId('submit-order'))
    expect(screen.getByTestId('checkout-page').textContent).toContain(
      'ist Ruhetag'
    )
  })

  /* ------------------------------------------------------------------ */
  /* Vorbestellfrist                                                     */
  /* ------------------------------------------------------------------ */

  it('nennt die Vorbestellfrist und setzt sie als Minimum ins Datumsfeld', () => {
    mockItems = [wholeTorte()]
    render(<CheckoutPage />)

    const notice = screen.getByTestId('checkout-lead-time')
    expect(notice.textContent).toContain('Ganze Torten')

    const min = screen.getByTestId('pickup-date').getAttribute('min') as string
    expect(min).not.toBe('')
    // Zwei Tage Vorlauf, und niemals ein Ruhetag.
    expect(min > toIsoDate(new Date())).toBe(true)
    expect(openingWindowFor(min)).not.toBeNull()
  })

  it('lehnt ein Datum vor der Frist mit der Begründung der Regel ab', () => {
    mockItems = [wholeTorte()]
    render(<CheckoutPage />)

    type('customer-name', 'Erika Mustermann')
    type('customer-phone', '06841 123456')
    type('pickup-date', toIsoDate(new Date()))
    fireEvent.click(screen.getByTestId('submit-order'))

    expect(screen.getByTestId('checkout-page').textContent).toContain(
      'Frühester Termin:'
    )
    expect(mockSubmitOrder).not.toHaveBeenCalled()
  })

  it('schweigt über die Frist, solange nichts vorbestellt werden muss', () => {
    render(<CheckoutPage />)
    expect(screen.queryByTestId('checkout-lead-time')).toBeNull()
  })

  /* ------------------------------------------------------------------ */
  /* Getipptes überlebt den Seitenwechsel                                */
  /* ------------------------------------------------------------------ */

  it('legt das Getippte in die Session, damit „Ändern" es nicht wegwirft', () => {
    render(<CheckoutPage />)
    type('customer-name', 'Erika Mustermann')
    type('pickup-date', TUESDAY)

    const stored = JSON.parse(
      window.sessionStorage.getItem(CHECKOUT_FORM_STORAGE_KEY) as string
    )
    expect(stored.customerName).toBe('Erika Mustermann')
    expect(stored.pickupDate).toBe(TUESDAY)
  })

  it('holt die Angaben beim nächsten Aufruf zurück', () => {
    window.sessionStorage.setItem(
      CHECKOUT_FORM_STORAGE_KEY,
      JSON.stringify({
        customerName: 'Erika Mustermann',
        phone: '06841 123456',
        pickupDate: TUESDAY,
        pickupTime: '09:00',
      })
    )
    render(<CheckoutPage />)

    expect(
      (screen.getByTestId('customer-name') as HTMLInputElement).value
    ).toBe('Erika Mustermann')
    expect((screen.getByTestId('pickup-date') as HTMLInputElement).value).toBe(
      TUESDAY
    )
    expect((screen.getByTestId('pickup-time') as HTMLSelectElement).value).toBe(
      '09:00'
    )
  })

  it('räumt die Kontaktdaten weg, sobald die Bestellung durch ist', async () => {
    mockSubmitOrder.mockResolvedValue({ id: '8QMZ-QXS5-HM0W' })
    render(<CheckoutPage />)
    fillValidForm()

    fireEvent.click(screen.getByTestId('submit-order'))

    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(window.sessionStorage.getItem(CHECKOUT_FORM_STORAGE_KEY)).toBeNull()
    expect(mockClearCart).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/bestellung/8QMZ-QXS5-HM0W')
  })

  it('prüft die Abholzeit beim Absenden gegen die aktuelle Uhr, nicht die vom Öffnen', () => {
    jest.useFakeTimers()
    try {
      // Ein Dienstag, 07:00 Uhr: die Kasse bietet für heute ab 08:00 an.
      jest.setSystemTime(new Date(`${TUESDAY}T07:00:00`))
      render(<CheckoutPage />)
      type('customer-name', 'Erika Mustermann')
      type('customer-phone', '06841 123456')
      type('pickup-date', TUESDAY)
      expect(optionsOf(screen.getByTestId('pickup-time'))).toContain('08:00')
      type('pickup-time', '08:00')

      // Die Seite bleibt liegen; erst um 09:30 wird abgeschickt.
      jest.setSystemTime(new Date(`${TUESDAY}T09:30:00`))
      fireEvent.click(screen.getByTestId('submit-order'))

      expect(mockSubmitOrder).not.toHaveBeenCalled()
      expect(screen.getByTestId('checkout-page').textContent).toContain(
        'nicht mehr möglich'
      )
      // Und die Auswahl zeigt jetzt nur noch, was wirklich geht.
      expect(optionsOf(screen.getByTestId('pickup-time'))).not.toContain(
        '08:00'
      )
    } finally {
      jest.useRealTimers()
    }
  })

  /* ------------------------------------------------------------------ */
  /* Zeitlimit für den POST                                              */
  /* ------------------------------------------------------------------ */

  it('bricht nach 15 Sekunden ab, behält den Warenkorb und erklärt es deutsch', async () => {
    jest.useFakeTimers()
    try {
      // Eine Leitung, die nie antwortet.
      mockSubmitOrder.mockReturnValue(new Promise(() => undefined))
      render(<CheckoutPage />)
      fillValidForm()
      fireEvent.click(screen.getByTestId('submit-order'))

      await act(async () => {
        jest.advanceTimersByTime(15000)
      })

      const error = screen.getByTestId('checkout-error')
      expect(error.textContent).toContain('Die Verbindung ist zu langsam')
      // Der Warenkorb darf dabei auf keinen Fall verloren gehen.
      expect(mockClearCart).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
      expect(
        (screen.getByTestId('submit-order') as HTMLButtonElement).disabled
      ).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })

  /* ------------------------------------------------------------------ */
  /* Betrag und Allergene am Bestellknopf                                */
  /* ------------------------------------------------------------------ */

  it('zeigt den Betrag, den die Kundschaft bestätigt', () => {
    render(<CheckoutPage />)

    const total = screen.getAllByTestId('checkout-total')
    expect(total).toHaveLength(1)
    expect(total[0].textContent).toMatch(/^5,00\s€$/)
  })

  it('weist am Bestellknopf auf die Allergene hin — ohne Entwarnung', () => {
    render(<CheckoutPage />)

    const note = screen.getByTestId('checkout-allergen-note').textContent ?? ''
    expect(note).toContain('06841 2229')
    // Nur positive Aussagen. Ein „frei von" wäre für 51 Gebäcke ohne geprüfte
    // Angabe schlicht nicht belegt.
    expect(note).not.toMatch(/frei von|glutenfrei|laktosefrei|ohne Allergene/i)
  })

  it('leitet die Öffnungszeiten aus OPENING_HOURS_ROWS ab statt aus einem Literal', () => {
    render(<CheckoutPage />)

    // Vorher stand hier ein zweiter, handgeschriebener Öffnungszeiten-Satz.
    // Er stimmte zufällig — und wäre bei der nächsten Änderung an
    // WEEKDAY_HOURS stillschweigend falsch geworden.
    const text = screen.getByTestId('checkout-opening-hours').textContent ?? ''
    for (const row of OPENING_HOURS_ROWS) {
      expect(text).toContain(row.days)
      expect(text).toContain(row.time)
    }
    expect(text).not.toMatch(/Di–Fr|Sa 05:30/)
  })

  it('behält jede testid des Playwright-Vertrags', () => {
    render(<CheckoutPage />)

    for (const id of [
      'checkout-page',
      'customer-name',
      'customer-phone',
      'customer-email',
      'pickup-date',
      'pickup-time',
      'order-notes',
      'submit-order',
    ]) {
      expect(screen.queryByTestId(id)).not.toBeNull()
    }
  })
})
