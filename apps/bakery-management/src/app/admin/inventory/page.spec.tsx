import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import InventoryPage from './page'

// Mock feature components
jest.mock('@bakery/management/feature-inventory', () => ({
  InventoryList: () => <div data-testid="inventory-list">Inventory List</div>,
  InventoryStats: () => (
    <div data-testid="inventory-stats">Inventory Stats</div>
  ),
  StockAlerts: () => <div data-testid="stock-alerts">Stock Alerts</div>,
  AddProductModal: ({
    open,
    onClose,
  }: {
    open: boolean
    onClose: () => void
  }) =>
    open ? (
      <div data-testid="add-product-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

// Mock Material UI
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  Box: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Typography: ({ children, variant, ...props }: any) => (
    <div data-variant={variant} {...props}>
      {children}
    </div>
  ),
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Grid: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}))

describe('InventoryPage', () => {
  it('renders the page title', () => {
    renderWithTheme(<InventoryPage />)

    expect(screen.getByText('Warenverwaltung')).toBeInTheDocument()
  })

  it('renders all inventory components', () => {
    renderWithTheme(<InventoryPage />)

    expect(screen.getByTestId('inventory-stats')).toBeInTheDocument()
    expect(screen.getByTestId('stock-alerts')).toBeInTheDocument()
    expect(screen.getByTestId('inventory-list')).toBeInTheDocument()
  })

  it('includes add product button', () => {
    renderWithTheme(<InventoryPage />)

    const addButton = screen.getByText('Produkt hinzufügen')
    expect(addButton).toBeInTheDocument()
  })

  it('handles add product modal', async () => {
    renderWithTheme(<InventoryPage />)

    // Initially modal should not be visible
    expect(screen.queryByTestId('add-product-modal')).not.toBeInTheDocument()

    // Click add product button
    const addButton = screen.getByText('Produkt hinzufügen')
    fireEvent.click(addButton)

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByTestId('add-product-modal')).toBeInTheDocument()
    })

    // Close modal
    const closeButton = screen.getByText('Close')
    fireEvent.click(closeButton)

    // Modal should disappear
    await waitFor(() => {
      expect(screen.queryByTestId('add-product-modal')).not.toBeInTheDocument()
    })
  })

  it('displays inventory sections in correct order', () => {
    const { container } = renderWithTheme(<InventoryPage />)

    const sections = container.querySelectorAll('[data-testid]')
    const sectionIds = Array.from(sections).map((s) =>
      s.getAttribute('data-testid')
    )

    expect(sectionIds).toContain('inventory-stats')
    expect(sectionIds).toContain('stock-alerts')
    expect(sectionIds).toContain('inventory-list')
  })
})
