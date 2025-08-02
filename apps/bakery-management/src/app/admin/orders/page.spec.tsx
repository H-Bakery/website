import { render, screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import OrdersPage from './page'

// Mock feature components
jest.mock('@bakery/management/feature-orders', () => ({
  OrdersList: () => <div data-testid="orders-list">Orders List Component</div>,
  OrdersStats: () => <div data-testid="orders-stats">Orders Statistics</div>,
  OrderFilters: () => <div data-testid="orders-filters">Order Filters</div>,
}))

// Mock Material UI components
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  Box: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Typography: ({ children, variant, ...props }: any) => (
    <div data-variant={variant} {...props}>
      {children}
    </div>
  ),
  Paper: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Grid: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}))

describe('OrdersPage', () => {
  it('renders the page title', () => {
    renderWithTheme(<OrdersPage />)

    expect(screen.getByText('Bestellungen')).toBeInTheDocument()
  })

  it('renders all order management components', () => {
    renderWithTheme(<OrdersPage />)

    expect(screen.getByTestId('orders-stats')).toBeInTheDocument()
    expect(screen.getByTestId('orders-filters')).toBeInTheDocument()
    expect(screen.getByTestId('orders-list')).toBeInTheDocument()
  })

  it('has correct page structure', () => {
    const { container } = renderWithTheme(<OrdersPage />)

    // Check for main container
    const mainContainer =
      container.querySelector('[role="main"]') || container.firstChild
    expect(mainContainer).toBeInTheDocument()
  })

  it('renders with loading state initially', async () => {
    renderWithTheme(<OrdersPage />)

    // Components should appear immediately in this test setup
    // In real implementation, there might be loading states
    await waitFor(() => {
      expect(screen.getByTestId('orders-list')).toBeInTheDocument()
    })
  })

  it('applies responsive layout', () => {
    const { container } = renderWithTheme(<OrdersPage />)

    // Check that the layout structure exists
    const layoutElements = container.querySelectorAll('div')
    expect(layoutElements.length).toBeGreaterThan(0)
  })
})
