import React from 'react'
import { screen, fireEvent, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ProductListClient from './ProductListClient'
import type { ManagementProduct } from '../../../lib/products'
import { fakeSession, WithSession } from '../../../lib/testing/fakeSession'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin/products',
}))

const products: ManagementProduct[] = [
  {
    id: 'roggenbrot',
    name: 'Roggenbrot',
    category: 'Brot',
    categoryKey: 'brot',
    price: 4.5,
    status: 'active',
    image: null,
    rawImage: '',
    shortDescription: 'Kräftig',
    description: 'Kräftiges Roggenbrot aus eigenem Sauerteig.',
    pendingApproval: false,
    approved: null,
  },
  {
    id: 'stollen',
    name: 'Christstollen',
    category: 'Kuchen',
    categoryKey: 'kuchen',
    price: 12,
    status: 'seasonal',
    image: '/img/stollen.svg',
    rawImage: '/img/stollen.svg',
    shortDescription: '',
    description: '',
    pendingApproval: true,
    approved: { name: 'Christstollen', price: 11, status: 'seasonal' },
  },
  {
    id: 'altbrot',
    name: 'Altbrot',
    category: 'Brot',
    categoryKey: 'brot',
    price: 1,
    status: 'unavailable',
    image: null,
    rawImage: '',
    shortDescription: '',
    description: '',
    pendingApproval: false,
    approved: null,
  },
]

const row = (id: string) => screen.getByTestId(`product-row-${id}`)

describe('ProductListClient (admin/products)', () => {
  beforeEach(() => mockPush.mockClear())

  it('renders heading, statistics and product rows', () => {
    renderWithTheme(<ProductListClient products={products} />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Produkte' })
    ).toBeInTheDocument()
    expect(screen.getByText('Produktliste (3)')).toBeInTheDocument()
    expect(screen.getByText('Roggenbrot')).toBeInTheDocument()
    expect(screen.getByText('Christstollen')).toBeInTheDocument()
    // Deutsches Zahlformat (W4-Verifikation), nicht „4.50 €“.
    expect(screen.getByText(/^4,50\s€$/)).toBeInTheDocument()
    expect(screen.queryByText('4.50 €')).not.toBeInTheDocument()
    // Nur die Ausnahmen als Chip, der Normalfall als ruhiger Text.
    expect(within(row('roggenbrot')).getByText('Verfügbar')).toBeInTheDocument()
    expect(row('roggenbrot').querySelector('.MuiChip-root')).toBeNull()
    expect(
      screen.getByText('Saisonal', { selector: '.MuiChip-label' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Nicht verfügbar', { selector: '.MuiChip-label' })
    ).toBeInTheDocument()
  })

  it('navigates to edit page and to new-product page', () => {
    renderWithTheme(<ProductListClient products={products} />)
    fireEvent.click(screen.getByLabelText('Roggenbrot bearbeiten'))
    expect(mockPush).toHaveBeenCalledWith('/admin/products/roggenbrot')

    fireEvent.click(screen.getByRole('button', { name: /Neues Produkt/ }))
    expect(mockPush).toHaveBeenCalledWith('/admin/products/new')
  })

  it('shows an empty state when no products are available', () => {
    renderWithTheme(<ProductListClient products={[]} />)
    expect(screen.getByText('Keine Produkte gefunden.')).toBeInTheDocument()
    expect(screen.getByText('Produktliste (0)')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('Verkauf sieht die Liste nur lesend (F1)', () => {
    renderWithTheme(
      <WithSession value={fakeSession({ role: 'verkauf' })}>
        <ProductListClient products={products} />
      </WithSession>
    )
    expect(screen.getByText('Produktliste (3)')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Neues Produkt/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Roggenbrot bearbeiten' })
    ).not.toBeInTheDocument()
  })

  it('markiert wartende Änderungen mit „wartet auf Freigabe“ (F4)', () => {
    renderWithTheme(<ProductListClient products={products} />)
    const chips = screen.getAllByText('wartet auf Freigabe')
    expect(chips).toHaveLength(1)
    expect(row('stollen')).toContainElement(chips[0])
    expect(
      screen.getByText(/1 Änderung wartet auf Freigabe/)
    ).toBeInTheDocument()
  })

  it('Backstube oder Fahrer: kein Bearbeiten, nur der Inhaber schreibt (F4)', () => {
    renderWithTheme(
      <WithSession value={fakeSession({ role: 'backstube' })}>
        <ProductListClient products={products} />
      </WithSession>
    )
    expect(
      screen.queryByRole('button', { name: 'Roggenbrot bearbeiten' })
    ).not.toBeInTheDocument()
  })

  it('filtert nach Status - „Verfügbar“ zählt Saisonware mit wie das Dashboard', () => {
    renderWithTheme(<ProductListClient products={products} />)
    const filter = screen.getByRole('group', { name: 'Nach Status filtern' })
    expect(within(filter).getByText('Alle 3')).toBeInTheDocument()
    expect(within(filter).getByText('Verfügbar 2')).toBeInTheDocument()
    expect(within(filter).getByText('Saisonal 1')).toBeInTheDocument()
    expect(within(filter).getByText('Nicht verfügbar 1')).toBeInTheDocument()

    fireEvent.click(within(filter).getByText('Nicht verfügbar 1'))
    expect(screen.getByText('Produktliste (1 von 3)')).toBeInTheDocument()
    expect(screen.getByTestId('product-row-altbrot')).toBeInTheDocument()
    expect(screen.queryByTestId('product-row-roggenbrot')).toBeNull()
  })

  it('sucht im Namen', () => {
    renderWithTheme(<ProductListClient products={products} />)
    fireEvent.change(screen.getByLabelText('Produkt suchen'), {
      target: { value: 'stoll' },
    })
    expect(screen.getByText('Produktliste (1 von 3)')).toBeInTheDocument()
    expect(screen.getByTestId('product-row-stollen')).toBeInTheDocument()
  })
  describe('Preisliste', () => {
    const open = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Preisliste' }))

    it('Inhaber: Dialog mit Kategorien der Liste und Partner-Auswahl', () => {
      renderWithTheme(
        <WithSession value={fakeSession({ role: 'inhaber' })}>
          <ProductListClient products={products} />
        </WithSession>
      )
      open()
      const dialog = screen.getByRole('dialog', {
        name: 'Preisliste erstellen',
      })
      expect(
        within(dialog).getByRole('button', { name: 'Brot 2' })
      ).toBeInTheDocument()
      expect(
        within(dialog).getByRole('button', { name: 'Kuchen 1' })
      ).toBeInTheDocument()
      expect(
        within(dialog).getByLabelText('Verkaufspartner')
      ).toBeInTheDocument()
      // eine Änderung wartet auf Freigabe - die Liste zeigt sie noch nicht
      expect(
        within(dialog).getByText(/1 Änderung wartet auf Freigabe/)
      ).toBeInTheDocument()
    })

    it('Verkauf: Ladenliste ja, Partnerliste nein', () => {
      renderWithTheme(
        <WithSession value={fakeSession({ role: 'verkauf' })}>
          <ProductListClient products={products} />
        </WithSession>
      )
      open()
      const dialog = screen.getByRole('dialog', {
        name: 'Preisliste erstellen',
      })
      expect(
        within(dialog).queryByLabelText('Verkaufspartner')
      ).not.toBeInTheDocument()
    })

    it('Backstube: kein Knopf (die API antwortet 403)', () => {
      renderWithTheme(
        <WithSession value={fakeSession({ role: 'backstube' })}>
          <ProductListClient products={products} />
        </WithSession>
      )
      expect(
        screen.queryByRole('button', { name: 'Preisliste' })
      ).not.toBeInTheDocument()
    })
  })
})
