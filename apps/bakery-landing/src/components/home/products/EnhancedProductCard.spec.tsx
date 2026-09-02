import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import Image from 'next/image'
import EnhancedProductCard from './EnhancedProductCard'

// test-setup.ts ersetzt next/image durch `() => null`. Hier brauchen wir die
// Props, die tatsächlich an next/image gehen: Die Dev-Warnungen hängen genau
// daran (`quality` ohne Eintrag in images.qualities, width/height nur
// einseitig per CSS verändert).
jest.mock('next/image', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}))

const ImageMock = Image as unknown as jest.Mock

const kornbrot = {
  id: 1,
  name: 'Kornbrot',
  category: 'Brot',
  price: 3.5,
  description: 'Kräftiges Brot aus dem Holzofen',
  image: '/assets/images/products/kornbrot.svg',
}

function lastImageProps() {
  expect(ImageMock).toHaveBeenCalled()
  return ImageMock.mock.calls[ImageMock.mock.calls.length - 1][0]
}

describe('EnhancedProductCard', () => {
  beforeEach(() => {
    ImageMock.mockClear()
  })

  it('zeigt Name und Preis und verlinkt auf die Detailseite', () => {
    renderWithTheme(<EnhancedProductCard {...kornbrot} />)

    expect(
      screen.getByRole('heading', { name: 'Kornbrot' })
    ).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/1')
    expect(screen.getByText(/3,50/)).toBeInTheDocument()
  })

  it('füllt den Bildrahmen per `fill` statt über width/height plus CSS', () => {
    renderWithTheme(<EnhancedProductCard {...kornbrot} />)

    const props = lastImageProps()
    expect(props.fill).toBe(true)
    expect(props.width).toBeUndefined()
    expect(props.height).toBeUndefined()
    expect(props.style).not.toHaveProperty('width')
    expect(props.style).not.toHaveProperty('height')
    expect(props.sizes).toEqual(expect.any(String))
    expect(props.alt).toBe('Bild von Kornbrot')
  })

  it('setzt kein quality - mit images.unoptimized wirkt es nicht', () => {
    renderWithTheme(<EnhancedProductCard {...kornbrot} />)

    expect(lastImageProps()).not.toHaveProperty('quality')
  })

  it('passt SVG-Grafiken ein und schneidet Fotos zu', () => {
    renderWithTheme(<EnhancedProductCard {...kornbrot} />)
    expect(lastImageProps().style.objectFit).toBe('contain')

    ImageMock.mockClear()
    renderWithTheme(
      <EnhancedProductCard
        {...kornbrot}
        id={2}
        image="/assets/images/products/erdbeertorte.jpg"
      />
    )
    expect(lastImageProps().style.objectFit).toBe('cover')
  })
})
