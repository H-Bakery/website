import { render, screen, fireEvent } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import CallToAction from './CallToAction'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('CallToAction Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const defaultProps = {
    title: 'Bestellen Sie jetzt',
    description: 'Frische Backwaren direkt zu Ihnen nach Hause',
    buttonText: 'Zum Shop',
    buttonLink: '/shop',
  }

  it('renders title and description', () => {
    renderWithTheme(<CallToAction {...defaultProps} />)

    expect(screen.getByText('Bestellen Sie jetzt')).toBeInTheDocument()
    expect(
      screen.getByText('Frische Backwaren direkt zu Ihnen nach Hause')
    ).toBeInTheDocument()
  })

  it('renders CTA button with correct text', () => {
    renderWithTheme(<CallToAction {...defaultProps} />)

    const button = screen.getByRole('button', { name: 'Zum Shop' })
    expect(button).toBeInTheDocument()
  })

  it('navigates to correct link on button click', () => {
    renderWithTheme(<CallToAction {...defaultProps} />)

    const button = screen.getByRole('button', { name: 'Zum Shop' })
    fireEvent.click(button)

    expect(mockPush).toHaveBeenCalledWith('/shop')
  })

  it('renders with secondary variant', () => {
    const propsWithVariant = {
      ...defaultProps,
      variant: 'secondary' as const,
    }

    const { container } = renderWithTheme(
      <CallToAction {...propsWithVariant} />
    )

    const ctaSection = container.querySelector('.cta-section')
    expect(ctaSection).toHaveClass('cta-secondary')
  })

  it('renders with custom background color', () => {
    const propsWithBg = {
      ...defaultProps,
      backgroundColor: '#f5f5f5',
    }

    const { container } = renderWithTheme(<CallToAction {...propsWithBg} />)

    const ctaSection = container.querySelector('.cta-section')
    expect(ctaSection).toHaveStyle('background-color: #f5f5f5')
  })

  it('renders with image when provided', () => {
    const propsWithImage = {
      ...defaultProps,
      image: '/images/fresh-bread.jpg',
      imageAlt: 'Frisches Brot',
    }

    renderWithTheme(<CallToAction {...propsWithImage} />)

    const image = screen.getByAltText('Frisches Brot')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', '/images/fresh-bread.jpg')
  })

  it('renders in full width when specified', () => {
    const propsFullWidth = {
      ...defaultProps,
      fullWidth: true,
    }

    const { container } = renderWithTheme(<CallToAction {...propsFullWidth} />)

    const ctaSection = container.querySelector('.cta-section')
    expect(ctaSection).toHaveClass('cta-full-width')
  })

  it('handles external links correctly', () => {
    const propsWithExternal = {
      ...defaultProps,
      buttonLink: 'https://external-site.com',
      isExternal: true,
    }

    renderWithTheme(<CallToAction {...propsWithExternal} />)

    const link = screen.getByRole('link', { name: 'Zum Shop' })
    expect(link).toHaveAttribute('href', 'https://external-site.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('supports multiple CTA buttons', () => {
    const propsWithMultiple = {
      ...defaultProps,
      secondaryButtonText: 'Mehr erfahren',
      secondaryButtonLink: '/about',
    }

    renderWithTheme(<CallToAction {...propsWithMultiple} />)

    expect(screen.getByRole('button', { name: 'Zum Shop' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Mehr erfahren' })
    ).toBeInTheDocument()
  })

  it('applies correct spacing and layout', () => {
    const { container } = renderWithTheme(<CallToAction {...defaultProps} />)

    const ctaSection = container.querySelector('.cta-section')
    expect(ctaSection).toHaveClass('cta-section')

    const content = container.querySelector('.cta-content')
    expect(content).toBeInTheDocument()
  })
})
