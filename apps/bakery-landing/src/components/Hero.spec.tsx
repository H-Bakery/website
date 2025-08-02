import { render, screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import Hero from './Hero'

describe('Hero Component', () => {
  const defaultProps = {
    title: 'Willkommen bei Bäckerei Heusser',
    subtitle: 'Tradition seit 1891',
    backgroundImage: '/images/bakery-hero.jpg',
  }

  it('renders title and subtitle', () => {
    renderWithTheme(<Hero {...defaultProps} />)

    expect(
      screen.getByText('Willkommen bei Bäckerei Heusser')
    ).toBeInTheDocument()
    expect(screen.getByText('Tradition seit 1891')).toBeInTheDocument()
  })

  it('renders without subtitle', () => {
    const { subtitle, ...propsWithoutSubtitle } = defaultProps
    renderWithTheme(<Hero {...propsWithoutSubtitle} />)

    expect(
      screen.getByText('Willkommen bei Bäckerei Heusser')
    ).toBeInTheDocument()
    expect(screen.queryByText('Tradition seit 1891')).not.toBeInTheDocument()
  })

  it('renders CTA button when provided', () => {
    const propsWithCTA = {
      ...defaultProps,
      ctaText: 'Jetzt bestellen',
      ctaLink: '/shop',
    }

    renderWithTheme(<Hero {...propsWithCTA} />)

    const ctaButton = screen.getByText('Jetzt bestellen')
    expect(ctaButton).toBeInTheDocument()
    expect(ctaButton.closest('a')).toHaveAttribute('href', '/shop')
  })

  it('applies background image style', () => {
    const { container } = renderWithTheme(<Hero {...defaultProps} />)

    const heroSection = container.firstChild
    expect(heroSection).toHaveStyle(
      `background-image: url(${defaultProps.backgroundImage})`
    )
  })

  it('renders with custom height', () => {
    const propsWithHeight = {
      ...defaultProps,
      height: '600px',
    }

    const { container } = renderWithTheme(<Hero {...propsWithHeight} />)

    const heroSection = container.firstChild
    expect(heroSection).toHaveStyle('min-height: 600px')
  })

  it('applies overlay for better text visibility', () => {
    const { container } = renderWithTheme(<Hero {...defaultProps} />)

    // Check for overlay element
    const overlay = container.querySelector('.hero-overlay')
    expect(overlay).toBeInTheDocument()
  })

  it('centers content properly', () => {
    const { container } = renderWithTheme(<Hero {...defaultProps} />)

    const contentWrapper = container.querySelector('.hero-content')
    expect(contentWrapper).toHaveStyle('text-align: center')
  })

  it('is responsive', () => {
    const { container } = renderWithTheme(<Hero {...defaultProps} />)

    const heroSection = container.firstChild
    expect(heroSection).toHaveClass('hero-section')
  })
})
