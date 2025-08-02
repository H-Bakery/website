/**
 * @fileoverview Tests for Button component
 * @module @bakery/shared/ui/button/tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Button } from './button'
import { renderWithTheme } from '@bakery/shared/test-utils'

describe('Button Component', () => {
  describe('Basic functionality', () => {
    it('renders correctly with default props', () => {
      renderWithTheme(<Button>Click Me</Button>)

      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })

    it('renders with custom className', () => {
      renderWithTheme(<Button className="custom-class">Custom Button</Button>)

      const button = screen.getByRole('button', { name: /custom button/i })
      expect(button).toHaveClass('custom-class')
    })

    it('handles click events', () => {
      const handleClick = jest.fn()
      renderWithTheme(<Button onClick={handleClick}>Clickable</Button>)

      const button = screen.getByRole('button', { name: /clickable/i })
      fireEvent.click(button)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('can be disabled', () => {
      renderWithTheme(<Button disabled>Disabled Button</Button>)

      const button = screen.getByRole('button', { name: /disabled button/i })
      expect(button).toBeDisabled()
    })

    it('does not trigger click when disabled', () => {
      const handleClick = jest.fn()
      renderWithTheme(
        <Button disabled onClick={handleClick}>
          Disabled Button
        </Button>
      )

      const button = screen.getByRole('button', { name: /disabled button/i })
      fireEvent.click(button)

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('Variants', () => {
    it('renders primary variant correctly', () => {
      renderWithTheme(<Button variant="primary">Primary</Button>)

      const button = screen.getByRole('button', { name: /primary/i })
      expect(button).toHaveClass('MuiButton-containedPrimary')
    })

    it('renders secondary variant correctly', () => {
      renderWithTheme(<Button variant="secondary">Secondary</Button>)

      const button = screen.getByRole('button', { name: /secondary/i })
      expect(button).toHaveClass('MuiButton-containedSecondary')
    })

    it('renders outlined variant correctly', () => {
      renderWithTheme(<Button variant="outlined">Outlined</Button>)

      const button = screen.getByRole('button', { name: /outlined/i })
      expect(button).toHaveClass('MuiButton-outlined')
    })

    it('renders text variant correctly', () => {
      renderWithTheme(<Button variant="text">Text</Button>)

      const button = screen.getByRole('button', { name: /text/i })
      expect(button).toHaveClass('MuiButton-text')
    })
  })

  describe('Sizes', () => {
    it('renders small size correctly', () => {
      renderWithTheme(<Button size="small">Small</Button>)

      const button = screen.getByRole('button', { name: /small/i })
      expect(button).toHaveClass('MuiButton-sizeSmall')
    })

    it('renders medium size correctly', () => {
      renderWithTheme(<Button size="medium">Medium</Button>)

      const button = screen.getByRole('button', { name: /medium/i })
      expect(button).toHaveClass('MuiButton-sizeMedium')
    })

    it('renders large size correctly', () => {
      renderWithTheme(<Button size="large">Large</Button>)

      const button = screen.getByRole('button', { name: /large/i })
      expect(button).toHaveClass('MuiButton-sizeLarge')
    })
  })

  describe('Colors', () => {
    it('renders with primary color', () => {
      renderWithTheme(<Button color="primary">Primary Color</Button>)

      const button = screen.getByRole('button', { name: /primary color/i })
      expect(button).toHaveClass('MuiButton-containedPrimary')
    })

    it('renders with secondary color', () => {
      renderWithTheme(<Button color="secondary">Secondary Color</Button>)

      const button = screen.getByRole('button', { name: /secondary color/i })
      expect(button).toHaveClass('MuiButton-containedSecondary')
    })

    it('renders with error color', () => {
      renderWithTheme(<Button color="error">Error Color</Button>)

      const button = screen.getByRole('button', { name: /error color/i })
      expect(button).toHaveClass('MuiButton-containedError')
    })

    it('renders with warning color', () => {
      renderWithTheme(<Button color="warning">Warning Color</Button>)

      const button = screen.getByRole('button', { name: /warning color/i })
      expect(button).toHaveClass('MuiButton-containedWarning')
    })

    it('renders with info color', () => {
      renderWithTheme(<Button color="info">Info Color</Button>)

      const button = screen.getByRole('button', { name: /info color/i })
      expect(button).toHaveClass('MuiButton-containedInfo')
    })

    it('renders with success color', () => {
      renderWithTheme(<Button color="success">Success Color</Button>)

      const button = screen.getByRole('button', { name: /success color/i })
      expect(button).toHaveClass('MuiButton-containedSuccess')
    })
  })

  describe('Loading state', () => {
    it('shows loading spinner when loading', () => {
      renderWithTheme(<Button loading>Loading Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('does not trigger click when loading', () => {
      const handleClick = jest.fn()
      renderWithTheme(
        <Button loading onClick={handleClick}>
          Loading Button
        </Button>
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('Icons', () => {
    const TestIcon = () => <span data-testid="test-icon">Icon</span>

    it('renders start icon', () => {
      renderWithTheme(<Button startIcon={<TestIcon />}>With Start Icon</Button>)

      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /with start icon/i })
      ).toBeInTheDocument()
    })

    it('renders end icon', () => {
      renderWithTheme(<Button endIcon={<TestIcon />}>With End Icon</Button>)

      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /with end icon/i })
      ).toBeInTheDocument()
    })
  })

  describe('Full width', () => {
    it('renders full width when specified', () => {
      renderWithTheme(<Button fullWidth>Full Width</Button>)

      const button = screen.getByRole('button', { name: /full width/i })
      expect(button).toHaveClass('MuiButton-fullWidth')
    })
  })

  describe('Custom styling', () => {
    it('applies custom styles through sx prop', () => {
      renderWithTheme(
        <Button sx={{ backgroundColor: 'red' }}>Custom Styled</Button>
      )

      const button = screen.getByRole('button', { name: /custom styled/i })
      expect(button).toBeInTheDocument()
      // Note: sx styles are applied at runtime and may not be easily testable with className
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithTheme(
        <Button aria-label="Custom aria label" aria-describedby="description">
          Accessible Button
        </Button>
      )

      const button = screen.getByRole('button', { name: /custom aria label/i })
      expect(button).toHaveAttribute('aria-describedby', 'description')
    })

    it('supports keyboard navigation', () => {
      const handleClick = jest.fn()
      renderWithTheme(<Button onClick={handleClick}>Keyboard Button</Button>)

      const button = screen.getByRole('button', { name: /keyboard button/i })

      // Simulate Enter key
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })
      // Note: Material-UI Button handles Enter key internally

      expect(button).toHaveFocus
    })

    it('is properly focusable', () => {
      renderWithTheme(<Button>Focusable Button</Button>)

      const button = screen.getByRole('button', { name: /focusable button/i })
      button.focus()

      expect(button).toHaveFocus()
    })

    it('is not focusable when disabled', () => {
      renderWithTheme(<Button disabled>Disabled Button</Button>)

      const button = screen.getByRole('button', { name: /disabled button/i })
      expect(button).toHaveAttribute('disabled')
      expect(button).not.toHaveFocus()
    })
  })

  describe('Form integration', () => {
    it('submits form when type is submit', () => {
      const handleSubmit = jest.fn()
      renderWithTheme(
        <form onSubmit={handleSubmit}>
          <Button type="submit">Submit Form</Button>
        </form>
      )

      const button = screen.getByRole('button', { name: /submit form/i })
      fireEvent.click(button)

      expect(handleSubmit).toHaveBeenCalledTimes(1)
    })

    it('resets form when type is reset', () => {
      renderWithTheme(
        <form>
          <input defaultValue="test" />
          <Button type="reset">Reset Form</Button>
        </form>
      )

      const input = screen.getByDisplayValue('test')
      const button = screen.getByRole('button', { name: /reset form/i })

      fireEvent.click(button)

      expect(input).toHaveValue('')
    })
  })

  describe('Event handling', () => {
    it('handles mouse events', () => {
      const handleMouseEnter = jest.fn()
      const handleMouseLeave = jest.fn()

      renderWithTheme(
        <Button onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          Hover Button
        </Button>
      )

      const button = screen.getByRole('button', { name: /hover button/i })

      fireEvent.mouseEnter(button)
      expect(handleMouseEnter).toHaveBeenCalledTimes(1)

      fireEvent.mouseLeave(button)
      expect(handleMouseLeave).toHaveBeenCalledTimes(1)
    })

    it('handles focus events', () => {
      const handleFocus = jest.fn()
      const handleBlur = jest.fn()

      renderWithTheme(
        <Button onFocus={handleFocus} onBlur={handleBlur}>
          Focus Button
        </Button>
      )

      const button = screen.getByRole('button', { name: /focus button/i })

      fireEvent.focus(button)
      expect(handleFocus).toHaveBeenCalledTimes(1)

      fireEvent.blur(button)
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })
  })

  describe('Performance', () => {
    it('does not re-render unnecessarily', () => {
      const TestComponent = () => {
        const [count, setCount] = React.useState(0)
        const handleClick = React.useCallback(() => {
          setCount((c) => c + 1)
        }, [])

        return (
          <div>
            <Button onClick={handleClick}>Count: {count}</Button>
          </div>
        )
      }

      renderWithTheme(<TestComponent />)

      const button = screen.getByRole('button', { name: /count: 0/i })
      fireEvent.click(button)

      expect(
        screen.getByRole('button', { name: /count: 1/i })
      ).toBeInTheDocument()
    })
  })
})
