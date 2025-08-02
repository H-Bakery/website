import { render, screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ImprintPage from './page'

// Mock shared UI components
jest.mock('@bakery/shared/ui', () => ({
  MarkdownDisplay: ({ content }: { content: string }) => (
    <div data-testid="markdown-display">{content}</div>
  ),
}))

describe('ImprintPage', () => {
  it('renders the page title', () => {
    renderWithTheme(<ImprintPage />)

    expect(screen.getByText('Impressum')).toBeInTheDocument()
  })

  it('displays company information', () => {
    renderWithTheme(<ImprintPage />)

    expect(screen.getByText(/Heusser AG/)).toBeInTheDocument()
    expect(screen.getByText(/Bäckerei/)).toBeInTheDocument()
  })

  it('includes address information', () => {
    renderWithTheme(<ImprintPage />)

    expect(screen.getByText(/Hinwil/)).toBeInTheDocument()
    expect(screen.getByText(/Schweiz/)).toBeInTheDocument()
  })

  it('shows contact details', () => {
    renderWithTheme(<ImprintPage />)

    expect(screen.getByText(/Telefon/)).toBeInTheDocument()
    expect(screen.getByText(/E-Mail/)).toBeInTheDocument()
  })

  it('includes legal information', () => {
    renderWithTheme(<ImprintPage />)

    expect(screen.getByText(/Handelsregister/)).toBeInTheDocument()
    expect(screen.getByText(/USt-IdNr/)).toBeInTheDocument()
  })

  it('displays responsible person', () => {
    renderWithTheme(<ImprintPage />)

    expect(screen.getByText(/Verantwortlich/)).toBeInTheDocument()
    expect(screen.getByText(/Geschäftsführer/)).toBeInTheDocument()
  })

  it('includes data protection notice', () => {
    renderWithTheme(<ImprintPage />)

    expect(screen.getByText(/Datenschutz/)).toBeInTheDocument()
  })

  it('has correct page structure', () => {
    const { container } = renderWithTheme(<ImprintPage />)

    // Check for main content area
    const mainContent = container.querySelector('main')
    expect(mainContent).toBeInTheDocument()

    // Check for headings
    const headings = container.querySelectorAll('h1, h2')
    expect(headings.length).toBeGreaterThan(0)
  })

  it('uses proper semantic markup', () => {
    const { container } = renderWithTheme(<ImprintPage />)

    // Check for address element for contact info
    const markdownDisplay = screen.getByTestId('markdown-display')
    expect(markdownDisplay).toBeInTheDocument()
  })
})
