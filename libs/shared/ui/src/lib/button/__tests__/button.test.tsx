import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Button } from '../button'

/**
 * Test suite for the Button component
 * Tests basic button functionality, props, and Material UI integration
 */
describe('Button Component', () => {
  it('renders correctly with default props', () => {
    render(<Button>Click Me</Button>)

    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it('renders with custom className', () => {
    render(<Button className="custom-class">Custom Button</Button>)

    const button = screen.getByRole('button', { name: /custom button/i })
    expect(button).toHaveClass('custom-class')
  })

  it('handles click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Clickable</Button>)

    const button = screen.getByRole('button', { name: /clickable/i })
    fireEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('can be disabled', () => {
    render(<Button disabled>Disabled Button</Button>)

    const button = screen.getByRole('button', { name: /disabled button/i })
    expect(button).toBeDisabled()
  })

  it('renders as a link when href is provided', () => {
    render(<Button href="/some-path">Link Button</Button>)

    const linkButton = screen.getByRole('link', { name: /link button/i })
    expect(linkButton).toBeInTheDocument()
    expect(linkButton).toHaveAttribute('href', '/some-path')
  })

  it('applies different variants correctly', () => {
    const { rerender } = render(<Button variant="contained">Contained</Button>)
    let button = screen.getByRole('button', { name: /contained/i })
    expect(button).toBeInTheDocument()

    rerender(<Button variant="outlined">Outlined</Button>)
    button = screen.getByRole('button', { name: /outlined/i })
    expect(button).toBeInTheDocument()

    rerender(<Button variant="text">Text</Button>)
    button = screen.getByRole('button', { name: /text/i })
    expect(button).toBeInTheDocument()
  })

  it('supports anchor-specific props', () => {
    render(
      <Button
        href="https://example.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        External Link
      </Button>
    )

    const linkButton = screen.getByRole('link', { name: /external link/i })
    expect(linkButton).toHaveAttribute('target', '_blank')
    expect(linkButton).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
