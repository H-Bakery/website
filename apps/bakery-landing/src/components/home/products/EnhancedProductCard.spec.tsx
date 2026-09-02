import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import EnhancedProductCard from './EnhancedProductCard'
import { Product } from '../../../types/product'

// Beispielprodukt wie aus hq/products/*.md geladen: dort gibt es keine
// Bewertungen, also darf die Karte auch keine anzeigen.
const product: Product = {
  id: 11,
  name: 'Kornbrot 500g',
  category: 'brot',
  price: 3.2,
  description: 'Kräftiges Roggenmischbrot aus dem Holzofen.',
}

describe('EnhancedProductCard', () => {
  it('zeigt Name, Beschreibung, Kategorie und Preis', () => {
    renderWithTheme(<EnhancedProductCard {...product} />)

    expect(
      screen.getByRole('heading', { name: 'Kornbrot 500g' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Kräftiges Roggenmischbrot aus dem Holzofen.')
    ).toBeInTheDocument()
    expect(screen.getByText('brot')).toBeInTheDocument()
    expect(screen.getByText(/3,20\s?€/)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/11')
  })

  it('zeigt keine erfundenen Sterne oder Rezensionszahlen', () => {
    renderWithTheme(<EnhancedProductCard {...product} />)

    // MUI <Rating readOnly> rendert <span role="img" aria-label="4.5 Stars">.
    // Frueher stand hier 4 + (id % 10) / 10 Sterne und "(10 + id % 40)" als
    // Rezensionszahl - fuer id 11 also "4.1 Sterne, (11)".
    expect(screen.queryByRole('img', { name: /stars/i })).toBeNull()
    expect(document.querySelector('.MuiRating-root')).toBeNull()
    expect(screen.queryByText(/^\(\d+\)$/)).toBeNull()
  })
})
