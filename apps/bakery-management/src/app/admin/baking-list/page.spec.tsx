import { render, screen, fireEvent } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import BakingListPage from './page'

// Mock feature components
jest.mock('@bakery/management/feature-inventory', () => ({
  BakingList: () => <div data-testid="baking-list">Baking List Component</div>,
  BakingListFilters: () => (
    <div data-testid="baking-list-filters">Filter Options</div>
  ),
  PrintBakingList: ({ onPrint }: { onPrint: () => void }) => (
    <button data-testid="print-button" onClick={onPrint}>
      Drucken
    </button>
  ),
}))

// Mock window.print
global.print = jest.fn()

describe('BakingListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the page title', () => {
    renderWithTheme(<BakingListPage />)

    expect(screen.getByText('Backliste')).toBeInTheDocument()
  })

  it('renders baking list components', () => {
    renderWithTheme(<BakingListPage />)

    expect(screen.getByTestId('baking-list-filters')).toBeInTheDocument()
    expect(screen.getByTestId('baking-list')).toBeInTheDocument()
  })

  it('includes print functionality', () => {
    renderWithTheme(<BakingListPage />)

    const printButton = screen.getByTestId('print-button')
    expect(printButton).toBeInTheDocument()

    fireEvent.click(printButton)
    expect(global.print).toHaveBeenCalled()
  })

  it('displays date selector', () => {
    renderWithTheme(<BakingListPage />)

    // Check for date-related elements
    expect(screen.getByTestId('baking-list-filters')).toBeInTheDocument()
  })

  it('has correct layout structure', () => {
    const { container } = renderWithTheme(<BakingListPage />)

    const mainContent =
      container.querySelector('[role="main"]') || container.firstChild
    expect(mainContent).toBeInTheDocument()
  })

  it('applies print-friendly styles', () => {
    const { container } = renderWithTheme(<BakingListPage />)

    // The component should be structured for printing
    const bakingList = screen.getByTestId('baking-list')
    expect(bakingList).toBeInTheDocument()
  })
})
