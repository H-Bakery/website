import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import Hero from './Hero'

// Create a theme for testing
const theme = createTheme()

// Simple wrapper to provide theme context
function renderWithTheme(component: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  )
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

  it('renders title as h3 element', () => {
    renderWithTheme(<Hero {...defaultProps} />)

    const title = screen.getByText('Willkommen bei Bäckerei Heusser')
    expect(title.tagName).toBe('H3')
  })

  it('renders divider', () => {
    const { container } = renderWithTheme(<Hero {...defaultProps} />)

    const divider = container.querySelector('hr')
    expect(divider).toBeInTheDocument()
  })

  it('has proper container structure', () => {
    const { container } = renderWithTheme(<Hero {...defaultProps} />)

    const heroBox = container.firstChild
    expect(heroBox).toBeInTheDocument()
  })
})
