import { fireEvent, screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import Products from './index'
import { Product } from '../../../types/product'

const items: Product[] = [
  { id: 1, name: 'Bauernbrot', category: 'brot', price: 3.5 },
  { id: 2, name: 'Laugenbrezel', category: 'broetchen', price: 0.9 },
  { id: 3, name: 'Erdbeertorte', category: 'torten', price: 18 },
]

const search = () => screen.getByLabelText('Produkte suchen')

describe('Products search', () => {
  it('renders search field and sort select with controls enabled', () => {
    renderWithTheme(<Products items={items} showControls />)

    expect(search()).toBeInTheDocument()
    expect(screen.getByLabelText('Sortieren nach')).toBeInTheDocument()
    expect(screen.getByText('Bauernbrot')).toBeInTheDocument()
  })

  it('keeps the search field mounted when the search has no hits', () => {
    renderWithTheme(<Products items={items} showControls />)

    fireEvent.change(search(), { target: { value: 'Pizza' } })

    expect(screen.getByText('Keine Produkte gefunden')).toBeInTheDocument()
    expect(search()).toBeInTheDocument()
    expect(search()).toHaveValue('Pizza')
    expect(screen.getByLabelText('Sortieren nach')).toBeInTheDocument()
  })

  it('shows the products again after the search term is corrected', () => {
    renderWithTheme(<Products items={items} showControls />)

    fireEvent.change(search(), { target: { value: 'Pizza' } })
    expect(screen.queryByText('Bauernbrot')).not.toBeInTheDocument()

    fireEvent.change(search(), { target: { value: 'Brot' } })

    expect(screen.getByText('Bauernbrot')).toBeInTheDocument()
    expect(
      screen.queryByText('Keine Produkte gefunden')
    ).not.toBeInTheDocument()
  })

  it('offers "Suche zurücksetzen" in the empty state and clears the term', () => {
    renderWithTheme(<Products items={items} showControls />)

    fireEvent.change(search(), { target: { value: 'Pizza' } })
    fireEvent.click(screen.getByRole('button', { name: 'Suche zurücksetzen' }))

    expect(search()).toHaveValue('')
    expect(screen.getByText('Bauernbrot')).toBeInTheDocument()
    expect(screen.getByText('Laugenbrezel')).toBeInTheDocument()
    expect(screen.getByText('Erdbeertorte')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Suche zurücksetzen' })
    ).not.toBeInTheDocument()
  })

  it('clears the term via the X button inside the field', () => {
    renderWithTheme(<Products items={items} showControls />)

    expect(
      screen.queryByRole('button', { name: 'Suche löschen' })
    ).not.toBeInTheDocument()

    fireEvent.change(search(), { target: { value: 'Torte' } })
    expect(screen.getByText('Erdbeertorte')).toBeInTheDocument()
    expect(screen.queryByText('Bauernbrot')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Suche löschen' }))

    expect(search()).toHaveValue('')
    expect(screen.getByText('Bauernbrot')).toBeInTheDocument()
  })

  it('does not offer a reset when there are simply no products', () => {
    renderWithTheme(<Products items={[]} showControls />)

    expect(screen.getByText('Keine Produkte gefunden')).toBeInTheDocument()
    expect(search()).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Suche zurücksetzen' })
    ).not.toBeInTheDocument()
  })
})
