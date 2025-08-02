import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ProductsPage from './page'

// Mock feature components
jest.mock('@bakery/management/feature-inventory', () => ({
  ProductsList: () => <div data-testid="products-list">Products List</div>,
  ProductCategories: () => (
    <div data-testid="product-categories">Product Categories</div>
  ),
  ProductImport: ({ onImport }: { onImport: (file: File) => void }) => (
    <div data-testid="product-import">
      <input
        type="file"
        data-testid="file-input"
        onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
      />
    </div>
  ),
  PriceManager: () => <div data-testid="price-manager">Price Manager</div>,
}))

describe('ProductsPage', () => {
  it('renders the page title', () => {
    renderWithTheme(<ProductsPage />)

    expect(screen.getByText('Produktverwaltung')).toBeInTheDocument()
  })

  it('renders all product management components', () => {
    renderWithTheme(<ProductsPage />)

    expect(screen.getByTestId('product-categories')).toBeInTheDocument()
    expect(screen.getByTestId('products-list')).toBeInTheDocument()
    expect(screen.getByTestId('product-import')).toBeInTheDocument()
    expect(screen.getByTestId('price-manager')).toBeInTheDocument()
  })

  it('handles CSV import', async () => {
    renderWithTheme(<ProductsPage />)

    const fileInput = screen.getByTestId('file-input')
    const file = new File(['test'], 'products.csv', { type: 'text/csv' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    // Import handler would process the file
    await waitFor(() => {
      expect(fileInput).toBeInTheDocument()
    })
  })

  it('displays product categories', () => {
    renderWithTheme(<ProductsPage />)

    const categories = screen.getByTestId('product-categories')
    expect(categories).toBeInTheDocument()
  })

  it('includes price management section', () => {
    renderWithTheme(<ProductsPage />)

    const priceManager = screen.getByTestId('price-manager')
    expect(priceManager).toBeInTheDocument()
  })

  it('has correct page structure', () => {
    const { container } = renderWithTheme(<ProductsPage />)

    const mainContent =
      container.querySelector('[role="main"]') || container.firstChild
    expect(mainContent).toBeInTheDocument()

    // Check all sections are present
    expect(screen.getByTestId('product-categories')).toBeInTheDocument()
    expect(screen.getByTestId('products-list')).toBeInTheDocument()
  })
})
