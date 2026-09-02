import { screen, fireEvent } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import Products from './index'
import { Product } from '../../../types/product'

const makeProducts = (category: string, count: number): Product[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `${category} ${i + 1}`,
    category,
    price: 1 + i,
  }))

const productNames = () =>
  screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

describe('Products pagination', () => {
  const alle = makeProducts('Alle', 40) // 5 Seiten à 8 Produkte
  const baguette = makeProducts('Baguette', 5) // 1 Seite
  const brot = makeProducts('Brot', 20) // 3 Seiten

  it('paginates 8 products per page', () => {
    renderWithTheme(<Products items={alle} showControls />)

    expect(productNames()).toHaveLength(8)
    expect(screen.getByText('Alle 1')).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Produkt-Seitennavigation' })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Go to page 5' }))

    expect(productNames()).toEqual([
      'Alle 33',
      'Alle 34',
      'Alle 35',
      'Alle 36',
      'Alle 37',
      'Alle 38',
      'Alle 39',
      'Alle 40',
    ])
  })

  it('shows a single-page category from the first page after switching on page 5', () => {
    const { rerender } = renderWithTheme(<Products items={alle} showControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 5' }))
    expect(screen.getByText('Alle 33')).toBeInTheDocument()

    // Kategoriewechsel: Filter.tsx reicht eine neue Liste per setProducts herein
    rerender(<Products items={baguette} showControls />)

    expect(productNames()).toEqual([
      'Baguette 1',
      'Baguette 2',
      'Baguette 3',
      'Baguette 4',
      'Baguette 5',
    ])
    expect(
      screen.queryByText('Keine Produkte gefunden')
    ).not.toBeInTheDocument()
    // Eine Seite -> keine Seitennavigation nötig
    expect(
      screen.queryByRole('navigation', { name: 'Produkt-Seitennavigation' })
    ).not.toBeInTheDocument()
  })

  it('returns to page 1 of a multi-page category after switching on page 5', () => {
    const { rerender } = renderWithTheme(<Products items={alle} showControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 5' }))

    rerender(<Products items={brot} showControls />)

    expect(productNames()).toEqual([
      'Brot 1',
      'Brot 2',
      'Brot 3',
      'Brot 4',
      'Brot 5',
      'Brot 6',
      'Brot 7',
      'Brot 8',
    ])
    expect(screen.getByRole('button', { name: 'page 1' })).toHaveAttribute(
      'aria-current',
      'true'
    )
    expect(
      screen.getByRole('button', { name: 'Go to page 3' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Go to page 4' })
    ).not.toBeInTheDocument()
  })

  it('resets to page 1 when the search term changes', () => {
    renderWithTheme(<Products items={alle} showControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 5' }))

    fireEvent.change(screen.getByLabelText('Produkte suchen'), {
      target: { value: 'Alle 1' },
    })

    // "Alle 1", "Alle 10" .. "Alle 19" = 11 Treffer, 2 Seiten, Seite 1 aktiv
    expect(productNames()).toHaveLength(8)
    expect(screen.getByText('Alle 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'page 1' })).toHaveAttribute(
      'aria-current',
      'true'
    )
  })

  it('shows the empty message only when the list is really empty', () => {
    renderWithTheme(<Products items={[]} showControls />)

    expect(screen.getByText('Keine Produkte gefunden')).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Produkt-Seitennavigation' })
    ).not.toBeInTheDocument()
  })
})
