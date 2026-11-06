import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PreorderEntryClient from './PreorderEntryClient'
import {
  createPreorder,
  fetchCatalogue,
  fetchPickupPoints,
  fetchPreorderVariants,
  listPreorders,
} from '../../../../lib/preordersApi'
import {
  CATALOGUE,
  ONLY_DATE,
  POINT,
  preorder,
} from '../../../../lib/testing/preorderFixtures'

jest.mock('../../../../lib/preordersApi', () => ({
  ...jest.requireActual('../../../../lib/preordersApi'),
  createPreorder: jest.fn(),
  fetchCatalogue: jest.fn(),
  fetchPickupPoints: jest.fn(),
  fetchPreorderVariants: jest.fn(),
  listPreorders: jest.fn(),
}))

const mockCreate = createPreorder as jest.MockedFunction<typeof createPreorder>

// Donnerstag, 12.11.2026, 10 Uhr - nächster Backtag Fr 13.11., Sa 14.11.
const NOW = new Date(2026, 10, 12, 10, 0, 0)

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ONLY_DATE })
  mockCreate.mockReset()
  ;(fetchCatalogue as jest.Mock).mockResolvedValue(CATALOGUE)
  ;(fetchPickupPoints as jest.Mock).mockResolvedValue([POINT])
  ;(fetchPreorderVariants as jest.Mock).mockResolvedValue({
    configured: true,
    products: { mustersemmel: ['nuss', 'mohn'] },
  })
  ;(listPreorders as jest.Mock).mockResolvedValue([
    preorder(),
    preorder({ id: 9 }),
    preorder({
      id: 10,
      items: [
        {
          productId: 'musterweck',
          name: 'Musterweck',
          variant: '',
          unit: 'Stück',
          unitPrice: 0.5,
          quantity: 4,
          lineTotal: 2,
        },
      ],
    }),
  ])
  ;(window.localStorage.getItem as jest.Mock).mockReturnValue(null)
})

afterEach(() => {
  jest.useRealTimers()
})

async function ready() {
  renderWithTheme(<PreorderEntryClient />)
  const name = await screen.findByLabelText(/^Name/)
  await waitFor(() => expect(name).toHaveFocus())
  return name
}

describe('PreorderEntryClient (P1)', () => {
  it('erfasst per Tastatur: Name ↵ Telefon ↵ Produkt ↵ Menge ↵ Strg+↵', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue(
      preorder({ code: 'LA-2026-11-13-04', customerName: 'Erika Beispiel' })
    )
    await ready()

    await user.keyboard('Erika Beispiel{Enter}0170 1234567{Enter}')
    expect(screen.getByLabelText('Produkt suchen')).toHaveFocus()
    await user.keyboard('korn{Enter}')
    // Menge hat den Fokus, die erste Ziffer ersetzt die vorbelegte 1
    expect(screen.getByLabelText('Menge')).toHaveFocus()
    await user.keyboard('3{Enter}')

    const lines = screen.getByRole('list', { name: 'Positionen' })
    expect(within(lines).getByText('Kornbrot 500g')).toBeInTheDocument()
    expect(within(lines).getByText(/3 × 2,50\s€ = 7,50\s€/)).toBeInTheDocument()
    expect(screen.getByLabelText('Produkt suchen')).toHaveFocus()

    await user.keyboard('{Control>}{Enter}{/Control}')
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate).toHaveBeenCalledWith({
      channel: 'telefon',
      customerName: 'Erika Beispiel',
      customerPhone: '0170 1234567',
      pickupDate: '2026-11-13',
      pickupPointId: null,
      pickupTime: null,
      items: [{ productId: 'kornbrot-500g', variant: '', quantity: 3 }],
      paid: false,
      note: null,
    })

    expect(await screen.findByTestId('preorder-saved')).toHaveTextContent(
      'LA-2026-11-13-04'
    )
    const next = within(screen.getByTestId('preorder-saved')).getByRole(
      'button',
      { name: /Nächste Bestellung/ }
    )
    expect(next).toHaveFocus()
    expect(
      screen.getByText(/Vorbestellung LA-2026-11-13-04 gespeichert/)
    ).toBeInTheDocument()

    await user.click(next)
    expect(await screen.findByLabelText(/^Name/)).toHaveValue('')
    expect(screen.getByText('Noch keine Artikel.')).toBeInTheDocument()
  })

  it('verlangt bei Produkten mit Sorten eine Sorte; Ziffernblock für die Menge', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue(preorder())
    await ready()
    await user.type(screen.getByLabelText(/^Name/), 'Max Muster')

    await user.type(screen.getByLabelText('Produkt suchen'), 'semmel')
    await user.click(screen.getByRole('button', { name: /Mustersemmel/ }))

    const add = screen.getByRole('button', { name: 'Erst Sorte wählen' })
    expect(add).toBeDisabled()
    expect(
      screen.getByText('Für dieses Produkt muss eine Sorte gewählt werden.')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Nuss' }))
    expect(screen.getByRole('button', { name: 'Hinzufügen' })).toBe(add)
    const pad = screen.getByRole('group', { name: 'Ziffernblock Menge' })
    await user.click(within(pad).getByRole('button', { name: '1' }))
    await user.click(within(pad).getByRole('button', { name: '2' }))
    expect(screen.getByLabelText('Menge')).toHaveValue('12')
    await user.click(
      within(pad).getByRole('button', { name: 'Letzte Ziffer löschen' })
    )
    await user.click(within(pad).getByRole('button', { name: '0' }))
    expect(screen.getByLabelText('Menge')).toHaveValue('10')
    await user.click(add)

    expect(screen.getByText('Mustersemmel (Nuss)')).toBeInTheDocument()
    expect(screen.getByTestId('preorder-total')).toHaveTextContent('6,00')

    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ productId: 'mustersemmel', variant: 'nuss', quantity: 10 }],
        })
      )
    )
  })

  it('Sammelstelle: Kanal „Sammelstelle", nur Liefertage, keine Uhrzeit', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue(preorder())
    await ready()
    expect(screen.queryByRole('radio', { name: 'Sammelstelle' })).toBeNull()

    await user.click(screen.getByRole('radio', { name: POINT.name }))
    expect(screen.getByRole('radio', { name: 'Sammelstelle' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('radio', { name: 'Sa 14.11.' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.queryByLabelText('Uhrzeit (optional)')).toBeNull()
    expect(screen.getByText(/Übergabe 09:00-09:30 Uhr/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^Name/), 'Kita Kind')
    // Schnellknopf aus „häufig vorbestellt"
    const quick = screen.getByRole('group', { name: 'Häufig vorbestellt' })
    await user.click(
      within(quick).getByRole('button', { name: 'Kornbrot 500g' })
    )
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    await user.click(screen.getByRole('checkbox', { name: /bezahlt/i }))
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'sammelstelle',
          pickupPointId: POINT.id,
          pickupDate: '2026-11-14',
          pickupTime: null,
          paid: true,
          items: [{ productId: 'kornbrot-500g', variant: '', quantity: 1 }],
        })
      )
    )
  })

  it('lässt keinen Montag zu und speichert nichts Unvollständiges', async () => {
    const user = userEvent.setup()
    await ready()
    const date = screen.getByLabelText('Abholtag')
    fireEvent.change(date, { target: { value: '2026-11-16' } })
    expect(
      screen.getByText('Montag ist Ruhetag - bitte einen anderen Tag wählen.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /^Mo / })).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    expect(mockCreate).not.toHaveBeenCalled()
    expect(screen.getByText('Bitte den Namen eintragen.')).toBeInTheDocument()
    expect(
      screen.getByText('Bitte mindestens einen Artikel hinzufügen.')
    ).toBeInTheDocument()
  })

  it('zeigt die deutsche Meldung des Servers', async () => {
    const user = userEvent.setup()
    mockCreate.mockRejectedValue(
      Object.assign(new Error('„Mustersemmel" gibt es nicht in Sorten.'), {
        code: 'invalid_variant',
      })
    )
    await ready()
    await user.keyboard('Erika{Enter}{Enter}weck{Enter}{Enter}')
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    expect(
      await screen.findByText('„Mustersemmel" gibt es nicht in Sorten.')
    ).toBeInTheDocument()
  })
})
