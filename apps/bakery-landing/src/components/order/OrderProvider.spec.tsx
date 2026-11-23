import { fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { contactConfig } from '../../config/contact'
import {
  CART_STORAGE_KEY,
  emptyCart,
  saveCart,
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

function renderOrder() {
  render(
    <ThemeProvider theme={lightTheme}>
      <OrderProvider catalogue={[bread, unavailable]}>
        <AddToCartButton id={bread.id} />
        <AddToCartButton id={unavailable.id} />
      </OrderProvider>
    </ThemeProvider>
  )
}

beforeEach(() => {
  jest.replaceProperty(contactConfig.whatsapp, 'number', '15550100000')
})

afterEach(() => {
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
  saveCart({
    ...emptyCart(),
    items: [
      { id: bread.id, quantity: 1 },
      { id: unavailable.id, quantity: 1 },
      { id: 'altes-beispiel', quantity: 1 },
    ],
    expiresAt: Date.now() + 100_000,
  })
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
