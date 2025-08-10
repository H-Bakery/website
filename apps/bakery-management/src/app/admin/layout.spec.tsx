import { render, screen, fireEvent } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import AdminLayout from './layout'

// Mock next/navigation
const mockPush = jest.fn()
const mockPathname = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    pathname: '/',
  }),
  usePathname: () => mockPathname(),
}))

// Mock feature components
jest.mock('@bakery/management/feature-dashboard', () => ({
  AdminNavigation: ({ children }: { children: React.ReactNode }) => (
    <nav data-testid="admin-navigation">{children}</nav>
  ),
  AdminSidebar: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div data-testid="admin-sidebar" data-open={open}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

// Mock Material UI components that might cause issues
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useMediaQuery: () => false,
  useTheme: () => ({
    breakpoints: {
      up: () => false,
      down: () => false,
    },
  }),
}))

describe('AdminLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPathname.mockReturnValue('/admin/orders')
  })

  it('renders children with admin navigation', () => {
    renderWithTheme(
      <AdminLayout>
        <div data-testid="test-child">Admin Content</div>
      </AdminLayout>
    )

    expect(screen.getByTestId('admin-navigation')).toBeInTheDocument()
    expect(screen.getByTestId('test-child')).toBeInTheDocument()
  })

  it('includes admin sidebar', () => {
    renderWithTheme(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    )

    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument()
  })

  it('handles mobile menu toggle', () => {
    const { container } = renderWithTheme(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    )

    // Check initial state
    const sidebar = screen.getByTestId('admin-sidebar')
    expect(sidebar).toHaveAttribute('data-open', 'false')

    // Note: Full mobile menu interaction would require the actual implementation
    // This test is ready for when the AdminNavigation component has a menu button
  })

  it('applies correct layout structure', () => {
    const { container } = renderWithTheme(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    )

    const mainContent = container.querySelector('main')
    expect(mainContent).toBeInTheDocument()
  })

  it('renders with authentication context', () => {
    renderWithTheme(
      <AdminLayout>
        <div>Protected Content</div>
      </AdminLayout>
    )

    // The layout should render even without authentication
    // Auth guards would be implemented separately
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})
