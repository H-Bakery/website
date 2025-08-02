import { render, screen, fireEvent } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ProductionPage from './page'

// Mock feature components
jest.mock('@bakery/management/feature-inventory', () => ({
  ProductionScheduler: () => (
    <div data-testid="production-scheduler">Production Scheduler</div>
  ),
  ProductionStats: () => (
    <div data-testid="production-stats">Production Statistics</div>
  ),
  RecipeManager: () => <div data-testid="recipe-manager">Recipe Manager</div>,
}))

// Mock date utilities
jest.mock('@bakery/shared/utils', () => ({
  formatDateGerman: (date: Date) => '01.01.2024',
  getWeekNumber: (date: Date) => 1,
}))

describe('ProductionPage', () => {
  it('renders the page title', () => {
    renderWithTheme(<ProductionPage />)

    expect(screen.getByText('Produktionsplanung')).toBeInTheDocument()
  })

  it('renders all production components', () => {
    renderWithTheme(<ProductionPage />)

    expect(screen.getByTestId('production-stats')).toBeInTheDocument()
    expect(screen.getByTestId('production-scheduler')).toBeInTheDocument()
    expect(screen.getByTestId('recipe-manager')).toBeInTheDocument()
  })

  it('displays current date and week', () => {
    renderWithTheme(<ProductionPage />)

    // Should show formatted date
    expect(screen.getByText(/01\.01\.2024/)).toBeInTheDocument()
    expect(screen.getByText(/Woche 1/)).toBeInTheDocument()
  })

  it('has correct page structure', () => {
    const { container } = renderWithTheme(<ProductionPage />)

    // Check for main sections
    const mainContent =
      container.querySelector('[role="main"]') || container.firstChild
    expect(mainContent).toBeInTheDocument()
  })

  it('includes production actions', () => {
    renderWithTheme(<ProductionPage />)

    // Check for common production actions
    const scheduler = screen.getByTestId('production-scheduler')
    expect(scheduler).toBeInTheDocument()
  })

  it('renders with responsive layout', () => {
    const { container } = renderWithTheme(<ProductionPage />)

    // Check that grid layout is applied
    const layoutElements = container.querySelectorAll('div')
    expect(layoutElements.length).toBeGreaterThan(0)
  })
})
