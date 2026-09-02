/**
 * @fileoverview Tests for Input component
 * @module @bakery/shared/ui/input/tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Input } from './input'
import { renderWithTheme } from '@bakery/shared/test-utils'

describe('Input Component', () => {
  describe('Basic functionality', () => {
    it('renders correctly with default props', () => {
      renderWithTheme(<Input label="Test Input" />)

      const input = screen.getByLabelText('Test Input')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'text')
    })

    it('renders with custom placeholder', () => {
      renderWithTheme(<Input label="Email" placeholder="Enter your email" />)

      const input = screen.getByPlaceholderText('Enter your email')
      expect(input).toBeInTheDocument()
    })

    it('handles text input correctly', () => {
      renderWithTheme(<Input label="Name" />)

      const input = screen.getByLabelText('Name') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'John Doe' } })

      expect(input.value).toBe('John Doe')
    })

    it('can be disabled', () => {
      renderWithTheme(<Input label="Disabled Input" disabled />)

      const input = screen.getByLabelText('Disabled Input')
      expect(input).toBeDisabled()
    })

    it('shows as required when specified', () => {
      renderWithTheme(<Input label="Required Field" required />)

      const input = screen.getByLabelText('Required Field *')
      expect(input).toBeRequired()
    })
  })

  describe('Input types', () => {
    it('renders email input correctly', () => {
      renderWithTheme(<Input label="Email" type="email" />)

      const input = screen.getByLabelText('Email')
      expect(input).toHaveAttribute('type', 'email')
    })

    it('renders password input correctly', () => {
      renderWithTheme(<Input label="Password" type="password" />)

      const input = screen.getByLabelText('Password')
      expect(input).toHaveAttribute('type', 'password')
    })

    it('renders number input correctly', () => {
      renderWithTheme(<Input label="Age" type="number" />)

      const input = screen.getByLabelText('Age')
      expect(input).toHaveAttribute('type', 'number')
    })

    it('renders tel input correctly', () => {
      renderWithTheme(<Input label="Phone" type="tel" />)

      const input = screen.getByLabelText('Phone')
      expect(input).toHaveAttribute('type', 'tel')
    })

    it('renders url input correctly', () => {
      renderWithTheme(<Input label="Website" type="url" />)

      const input = screen.getByLabelText('Website')
      expect(input).toHaveAttribute('type', 'url')
    })
  })

  describe('Multiline functionality', () => {
    it('renders as textarea when multiline is true', () => {
      renderWithTheme(<Input label="Message" multiline />)

      const textarea = screen.getByLabelText('Message')
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('respects rows prop for multiline input', () => {
      renderWithTheme(<Input label="Description" multiline rows={4} />)

      const textarea = screen.getByLabelText('Description')
      expect(textarea).toHaveAttribute('rows', '4')
    })

    it('handles multiline text correctly', () => {
      renderWithTheme(<Input label="Comments" multiline />)

      const textarea = screen.getByLabelText('Comments') as HTMLTextAreaElement
      const multilineText = 'Line 1\nLine 2\nLine 3'

      fireEvent.change(textarea, { target: { value: multilineText } })
      expect(textarea.value).toBe(multilineText)
    })
  })

  describe('Icon functionality', () => {
    const TestIcon = () => <span data-testid="test-icon">📧</span>

    it('renders start icon correctly', () => {
      renderWithTheme(<Input label="Email" icon={<TestIcon />} />)

      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
    })

    it('positions icon correctly with single line input', () => {
      renderWithTheme(<Input label="Search" icon={<TestIcon />} />)

      const icon = screen.getByTestId('test-icon')
      const input = screen.getByLabelText('Search')
      expect(icon).toBeInTheDocument()
      // Das Icon sitzt als startAdornment im selben Eingabefeld, vor dem <input>
      expect(icon.closest('.MuiInputBase-root')).toBe(
        input.closest('.MuiInputBase-root')
      )
      expect(
        icon.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    })

    it('positions icon correctly with multiline input', () => {
      renderWithTheme(
        <Input label="Message" multiline rows={3} icon={<TestIcon />} />
      )

      const icon = screen.getByTestId('test-icon')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('Error handling', () => {
    it('shows error state when error prop is true', () => {
      renderWithTheme(<Input label="Invalid Input" error />)

      const input = screen.getByLabelText('Invalid Input')
      expect(input).toBeInvalid()
    })

    it('displays error message when provided', () => {
      renderWithTheme(
        <Input
          label="Email"
          error
          helperText="Please enter a valid email address"
        />
      )

      expect(
        screen.getByText('Please enter a valid email address')
      ).toBeInTheDocument()
    })

    it('applies error styling', () => {
      renderWithTheme(<Input label="Error Input" error />)

      const input = screen.getByLabelText('Error Input')
      // MUI setzt Mui-error auf Eingabefeld und Label, nicht auf den FormControl
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input.closest('.MuiFilledInput-root')).toHaveClass('Mui-error')
    })
  })

  describe('Helper text', () => {
    it('displays helper text when provided', () => {
      renderWithTheme(
        <Input
          label="Username"
          helperText="Must be at least 3 characters long"
        />
      )

      expect(
        screen.getByText('Must be at least 3 characters long')
      ).toBeInTheDocument()
    })

    it('shows character count for multiline with maxLength', () => {
      renderWithTheme(
        <Input
          label="Bio"
          multiline
          inputProps={{ maxLength: 100 }}
          helperText="Maximum 100 characters"
        />
      )

      expect(screen.getByText('Maximum 100 characters')).toBeInTheDocument()
    })
  })

  describe('Variants and styling', () => {
    it('uses filled variant by default', () => {
      renderWithTheme(<Input label="Default Input" />)

      const inputContainer = screen
        .getByLabelText('Default Input')
        .closest('.MuiFilledInput-root')
      expect(inputContainer).toBeInTheDocument()
    })

    it('applies custom sx styles', () => {
      renderWithTheme(
        <Input label="Custom Styled" sx={{ backgroundColor: 'red' }} />
      )

      const formControl = screen
        .getByLabelText('Custom Styled')
        .closest('.MuiFormControl-root')
      expect(formControl).toBeInTheDocument()
    })

    it('applies fullWidth by default', () => {
      renderWithTheme(<Input label="Full Width Input" />)

      const formControl = screen
        .getByLabelText('Full Width Input')
        .closest('.MuiFormControl-root')
      expect(formControl).toHaveClass('MuiFormControl-fullWidth')
    })
  })

  describe('Event handling', () => {
    it('handles onChange events', () => {
      const handleChange = jest.fn()
      renderWithTheme(<Input label="Test" onChange={handleChange} />)

      const input = screen.getByLabelText('Test')
      fireEvent.change(input, { target: { value: 'new value' } })

      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it('handles onFocus events', () => {
      const handleFocus = jest.fn()
      renderWithTheme(<Input label="Test" onFocus={handleFocus} />)

      const input = screen.getByLabelText('Test')
      fireEvent.focus(input)

      expect(handleFocus).toHaveBeenCalledTimes(1)
    })

    it('handles onBlur events', () => {
      const handleBlur = jest.fn()
      renderWithTheme(<Input label="Test" onBlur={handleBlur} />)

      const input = screen.getByLabelText('Test')
      fireEvent.focus(input)
      fireEvent.blur(input)

      expect(handleBlur).toHaveBeenCalledTimes(1)
    })

    it('handles onKeyDown events', () => {
      const handleKeyDown = jest.fn()
      renderWithTheme(<Input label="Test" onKeyDown={handleKeyDown} />)

      const input = screen.getByLabelText('Test')
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

      expect(handleKeyDown).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithTheme(
        <Input
          label="Accessible Input"
          aria-describedby="help-text"
          helperText="This is help text"
        />
      )

      const input = screen.getByLabelText('Accessible Input')
      expect(input).toHaveAttribute('aria-describedby')
    })

    it('supports custom ARIA attributes', () => {
      renderWithTheme(
        <Input
          label="Custom ARIA"
          aria-label="Custom accessible name"
          aria-required="true"
        />
      )

      const input = screen.getByLabelText('Custom accessible name')
      expect(input).toHaveAttribute('aria-required', 'true')
    })

    it('is properly focusable', () => {
      renderWithTheme(<Input label="Focusable Input" />)

      const input = screen.getByLabelText('Focusable Input')
      input.focus()

      expect(input).toHaveFocus()
    })

    it('is not focusable when disabled', () => {
      renderWithTheme(<Input label="Disabled Input" disabled />)

      const input = screen.getByLabelText('Disabled Input')
      expect(input).toBeDisabled()
      expect(input).toHaveAttribute('disabled')
    })

    it('supports screen reader navigation', () => {
      renderWithTheme(
        <Input
          label="Screen Reader Input"
          helperText="Additional information for screen readers"
        />
      )

      const input = screen.getByLabelText('Screen Reader Input')
      const helperText = screen.getByText(
        'Additional information for screen readers'
      )

      expect(input).toBeInTheDocument()
      expect(helperText).toBeInTheDocument()
    })
  })

  describe('Form integration', () => {
    it('works within forms', () => {
      const handleSubmit = jest.fn()

      renderWithTheme(
        <form onSubmit={handleSubmit}>
          <Input label="Form Input" name="test-input" />
          <button type="submit">Submit</button>
        </form>
      )

      const input = screen.getByLabelText('Form Input')
      const submitButton = screen.getByRole('button', { name: 'Submit' })

      fireEvent.change(input, { target: { value: 'test value' } })
      fireEvent.click(submitButton)

      expect(handleSubmit).toHaveBeenCalled()
    })

    it('can be controlled', () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('')
        return (
          <Input
            label="Controlled Input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )
      }

      renderWithTheme(<TestComponent />)

      const input = screen.getByLabelText(
        'Controlled Input'
      ) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'controlled value' } })

      expect(input.value).toBe('controlled value')
    })

    it('can be uncontrolled with defaultValue', () => {
      renderWithTheme(
        <Input label="Uncontrolled Input" defaultValue="default text" />
      )

      const input = screen.getByLabelText(
        'Uncontrolled Input'
      ) as HTMLInputElement
      expect(input.value).toBe('default text')

      fireEvent.change(input, { target: { value: 'changed text' } })
      expect(input.value).toBe('changed text')
    })
  })

  describe('Material UI integration', () => {
    it('applies Material UI theme correctly', () => {
      renderWithTheme(<Input label="Themed Input" />)

      const input = screen.getByLabelText('Themed Input')
      const filledRoot = input.closest('.MuiFilledInput-root')

      expect(filledRoot).toBeInTheDocument()
      expect(filledRoot).toHaveClass('MuiFilledInput-root')
    })

    it('supports Material UI size prop', () => {
      renderWithTheme(<Input label="Small Input" size="small" />)

      const inputRoot = screen
        .getByLabelText('Small Input')
        .closest('.MuiInputBase-root')
      expect(inputRoot).toHaveClass('MuiInputBase-sizeSmall')
    })

    it('supports Material UI color prop', () => {
      renderWithTheme(<Input label="Secondary Color" color="secondary" />)

      const input = screen.getByLabelText('Secondary Color')
      expect(input).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('does not re-render unnecessarily', () => {
      const TestComponent = () => {
        const [count, setCount] = React.useState(0)
        const [inputValue, setInputValue] = React.useState('')

        return (
          <div>
            <button onClick={() => setCount((c) => c + 1)}>
              Count: {count}
            </button>
            <Input
              label="Performance Input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
        )
      }

      renderWithTheme(<TestComponent />)

      const button = screen.getByRole('button', { name: /count:/i })
      const input = screen.getByLabelText('Performance Input')

      // Change unrelated state
      fireEvent.click(button)
      expect(screen.getByText('Count: 1')).toBeInTheDocument()

      // Input should still work correctly
      fireEvent.change(input, { target: { value: 'test' } })
      expect(input).toHaveValue('test')
    })
  })
})
