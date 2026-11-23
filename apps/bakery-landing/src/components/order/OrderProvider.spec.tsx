import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { contactConfig } from '../../config/contact'
import {
  CART_LIFETIME_MS,
  CART_STORAGE_KEY,
  emptyCart,
  writeCart,
} from '../../lib/order/cart-store'
import type { OrderProduct } from '../../lib/order/order-config'
import { lightTheme } from '../../theme/theme'
import { AddToCartButton } from './AddToCartButton'
import { OrderProvider } from './OrderProvider'

const bread: OrderProduct = {
  id: 'beispielbrot',
  name: 'Beispielbrot',
  category: 'brot',
  available: true,
  price: 2.4,
  image: null,
}
const unavailable: OrderProduct = {
  ...bread,
  id: 'beispielweck',
  name: 'Beispielweck',
  available: false,
}

function renderOrder(product = bread) {
  render(
    <ThemeProvider theme={lightTheme}>
      <OrderProvider catalogue={[product, unavailable]}>
        <main id="inhalt" tabIndex={-1}>
          <AddToCartButton id={bread.id} />
          <AddToCartButton id={unavailable.id} />
        </main>
      </OrderProvider>
    </ThemeProvider>
  )
}

beforeEach(() => {
  jest.replaceProperty(contactConfig.whatsapp, 'number', '15550100000')
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
  localStorage.clear()
})

it('bereitet bei gesperrtem Speicher eine Nachricht vor und behält den Korb nach dem Öffnen des Links', () => {
  jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('Speicher gesperrt', 'SecurityError')
  })
  renderOrder()
  expect(
    screen.queryByRole('button', { name: 'Beispielweck in den Korb' })
  ).not.toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', { name: 'Beispielbrot in den Korb' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Mehr Beispielbrot' }))
  expect(screen.getByRole('status')).toHaveTextContent(
    'Beispielbrot im Korb, 2 Stück'
  )

  fireEvent.click(screen.getByRole('button', { name: /2 Artikel.*Korb/ }))
  const sheet = within(screen.getByRole('dialog', { name: 'Ihr Korb' }))
  fireEvent.change(
    sheet.getByRole('textbox', { name: 'Notiz für Beispielbrot (optional)' }),
    { target: { value: 'geschnitten' } }
  )
  fireEvent.click(sheet.getByRole('button', { name: 'Abholung wählen' }))

  const days = within(sheet.getByRole('group', { name: 'Abholtag' }))
  const day = days
    .getAllByRole('button')
    .find((button) => button.getAttribute('aria-disabled') === 'false')
  if (!day) throw new Error('Kein Abholtag auswählbar')
  fireEvent.click(day)
  fireEvent.click(
    within(sheet.getByRole('group', { name: 'Abholzeit' })).getAllByRole(
      'button'
    )[0]
  )
  fireEvent.click(
    sheet.getByRole('button', { name: 'Weiter zu Ihren Angaben' })
  )
  fireEvent.change(sheet.getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Erika Beispielfrau' },
  })

  const send = sheet.getByRole('link', { name: 'Per WhatsApp senden' })
  const url = new URL(send.getAttribute('href') ?? '')
  expect(url.origin).toBe('https://wa.me')
  expect(url.searchParams.get('text')).toContain(
    '2× Beispielbrot – geschnitten'
  )
  expect(url.searchParams.get('text')).toContain('Name: Erika Beispielfrau')
  fireEvent.click(send)
  expect(
    sheet.getByRole('heading', { name: 'Nachricht abgeschickt?' })
  ).toBeInTheDocument()
  fireEvent.click(sheet.getByRole('button', { name: 'Zurück zum Korb' }))
  expect(
    sheet.getByRole('link', { name: 'Per WhatsApp senden' })
  ).toHaveAttribute('href', url.href)
})

it('blockiert einen alten Korb mit nicht mehr angebotenen Artikeln und lässt diese entfernen', () => {
  writeCart(
    {
      ...emptyCart(),
      items: [
        { id: bread.id, quantity: 1 },
        { id: unavailable.id, quantity: 1 },
        { id: 'altes-beispiel', quantity: 1 },
      ],
      expiresAt: Date.now() + 100_000,
    },
    null
  )
  renderOrder()

  fireEvent.click(screen.getByRole('button', { name: /3 Artikel.*Korb/ }))
  const sheet = within(screen.getByRole('dialog', { name: 'Ihr Korb' }))
  expect(sheet.getAllByText('Nicht mehr im Angebot')).toHaveLength(2)
  expect(sheet.getByRole('button', { name: 'Abholung wählen' })).toBeDisabled()
  fireEvent.click(sheet.getByRole('button', { name: 'Beispielweck entfernen' }))
  fireEvent.click(sheet.getByRole('button', { name: 'Artikel entfernen' }))
  expect(sheet.getByRole('button', { name: 'Abholung wählen' })).toBeEnabled()

  fireEvent.click(sheet.getByRole('button', { name: 'Angaben vergessen' }))
  expect(sheet.getByText('Ihr Korb ist leer.')).toBeInTheDocument()
  expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
})

function addBreadAndOpenCart() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Beispielbrot in den Korb' })
  )
  fireEvent.click(screen.getByRole('button', { name: /1 Artikel.*Korb/ }))
  return within(screen.getByRole('dialog', { name: 'Ihr Korb' }))
}

function choosePickup(
  sheet: ReturnType<typeof within>,
  date: RegExp,
  time: string
) {
  fireEvent.click(sheet.getByRole('button', { name: date }))
  fireEvent.click(sheet.getByRole('button', { name: `${time} Uhr` }))
  fireEvent.click(
    sheet.getByRole('button', { name: 'Weiter zu Ihren Angaben' })
  )
  fireEvent.change(sheet.getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Erika Beispielfrau' },
  })
}

const tuesdayMorning = new Date('2026-11-24T08:15:00Z')

it('zeigt bei fehlendem Einzelpreis im Dialog und in der Nachricht eine offene Summe', () => {
  jest.useFakeTimers({ now: tuesdayMorning })
  renderOrder({ ...bread, price: null })
  const sheet = addBreadAndOpenCart()
  expect(sheet.getByText(/Summe offen/)).toBeVisible()
  fireEvent.click(sheet.getByRole('button', { name: 'Abholung wählen' }))
  choosePickup(sheet, /Dienstag, 24\.11\.2026/, '10:30')
  const url = new URL(
    sheet
      .getByRole('link', { name: 'Per WhatsApp senden' })
      .getAttribute('href') ?? ''
  )
  expect(url.searchParams.get('text')).toContain(
    'Summe offen (bezahlt wird bei Abholung)'
  )
})

it('erklärt den heutigen Vorlauf und verlangt eine neue Auswahl, wenn eine Uhrzeit verfällt', () => {
  jest.useFakeTimers({ now: tuesdayMorning })
  renderOrder()
  const sheet = addBreadAndOpenCart()
  fireEvent.click(sheet.getByRole('button', { name: 'Abholung wählen' }))

  const today = /Dienstag, 24\.11\.2026/
  fireEvent.click(sheet.getByRole('button', { name: today }))
  expect(
    sheet.getByText('Heute ab 10:30 Uhr – wir brauchen 60 Minuten Vorlauf.')
  ).toBeVisible()
  expect(
    sheet.queryByRole('button', { name: '10:00 Uhr' })
  ).not.toBeInTheDocument()
  choosePickup(sheet, today, '10:30')
  expect(sheet.getByRole('link', { name: 'Per WhatsApp senden' })).toBeVisible()

  act(() => jest.advanceTimersByTime(15 * 60_000 + 15_000))
  expect(sheet.getByRole('alert')).toHaveTextContent(
    'Ihre gewählte Abholzeit ist nicht mehr verfügbar.'
  )
  expect(
    sheet.queryByRole('link', { name: 'Per WhatsApp senden' })
  ).not.toBeInTheDocument()

  fireEvent.click(sheet.getByRole('button', { name: 'Abholtermin neu wählen' }))
  expect(
    sheet.getByText('Heute ab 11:00 Uhr – wir brauchen 60 Minuten Vorlauf.')
  ).toBeVisible()
  expect(
    sheet.getByRole('button', { name: 'Weiter zu Ihren Angaben' })
  ).toBeDisabled()
  choosePickup(sheet, today, '11:00')
  expect(sheet.queryByRole('alert')).not.toBeInTheDocument()
  expect(sheet.getByRole('link', { name: 'Per WhatsApp senden' })).toBeVisible()
})

it('verwirft den Korb bei Ablauf auf einer offen gebliebenen Seite', () => {
  jest.useFakeTimers({ now: tuesdayMorning })
  writeCart(
    {
      ...emptyCart(),
      items: [{ id: bread.id, quantity: 1 }],
      expiresAt: Date.now() + 1000,
    },
    null
  )
  renderOrder()
  fireEvent.click(screen.getByRole('button', { name: /1 Artikel.*Korb/ }))
  const sheet = within(screen.getByRole('dialog', { name: 'Ihr Korb' }))

  act(() => jest.advanceTimersByTime(1000))
  expect(sheet.getByText(/Ihr Korb ist abgelaufen/)).toBeVisible()
  expect(sheet.getByText('Ihr Korb ist leer.')).toBeVisible()
  expect(
    JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '{}').items
  ).toEqual([])
})

it('verhindert Senden nach Ablauf auch solange der Timer noch nicht gelaufen ist', () => {
  jest.useFakeTimers({ now: tuesdayMorning })
  renderOrder()
  const sheet = addBreadAndOpenCart()
  fireEvent.click(sheet.getByRole('button', { name: 'Abholung wählen' }))
  choosePickup(sheet, /Dienstag, 24\.11\.2026/, '10:30')
  const send = sheet.getByRole('link', { name: 'Per WhatsApp senden' })

  jest.setSystemTime(Date.now() + CART_LIFETIME_MS)
  expect(fireEvent.click(send)).toBe(false)
  expect(sheet.getByText(/Ihr Korb ist abgelaufen/)).toBeVisible()
  expect(sheet.queryByText('Nachricht abgeschickt?')).not.toBeInTheDocument()
  expect(
    JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '{}')
  ).toMatchObject({
    items: [],
    expiresAt: 0,
    name: 'Erika Beispielfrau',
  })
})

it('erneuert bei einer Mengenänderung keinen bereits abgelaufenen Korb', () => {
  jest.useFakeTimers({ now: tuesdayMorning })
  renderOrder()
  fireEvent.click(
    screen.getByRole('button', { name: 'Beispielbrot in den Korb' })
  )
  jest.setSystemTime(Date.now() + CART_LIFETIME_MS)
  fireEvent.click(screen.getByRole('button', { name: 'Mehr Beispielbrot' }))
  expect(
    JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '{}')
  ).toMatchObject({
    items: [],
    expiresAt: 0,
  })

  fireEvent.click(
    screen.getByRole('button', { name: 'Beispielbrot in den Korb' })
  )
  expect(screen.getByRole('button', { name: /1 Artikel.*Korb/ })).toBeVisible()
})

it('kündigt die Mengenänderung im geöffneten Dialog an', () => {
  renderOrder()
  const sheet = addBreadAndOpenCart()
  const announcement = sheet.getByRole('status')
  expect(announcement).toHaveAttribute('aria-live', 'polite')
  fireEvent.click(sheet.getByRole('button', { name: 'Mehr Beispielbrot' }))
  expect(announcement).toHaveTextContent('Beispielbrot im Korb, 2 Stück')
})

it('übernimmt beim alten Ablauftimer den neueren Korb aus einem anderen Tab', () => {
  jest.useFakeTimers({ now: tuesdayMorning })
  const oldCart = {
    ...emptyCart(),
    items: [{ id: bread.id, quantity: 1 }],
    expiresAt: Date.now() + 1000,
    name: 'Erika Beispielfrau',
  }
  writeCart(oldCart, null)
  renderOrder()

  const newerCart = {
    ...oldCart,
    items: [{ id: bread.id, quantity: 3 }],
    expiresAt: Date.now() + CART_LIFETIME_MS,
    name: 'Alex Beispiel',
  }
  writeCart(newerCart, localStorage.getItem(CART_STORAGE_KEY))
  const saved = localStorage.getItem(CART_STORAGE_KEY)
  // Der Timer läuft vor der Zustellung des Storage-Events.
  act(() => jest.advanceTimersByTime(1000))
  expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(saved)
  expect(screen.getByRole('button', { name: /3 Artikel.*Korb/ })).toBeVisible()
})

it('stellt beim alten Ablauftimer keine in einem anderen Tab vergessenen Angaben wieder her', () => {
  jest.useFakeTimers({ now: tuesdayMorning })
  writeCart(
    {
      ...emptyCart(),
      items: [{ id: bread.id, quantity: 1 }],
      expiresAt: Date.now() + 1000,
      name: 'Erika Beispielfrau',
    },
    null
  )
  renderOrder()
  fireEvent.click(screen.getByRole('button', { name: /1 Artikel.*Korb/ }))
  const sheet = within(screen.getByRole('dialog', { name: 'Ihr Korb' }))
  writeCart(null, localStorage.getItem(CART_STORAGE_KEY))

  act(() => jest.advanceTimersByTime(1000))
  expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
  expect(sheet.getByText('Ihr Korb ist leer.')).toBeVisible()
  fireEvent.click(sheet.getByRole('button', { name: '3. Senden' }))
  expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('')
})

it('übernimmt den in einem anderen Tab geänderten Korb beim Storage-Event', () => {
  jest.useFakeTimers({ now: tuesdayMorning })
  renderOrder()
  const sheet = addBreadAndOpenCart()
  const oldValue = localStorage.getItem(CART_STORAGE_KEY)
  writeCart(
    {
      ...emptyCart(),
      items: [{ id: bread.id, quantity: 2 }],
      expiresAt: Date.now() + CART_LIFETIME_MS,
      name: 'Alex Beispiel',
    },
    oldValue
  )
  const newValue = localStorage.getItem(CART_STORAGE_KEY)

  fireEvent(
    window,
    new StorageEvent('storage', {
      key: CART_STORAGE_KEY,
      oldValue,
      newValue,
      storageArea: localStorage,
    })
  )
  expect(
    sheet.getByRole('group', { name: 'Menge für Beispielbrot' })
  ).toHaveTextContent('2')
  fireEvent.click(sheet.getByRole('button', { name: '3. Senden' }))
  expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue(
    'Alex Beispiel'
  )
  expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(newValue)
})

it('verwirft eine Eingabe auf einem veralteten Speicherstand, wenn ein anderer Tab die Angaben gelöscht hat', () => {
  jest.useFakeTimers({ now: tuesdayMorning })
  renderOrder()
  const sheet = addBreadAndOpenCart()
  fireEvent.click(sheet.getByRole('button', { name: 'Abholung wählen' }))
  choosePickup(sheet, /Dienstag, 24\.11\.2026/, '10:30')
  const oldInput = sheet.getByRole('textbox', { name: 'Name' })
  writeCart(null, localStorage.getItem(CART_STORAGE_KEY))

  fireEvent.change(oldInput, { target: { value: 'Erika Beispielfrau-Test' } })
  expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
  expect(sheet.getByText('Ihr Korb ist leer.')).toBeVisible()
  fireEvent.click(sheet.getByRole('button', { name: '3. Senden' }))
  expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('')
})

it('setzt den Fokus nach dem Leeren per Tastatur auf den Hauptinhalt', async () => {
  jest.useFakeTimers({ now: tuesdayMorning })
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
  renderOrder()
  await user.click(
    screen.getByRole('button', { name: 'Beispielbrot in den Korb' })
  )
  const opener = screen.getByRole('button', { name: /1 Artikel.*Korb/ })
  opener.focus()
  await user.keyboard('{Enter}')
  const sheet = within(screen.getByRole('dialog', { name: 'Ihr Korb' }))
  fireEvent.click(sheet.getByRole('button', { name: 'Abholung wählen' }))
  choosePickup(sheet, /Dienstag, 24\.11\.2026/, '10:30')
  sheet.getByRole('link', { name: 'Per WhatsApp senden' }).focus()
  await user.keyboard('{Enter}')
  await user.tab()
  expect(sheet.getByRole('button', { name: 'Korb leeren' })).toHaveFocus()
  await user.keyboard('{Enter}')
  act(() => jest.advanceTimersByTime(350))

  expect(opener).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('main')).toHaveFocus()
})
