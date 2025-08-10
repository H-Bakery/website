import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithTheme } from '@bakery/shared/test-utils'
import CashEntryForm from '../cash-entry-form'

// Mock implementation for the onSubmit prop
const mockOnSubmit = jest.fn()

describe('CashEntryForm', () => {
  beforeEach(() => {
    mockOnSubmit.mockClear()
  })

  it('renders correctly with all form elements', () => {
    renderWithTheme(<CashEntryForm onSubmit={mockOnSubmit} />)

    expect(
      screen.getByText('Täglichen Kassenstand eingeben')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Kassenstand')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /kassenstand speichern/i })
    ).toBeInTheDocument()
  })

  it('validates input correctly', async () => {
    renderWithTheme(<CashEntryForm onSubmit={mockOnSubmit} />)

    const input = screen.getByLabelText('Kassenstand')
    const submitButton = screen.getByRole('button', {
      name: /kassenstand speichern/i,
    })

    // Test with empty input
    fireEvent.click(submitButton)

    // The submit button should be disabled when input is empty
    expect(submitButton).toBeDisabled()

    // Test with zero value
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(
        screen.getByText(
          'Bitte geben Sie einen gültigen Betrag größer als 0 ein'
        )
      ).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('formats currency input correctly', () => {
    renderWithTheme(<CashEntryForm onSubmit={mockOnSubmit} />)

    const input = screen.getByLabelText('Kassenstand')

    // Test currency formatting
    fireEvent.change(input, { target: { value: '425.75' } })
    expect(input).toHaveValue('425.75')

    // Test removal of invalid characters
    fireEvent.change(input, { target: { value: '425abc.75' } })
    expect(input).toHaveValue('425.75')
  })

  it('shows confirmation for unusual amounts', async () => {
    renderWithTheme(<CashEntryForm onSubmit={mockOnSubmit} />)

    const input = screen.getByLabelText('Kassenstand')
    const submitButton = screen.getByRole('button', {
      name: /kassenstand speichern/i,
    })

    // Enter unusual amount (very high)
    fireEvent.change(input, { target: { value: '1500' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(
        screen.getByText(
          /Der eingegebene Betrag.*weicht vom üblichen Bereich ab/
        )
      ).toBeInTheDocument()
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
    renderWithTheme(<CashEntryForm onSubmit={mockOnSubmit} />)

    const input = screen.getByLabelText('Kassenstand')
    const submitButton = screen.getByRole('button', {
      name: /kassenstand speichern/i,
    })

    // Enter valid amount
    fireEvent.change(input, { target: { value: '425.75' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(425.75)
    })
  })

  it('clears form after successful submission', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined)

    renderWithTheme(<CashEntryForm onSubmit={mockOnSubmit} />)

    const input = screen.getByLabelText('Kassenstand')
    const submitButton = screen.getByRole('button', {
      name: /kassenstand speichern/i,
    })

    fireEvent.change(input, { target: { value: '425.75' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })
})
