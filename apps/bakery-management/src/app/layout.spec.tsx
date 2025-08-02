import { render, screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import RootLayout from './layout'

// Mock RootProvider
jest.mock('@bakery/shared/contexts', () => ({
  RootProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

describe('Management RootLayout', () => {
  it('renders children correctly', () => {
    render(
      <RootLayout>
        <div data-testid="test-child">Test Content</div>
      </RootLayout>
    )

    expect(screen.getByTestId('test-child')).toBeInTheDocument()
  })

  it('includes German language and metadata', () => {
    const metadata = require('./layout').metadata

    expect(metadata.title).toBe('Bäckerei Heusser - Management System')
    expect(metadata.description).toBe(
      'Verwaltungssystem für die Bäckerei Heusser - Bestellungen, Produktion und Verwaltung'
    )
    expect(metadata.icons).toBeDefined()
  })

  it('applies correct styles', () => {
    const { container } = render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>
    )

    const htmlElement = container.querySelector('html')
    expect(htmlElement).toHaveAttribute('lang', 'de')
  })
})
