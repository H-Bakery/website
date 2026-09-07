import { render } from '@testing-library/react'
import { ProductThumb } from './product-thumb'

describe('ProductThumb', () => {
  it('zeigt ein brauchbares Bild', () => {
    const { container } = render(
      <ProductThumb src="/assets/images/products/brezel.svg" alt="Brezel" />
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/assets/images/products/brezel.svg'
    )
  })

  it('fragt den hq-Müllwert "images/" gar nicht erst an', () => {
    const { container } = render(<ProductThumb src="images/" alt="Schnecke" />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('kommt ohne Bild aus', () => {
    const { container } = render(<ProductThumb src={null} alt="Ohne" />)
    expect(container.querySelector('img')).toBeNull()
  })
})
