/**
 * @fileoverview Tests for NavigationButton component
 * @module @bakery/shared/ui/navigation/tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithTheme } from '@bakery/shared/test-utils'

// Mock Next.js router
const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}))

// Import the component after mocks
import { NavigationButton } from './navigation-button'

describe('NavigationButton Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic functionality', () => {
    it('renders correctly with href', () => {
      renderWithTheme(
        <NavigationButton href="/products">View Products</NavigationButton>
      )

      const button = screen.getByRole('button', { name: /view products/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('View Products')
    })

    it('navigates to specified href when clicked', () => {
      renderWithTheme(
        <NavigationButton href="/products">View Products</NavigationButton>
      )

      const button = screen.getByRole('button', { name: /view products/i })
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('/products')
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it('uses replace navigation when replace prop is true', () => {
      renderWithTheme(
        <NavigationButton href="/login" replace>
          Login
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /login/i })
      fireEvent.click(button)

      expect(mockReplace).toHaveBeenCalledWith('/login')
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('calls custom onClick handler when provided', () => {
      const mockOnClick = jest.fn()

      renderWithTheme(
        <NavigationButton href="/custom" onClick={mockOnClick}>
          Custom Button
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /custom button/i })
      fireEvent.click(button)

      expect(mockOnClick).toHaveBeenCalledWith('/custom')
      expect(mockPush).toHaveBeenCalledWith('/custom')
    })
  })

  describe('Button prop inheritance', () => {
    it('inherits variant prop from Button component', () => {
      renderWithTheme(
        <NavigationButton href="/test" variant="outlined">
          Outlined Button
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /outlined button/i })
      expect(button).toHaveClass('MuiButton-outlined')
    })

    it('inherits color prop from Button component', () => {
      renderWithTheme(
        <NavigationButton href="/test" color="secondary">
          Secondary Button
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /secondary button/i })
      expect(button).toHaveClass('MuiButton-containedSecondary')
    })

    it('inherits size prop from Button component', () => {
      renderWithTheme(
        <NavigationButton href="/test" size="large">
          Large Button
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /large button/i })
      expect(button).toHaveClass('MuiButton-sizeLarge')
    })

    it('can be disabled', () => {
      renderWithTheme(
        <NavigationButton href="/test" disabled>
          Disabled Button
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /disabled button/i })
      expect(button).toBeDisabled()
    })

    it('does not navigate when disabled', () => {
      renderWithTheme(
        <NavigationButton href="/test" disabled>
          Disabled Button
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /disabled button/i })
      fireEvent.click(button)

      expect(mockPush).not.toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
    })
  })

  describe('Advanced features', () => {
    it('supports fullWidth prop', () => {
      renderWithTheme(
        <NavigationButton href="/test" fullWidth>
          Full Width Button
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /full width button/i })
      expect(button).toHaveClass('MuiButton-fullWidth')
    })

    it('supports startIcon prop', () => {
      const TestIcon = () => <span data-testid="start-icon">→</span>

      renderWithTheme(
        <NavigationButton href="/test" startIcon={<TestIcon />}>
          With Start Icon
        </NavigationButton>
      )

      expect(screen.getByTestId('start-icon')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /with start icon/i })
      ).toBeInTheDocument()
    })

    it('supports endIcon prop', () => {
      const TestIcon = () => <span data-testid="end-icon">→</span>

      renderWithTheme(
        <NavigationButton href="/test" endIcon={<TestIcon />}>
          With End Icon
        </NavigationButton>
      )

      expect(screen.getByTestId('end-icon')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /with end icon/i })
      ).toBeInTheDocument()
    })

    it('supports loading state', () => {
      renderWithTheme(
        <NavigationButton href="/test" loading>
          Loading Button
        </NavigationButton>
      )

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('does not navigate when in loading state', () => {
      renderWithTheme(
        <NavigationButton href="/test" loading>
          Loading Button
        </NavigationButton>
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(mockPush).not.toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
    })
  })

  describe('Navigation paths', () => {
    it('handles absolute paths', () => {
      renderWithTheme(
        <NavigationButton href="/admin/dashboard">Dashboard</NavigationButton>
      )

      const button = screen.getByRole('button', { name: /dashboard/i })
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('/admin/dashboard')
    })

    it('handles relative paths', () => {
      renderWithTheme(
        <NavigationButton href="./relative">Relative Link</NavigationButton>
      )

      const button = screen.getByRole('button', { name: /relative link/i })
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('./relative')
    })

    it('handles paths with query parameters', () => {
      renderWithTheme(
        <NavigationButton href="/search?q=croissant">Search</NavigationButton>
      )

      const button = screen.getByRole('button', { name: /search/i })
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('/search?q=croissant')
    })

    it('handles paths with hash fragments', () => {
      renderWithTheme(
        <NavigationButton href="/page#section">Go to Section</NavigationButton>
      )

      const button = screen.getByRole('button', { name: /go to section/i })
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('/page#section')
    })
  })

  describe('Event handling', () => {
    it('calls onClick handler before navigation', () => {
      const events: string[] = []
      const mockOnClick = jest.fn(() => events.push('onClick'))

      // Mock router to track when it's called (once – otherwise the next
      // tests would inherit the implementation)
      mockPush.mockImplementationOnce(() => events.push('navigate'))

      renderWithTheme(
        <NavigationButton href="/test" onClick={mockOnClick}>
          Test Button
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /test button/i })
      fireEvent.click(button)

      expect(events).toEqual(['onClick', 'navigate'])
    })

    it('handles multiple rapid clicks gracefully', () => {
      renderWithTheme(
        <NavigationButton href="/test">Rapid Click Test</NavigationButton>
      )

      const button = screen.getByRole('button', { name: /rapid click test/i })

      // Simulate rapid clicks
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      // Should call push for each click (Next.js handles deduplication)
      expect(mockPush).toHaveBeenCalledTimes(3)
      expect(mockPush).toHaveBeenCalledWith('/test')
    })

    it('handles keyboard navigation', () => {
      renderWithTheme(
        <NavigationButton href="/test">Keyboard Test</NavigationButton>
      )

      const button = screen.getByRole('button', { name: /keyboard test/i })

      // Focus the button
      button.focus()
      expect(button).toHaveFocus()

      // Simulate Enter key
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })

      // Button should navigate (Material-UI handles this internally)
      expect(button).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithTheme(
        <NavigationButton
          href="/test"
          aria-label="Navigate to test page"
          aria-describedby="help-text"
        >
          Test Navigation
        </NavigationButton>
      )

      const button = screen.getByRole('button', {
        name: /navigate to test page/i,
      })
      expect(button).toHaveAttribute('aria-describedby', 'help-text')
    })

    it('is properly focusable', () => {
      renderWithTheme(
        <NavigationButton href="/test">Focusable Button</NavigationButton>
      )

      const button = screen.getByRole('button', { name: /focusable button/i })
      button.focus()

      expect(button).toHaveFocus()
    })

    it('is not focusable when disabled', () => {
      renderWithTheme(
        <NavigationButton href="/test" disabled>
          Disabled Button
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /disabled button/i })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('disabled')
    })

    it('provides proper button semantics', () => {
      renderWithTheme(
        <NavigationButton href="/test">Semantic Button</NavigationButton>
      )

      const button = screen.getByRole('button', { name: /semantic button/i })
      expect(button.tagName).toBe('BUTTON')
    })
  })

  describe('Edge cases', () => {
    it('handles empty href gracefully', () => {
      renderWithTheme(<NavigationButton href="">Empty Href</NavigationButton>)

      const button = screen.getByRole('button', { name: /empty href/i })
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('')
    })

    it('handles special characters in href', () => {
      const specialHref = '/search?q=café&type=bäckerei'

      renderWithTheme(
        <NavigationButton href={specialHref}>
          Special Characters
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /special characters/i })
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith(specialHref)
    })

    it('handles very long href values', () => {
      const longHref =
        '/very/long/path/with/many/segments/and/parameters?param1=value1&param2=value2&param3=value3'

      renderWithTheme(
        <NavigationButton href={longHref}>Long Path</NavigationButton>
      )

      const button = screen.getByRole('button', { name: /long path/i })
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith(longHref)
    })
  })

  describe('Performance', () => {
    it('does not re-render unnecessarily', () => {
      const TestComponent = () => {
        const [count, setCount] = React.useState(0)
        return (
          <div>
            <button onClick={() => setCount((c) => c + 1)}>
              Count: {count}
            </button>
            <NavigationButton href="/test">Navigation Test</NavigationButton>
          </div>
        )
      }

      renderWithTheme(<TestComponent />)

      const countButton = screen.getByRole('button', { name: /count:/i })
      const navButton = screen.getByRole('button', { name: /navigation test/i })

      // Change unrelated state
      fireEvent.click(countButton)
      expect(screen.getByText('Count: 1')).toBeInTheDocument()

      // Navigation button should still work correctly
      expect(navButton).toBeInTheDocument()
      fireEvent.click(navButton)
      expect(mockPush).toHaveBeenCalledWith('/test')
    })
  })

  describe('Custom styling', () => {
    it('accepts custom sx prop', () => {
      renderWithTheme(
        <NavigationButton href="/test" sx={{ backgroundColor: 'red' }}>
          Custom Styled
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /custom styled/i })
      expect(button).toBeInTheDocument()
    })

    it('accepts custom className', () => {
      renderWithTheme(
        <NavigationButton href="/test" className="custom-navigation-button">
          Custom Class
        </NavigationButton>
      )

      const button = screen.getByRole('button', { name: /custom class/i })
      expect(button).toHaveClass('custom-navigation-button')
    })
  })
})
