import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import UnsoldProductsForm from '../UnsoldProductsForm'
import bakeryAPI from '../../../../services/bakeryAPI'

// Mock the bakeryAPI
jest.mock('../../../../services/bakeryAPI', () => ({
  getProducts: jest.fn(),
}))

const mockBakeryAPI = bakeryAPI as jest.Mocked<typeof bakeryAPI>

const mockProducts = [
  { id: 1, name: 'Vollkornbrot', category: 'Brot', price: 3.50 },
  { id: 2, name: 'Croissant', category: 'Gebäck', price: 1.80 },
  { id: 3, name: 'Apfelkuchen', category: 'Kuchen', price: 2.50 },
]

describe('UnsoldProductsForm', () => {
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockBakeryAPI.getProducts.mockResolvedValue(mockProducts)
  })

  it('renders form elements correctly', async () => {
    render(<UnsoldProductsForm onSubmit={mockOnSubmit} />)

    expect(screen.getByText('Unverkaufte Produkte erfassen')).toBeInTheDocument()
    expect(screen.getByLabelText('Produkt auswählen')).toBeInTheDocument()
    expect(screen.getByLabelText('Anzahl unverkauft')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unverkaufte produkte speichern/i })).toBeInTheDocument()

    // Wait for products to load
    await waitFor(() => {
      expect(mockBakeryAPI.getProducts).toHaveBeenCalled()
    })
  })

  it('loads products on mount', async () => {
    render(<UnsoldProductsForm onSubmit={mockOnSubmit} />)

    await waitFor(() => {
      expect(mockBakeryAPI.getProducts).toHaveBeenCalled()
    })
  })

  it('disables submit button when form is incomplete', async () => {
    render(<UnsoldProductsForm onSubmit={mockOnSubmit} />)

    await waitFor(() => {
      expect(mockBakeryAPI.getProducts).toHaveBeenCalled()
    })

    const submitButton = screen.getByRole('button', { name: /unverkaufte produkte speichern/i })
    expect(submitButton).toBeDisabled()
  })

  it('validates quantity input to only accept numbers', async () => {
    render(<UnsoldProductsForm onSubmit={mockOnSubmit} />)

    await waitFor(() => {
      expect(mockBakeryAPI.getProducts).toHaveBeenCalled()
    })

    const quantityInput = screen.getByLabelText('Anzahl unverkauft')
    
    // Try to enter invalid characters
    fireEvent.change(quantityInput, { target: { value: 'abc' } })
    expect(quantityInput).toHaveValue('')

    fireEvent.change(quantityInput, { target: { value: '-5' } })
    expect(quantityInput).toHaveValue('')

    // Valid input should work
    fireEvent.change(quantityInput, { target: { value: '10' } })
    expect(quantityInput).toHaveValue('10')
  })

  it('shows confirmation dialog for unusually high quantities', async () => {
    render(<UnsoldProductsForm onSubmit={mockOnSubmit} />)

    await waitFor(() => {
      expect(mockBakeryAPI.getProducts).toHaveBeenCalled()
    })

    // Select a product by typing and selecting from autocomplete
    const productInput = screen.getByLabelText('Produkt auswählen')
    fireEvent.change(productInput, { target: { value: 'Vollkornbrot' } })
    fireEvent.keyDown(productInput, { key: 'ArrowDown' })
    fireEvent.keyDown(productInput, { key: 'Enter' })

    // Enter high quantity
    const quantityInput = screen.getByLabelText('Anzahl unverkauft')
    fireEvent.change(quantityInput, { target: { value: '100' } })

    // Submit form
    const submitButton = screen.getByRole('button', { name: /unverkaufte produkte speichern/i })
    fireEvent.click(submitButton)

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/ungewöhnlich hoch/i)).toBeInTheDocument()
    })
  })

  it('calls onSubmit when form is valid and submitted', async () => {
    mockOnSubmit.mockResolvedValue(undefined)
    render(<UnsoldProductsForm onSubmit={mockOnSubmit} />)

    await waitFor(() => {
      expect(mockBakeryAPI.getProducts).toHaveBeenCalled()
    })

    // Select a product
    const productInput = screen.getByLabelText('Produkt auswählen')
    fireEvent.change(productInput, { target: { value: 'Vollkornbrot' } })
    fireEvent.keyDown(productInput, { key: 'ArrowDown' })
    fireEvent.keyDown(productInput, { key: 'Enter' })

    // Enter quantity
    const quantityInput = screen.getByLabelText('Anzahl unverkauft')
    fireEvent.change(quantityInput, { target: { value: '5' } })

    // Submit form
    const submitButton = screen.getByRole('button', { name: /unverkaufte produkte speichern/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(1, 5)
    })
  })

  it('displays error when product loading fails', async () => {
    mockBakeryAPI.getProducts.mockRejectedValue(new Error('Failed to load products'))
    
    render(<UnsoldProductsForm onSubmit={mockOnSubmit} />)

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Laden der Produkte')).toBeInTheDocument()
    })
  })

  it('clears form after successful submission', async () => {
    mockOnSubmit.mockResolvedValue(undefined)
    render(<UnsoldProductsForm onSubmit={mockOnSubmit} />)

    await waitFor(() => {
      expect(mockBakeryAPI.getProducts).toHaveBeenCalled()
    })

    // Fill form
    const productInput = screen.getByLabelText('Produkt auswählen')
    fireEvent.change(productInput, { target: { value: 'Vollkornbrot' } })
    fireEvent.keyDown(productInput, { key: 'ArrowDown' })
    fireEvent.keyDown(productInput, { key: 'Enter' })

    const quantityInput = screen.getByLabelText('Anzahl unverkauft')
    fireEvent.change(quantityInput, { target: { value: '5' } })

    // Submit form
    const submitButton = screen.getByRole('button', { name: /unverkaufte produkte speichern/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled()
    })

    // Form should be cleared
    await waitFor(() => {
      expect(quantityInput).toHaveValue('')
    })
  })
})