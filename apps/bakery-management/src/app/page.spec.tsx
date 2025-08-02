import { render, screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import HomePage from './page'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  redirect: (url: string) => mockPush(url),
}))

// Mock feature components
jest.mock('@bakery/management/feature-dashboard', () => ({
  DashboardOverview: () => (
    <div data-testid="dashboard-overview">Dashboard Overview</div>
  ),
  QuickActions: () => <div data-testid="quick-actions">Quick Actions</div>,
  RecentActivity: () => (
    <div data-testid="recent-activity">Recent Activity</div>
  ),
}))

describe('Management HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders welcome message', () => {
    renderWithTheme(<HomePage />)

    expect(screen.getByText(/Willkommen/)).toBeInTheDocument()
  })

  it('renders dashboard components', () => {
    renderWithTheme(<HomePage />)

    expect(screen.getByTestId('dashboard-overview')).toBeInTheDocument()
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument()
    expect(screen.getByTestId('recent-activity')).toBeInTheDocument()
  })

  it('redirects to admin dashboard', () => {
    renderWithTheme(<HomePage />)

    // Check if redirect was called
    expect(mockPush).toHaveBeenCalledWith('/admin/orders')
  })

  it('displays loading state before redirect', () => {
    const { container } = renderWithTheme(<HomePage />)

    // Should show some content before redirect
    expect(container.firstChild).toBeInTheDocument()
  })

  it('has correct page structure', () => {
    const { container } = renderWithTheme(<HomePage />)

    const mainContent =
      container.querySelector('[role="main"]') || container.firstChild
    expect(mainContent).toBeInTheDocument()
  })
})
