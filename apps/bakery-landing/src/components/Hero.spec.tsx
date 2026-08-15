import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import Hero from './Hero'

// Create a theme for testing
const theme = createTheme()

// Simple wrapper to provide theme context
function renderWithTheme(component: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe('Hero Component', () => {
  const defaultProps = {
    title: 'Willkommen bei Bäckerei Heusser',
  }

  it('renders title', () => {
    renderWithTheme(<Hero {...defaultProps} />)

    expect(
      screen.getByText('Willkommen bei Bäckerei Heusser')
    ).toBeInTheDocument()
  })

  it('renders title as h1 element (page heading)', () => {
    renderWithTheme(<Hero {...defaultProps} />)

    const title = screen.getByRole('heading', { level: 1 })
    expect(title).toHaveTextContent('Willkommen bei Bäckerei Heusser')
  })

  it('renders divider', () => {
    const { container } = renderWithTheme(<Hero {...defaultProps} />)

    // Divider is a brand SVG ornament, not an <hr>
    const divider = container.querySelector('svg')
    expect(divider).toBeInTheDocument()
  })

  it('has proper container structure', () => {
    const { container } = renderWithTheme(<Hero {...defaultProps} />)

    const heroBox = container.firstChild
    expect(heroBox).toBeInTheDocument()
  })
})
