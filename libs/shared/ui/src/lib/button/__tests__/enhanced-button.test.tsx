import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { EnhancedButton } from '../enhanced-button'

/**
 * Test suite for the EnhancedButton component
 * Tests enhanced features like animations, styles, and advanced props
 */
describe('EnhancedButton Component', () => {
  const theme = createTheme()

  const renderWithTheme = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
  }

  it('renders correctly with default props', () => {
    renderWithTheme(<EnhancedButton>Enhanced Button</EnhancedButton>)

    const button = screen.getByRole('button', { name: /enhanced button/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it('handles click events', () => {
    const handleClick = jest.fn()
    renderWithTheme(
      <EnhancedButton onClick={handleClick}>Clickable</EnhancedButton>
    )

    const button = screen.getByRole('button', { name: /clickable/i })
    fireEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('can be disabled', () => {
    renderWithTheme(<EnhancedButton disabled>Disabled Button</EnhancedButton>)

    const button = screen.getByRole('button', { name: /disabled button/i })
    expect(button).toBeDisabled()
  })

  it('supports different variants', () => {
    const { rerender } = renderWithTheme(
      <EnhancedButton variant="contained">Contained</EnhancedButton>
    )
    let button = screen.getByRole('button', { name: /contained/i })
    expect(button).toBeInTheDocument()

    rerender(
      <ThemeProvider theme={theme}>
        <EnhancedButton variant="outlined">Outlined</EnhancedButton>
      </ThemeProvider>
    )
    button = screen.getByRole('button', { name: /outlined/i })
    expect(button).toBeInTheDocument()

    rerender(
      <ThemeProvider theme={theme}>
        <EnhancedButton variant="text">Text</EnhancedButton>
      </ThemeProvider>
    )
    button = screen.getByRole('button', { name: /text/i })
    expect(button).toBeInTheDocument()
  })

  it('supports pulse animation prop', () => {
    renderWithTheme(<EnhancedButton pulse>Pulse Button</EnhancedButton>)

    const button = screen.getByRole('button', { name: /pulse button/i })
    expect(button).toBeInTheDocument()
    // Note: Testing CSS animations requires more complex setup with jsdom
  })

  it('supports shimmer effect prop', () => {
    renderWithTheme(<EnhancedButton shimmer>Shimmer Button</EnhancedButton>)

    const button = screen.getByRole('button', { name: /shimmer button/i })
    expect(button).toBeInTheDocument()
  })

  it('can disable shimmer effect', () => {
    renderWithTheme(<EnhancedButton shimmer={false}>No Shimmer</EnhancedButton>)

    const button = screen.getByRole('button', { name: /no shimmer/i })
    expect(button).toBeInTheDocument()
  })

  it('supports anchor-specific props', () => {
    renderWithTheme(
      <EnhancedButton
        href="https://example.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        External Link
      </EnhancedButton>
    )

    const linkButton = screen.getByRole('link', { name: /external link/i })
    expect(linkButton).toHaveAttribute('target', '_blank')
    expect(linkButton).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('supports different color variants', () => {
    renderWithTheme(
      <EnhancedButton color="success">Success Button</EnhancedButton>
    )

    const button = screen.getByRole('button', { name: /success button/i })
    expect(button).toBeInTheDocument()
  })

  it('can combine animation props', () => {
    renderWithTheme(
      <EnhancedButton pulse shimmer>
        Animated Button
      </EnhancedButton>
    )

    const button = screen.getByRole('button', { name: /animated button/i })
    expect(button).toBeInTheDocument()
  })
})
