import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider } from '@mui/material/styles'
import { lightTheme } from '../../../../theme'
import CashEntryForm from '../CashEntryForm'

// Mock implementation for the onSubmit prop
const mockOnSubmit = jest.fn()

// Wrapper component to provide theme
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>
)

describe('CashEntryForm', () => {
  beforeEach(() => {
    mockOnSubmit.mockClear()
  })

  it('renders correctly with all form elements', () => {
    render(
      <TestWrapper>
        <CashEntryForm onSubmit={mockOnSubmit} />
      </TestWrapper>
    )

    expect(screen.getByText('Täglichen Kassenstand eingeben')).toBeInTheDocument()
    expect(screen.getByLabelText('Kassenstand')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /kassenstand speichern/i })).toBeInTheDocument()
  })

  it('validates input correctly', async () => {
    render(
      <TestWrapper>
        <CashEntryForm onSubmit={mockOnSubmit} />
      </TestWrapper>
    )

    const input = screen.getByLabelText('Kassenstand')
    const submitButton = screen.getByRole('button', { name: /kassenstand speichern/i })

    // Test with empty input
    fireEvent.click(submitButton)

    // The submit button should be disabled when input is empty
    expect(submitButton).toBeDisabled()

    // Test with zero value
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Bitte geben Sie einen gültigen Betrag größer als 0 ein')).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('formats currency input correctly', () => {
    render(
      <TestWrapper>
        <CashEntryForm onSubmit={mockOnSubmit} />
      </TestWrapper>
    )

    const input = screen.getByLabelText('Kassenstand')

    // Test currency formatting
    fireEvent.change(input, { target: { value: '425.75' } })
    expect(input).toHaveValue('425.75')

    // Test removal of invalid characters
    fireEvent.change(input, { target: { value: '425abc.75' } })
    expect(input).toHaveValue('425.75')
  })

  it('shows confirmation for unusual amounts', async () => {
    render(
      <TestWrapper>
        <CashEntryForm onSubmit={mockOnSubmit} />
      </TestWrapper>
    )

    const input = screen.getByLabelText('Kassenstand')
    const submitButton = screen.getByRole('button', { name: /kassenstand speichern/i })

    // Enter unusual amount (very high)
    fireEvent.change(input, { target: { value: '1500' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/Der eingegebene Betrag.*weicht vom üblichen Bereich ab/)).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()

    // Confirm the submission
    const confirmButton = screen.getByRole('button', { name: /bestätigen/i })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(1500)
    })
  })

  it('submits valid amounts correctly', async () => {
    render(
      <TestWrapper>
        <CashEntryForm onSubmit={mockOnSubmit} />
      </TestWrapper>
    )

    const input = screen.getByLabelText('Kassenstand')
    const submitButton = screen.getByRole('button', { name: /kassenstand speichern/i })

    // Enter valid amount
    fireEvent.change(input, { target: { value: '425.75' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(425.75)
    })
  })

  it('clears form after successful submission', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined)

    render(
      <TestWrapper>
        <CashEntryForm onSubmit={mockOnSubmit} />
      </TestWrapper>
    )

    const input = screen.getByLabelText('Kassenstand')
    const submitButton = screen.getByRole('button', { name: /kassenstand speichern/i })

    fireEvent.change(input, { target: { value: '425.75' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })
})