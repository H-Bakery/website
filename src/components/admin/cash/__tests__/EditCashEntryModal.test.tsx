import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider } from '@mui/material/styles'
import { lightTheme } from '../../../../theme'
import EditCashEntryModal from '../EditCashEntryModal'
import { CashEntry } from '../../../../services/types'

// Mock implementation for the onUpdate prop
const mockOnUpdate = jest.fn()
const mockOnClose = jest.fn()

// Wrapper component to provide theme
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>
)

const mockCashEntry: CashEntry = {
  id: 1,
  UserId: 1,
  amount: 425.75,
  date: '2024-01-15',
  createdAt: '2024-01-15T20:30:00.000Z',
  updatedAt: '2024-01-15T20:30:00.000Z'
}

describe('EditCashEntryModal', () => {
  beforeEach(() => {
    mockOnUpdate.mockClear()
    mockOnClose.mockClear()
  })

  it('renders correctly when open with entry data', () => {
    render(
      <TestWrapper>
        <EditCashEntryModal
          open={true}
          entry={mockCashEntry}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      </TestWrapper>
    )

    expect(screen.getByText('Kassenstand bearbeiten')).toBeInTheDocument()
    expect(screen.getByDisplayValue('425.75')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2024-01-15')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <TestWrapper>
        <EditCashEntryModal
          open={false}
          entry={mockCashEntry}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      </TestWrapper>
    )

    expect(screen.queryByText('Kassenstand bearbeiten')).not.toBeInTheDocument()
  })

  it('validates amount input correctly', async () => {
    render(
      <TestWrapper>
        <EditCashEntryModal
          open={true}
          entry={mockCashEntry}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      </TestWrapper>
    )

    const amountInput = screen.getByLabelText('Betrag')
    const submitButton = screen.getByRole('button', { name: /änderungen speichern/i })

    // Test with valid amount - should call onUpdate
    fireEvent.change(amountInput, { target: { value: '100.50' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(1, 100.50, '2024-01-15')
    })

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('validates date input correctly', async () => {
    render(
      <TestWrapper>
        <EditCashEntryModal
          open={true}
          entry={mockCashEntry}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      </TestWrapper>
    )

    const dateInput = screen.getByLabelText('Datum')
    const submitButton = screen.getByRole('button', { name: /änderungen speichern/i })

    // Test with empty date
    fireEvent.change(dateInput, { target: { value: '' } })
    
    // Change amount to enable submit button
    const amountInput = screen.getByLabelText('Betrag')
    fireEvent.change(amountInput, { target: { value: '100' } })
    
    fireEvent.click(submitButton)

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Bitte wählen Sie ein Datum')
    })

    expect(mockOnUpdate).not.toHaveBeenCalled()
  })

  it('formats currency input correctly', () => {
    render(
      <TestWrapper>
        <EditCashEntryModal
          open={true}
          entry={mockCashEntry}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      </TestWrapper>
    )

    const amountInput = screen.getByLabelText('Betrag')

    // Test currency formatting
    fireEvent.change(amountInput, { target: { value: '500.50' } })
    expect(amountInput).toHaveValue('500.50')

    // Test removal of invalid characters
    fireEvent.change(amountInput, { target: { value: '500abc.50' } })
    expect(amountInput).toHaveValue('500.50')
  })

  it('submits valid changes correctly', async () => {
    mockOnUpdate.mockResolvedValueOnce(undefined)

    render(
      <TestWrapper>
        <EditCashEntryModal
          open={true}
          entry={mockCashEntry}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      </TestWrapper>
    )

    const amountInput = screen.getByLabelText('Betrag')
    const dateInput = screen.getByLabelText('Datum')
    const submitButton = screen.getByRole('button', { name: /änderungen speichern/i })

    // Make changes
    fireEvent.change(amountInput, { target: { value: '500.00' } })
    fireEvent.change(dateInput, { target: { value: '2024-01-14' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(1, 500.00, '2024-01-14')
    })

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('disables submit button when no changes are made', () => {
    render(
      <TestWrapper>
        <EditCashEntryModal
          open={true}
          entry={mockCashEntry}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      </TestWrapper>
    )

    const submitButton = screen.getByRole('button', { name: /änderungen speichern/i })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit button when changes are made', () => {
    render(
      <TestWrapper>
        <EditCashEntryModal
          open={true}
          entry={mockCashEntry}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      </TestWrapper>
    )

    const amountInput = screen.getByLabelText('Betrag')
    const submitButton = screen.getByRole('button', { name: /änderungen speichern/i })

    fireEvent.change(amountInput, { target: { value: '500.00' } })
    expect(submitButton).not.toBeDisabled()
  })

  it('handles cancel correctly', () => {
    render(
      <TestWrapper>
        <EditCashEntryModal
          open={true}
          entry={mockCashEntry}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      </TestWrapper>
    )

    const cancelButton = screen.getByRole('button', { name: /abbrechen/i })
    fireEvent.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalled()
    expect(mockOnUpdate).not.toHaveBeenCalled()
  })
})