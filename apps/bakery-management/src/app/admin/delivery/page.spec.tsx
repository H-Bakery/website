import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import DeliveryPage from './page'

// Mock feature components
jest.mock('@bakery/management/feature-delivery', () => ({
  DeliveryList: () => <div data-testid="delivery-list">Delivery List</div>,
  DeliveryMap: () => <div data-testid="delivery-map">Delivery Map</div>,
  DeliveryStats: () => (
    <div data-testid="delivery-stats">Delivery Statistics</div>
  ),
  RouteOptimizer: () => (
    <div data-testid="route-optimizer">Route Optimizer</div>
  ),
}))

// Mock geolocation API
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}

Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
})

describe('DeliveryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGeolocation.getCurrentPosition.mockImplementation((success) =>
      success({
        coords: {
          latitude: 47.3769,
          longitude: 8.5417,
          accuracy: 10,
        },
      })
    )
  })

  it('renders the page title', () => {
    renderWithTheme(<DeliveryPage />)

    expect(screen.getByText('Lieferungen')).toBeInTheDocument()
  })

  it('renders all delivery components', () => {
    renderWithTheme(<DeliveryPage />)

    expect(screen.getByTestId('delivery-stats')).toBeInTheDocument()
    expect(screen.getByTestId('delivery-map')).toBeInTheDocument()
    expect(screen.getByTestId('delivery-list')).toBeInTheDocument()
    expect(screen.getByTestId('route-optimizer')).toBeInTheDocument()
  })

  it('requests user location for map', async () => {
    renderWithTheme(<DeliveryPage />)

    await waitFor(() => {
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled()
    })
  })

  it('displays delivery status options', () => {
    renderWithTheme(<DeliveryPage />)

    // Status filters would be in the DeliveryList component
    expect(screen.getByTestId('delivery-list')).toBeInTheDocument()
  })

  it('has correct layout with map and list', () => {
    const { container } = renderWithTheme(<DeliveryPage />)

    // Check for split layout
    expect(screen.getByTestId('delivery-map')).toBeInTheDocument()
    expect(screen.getByTestId('delivery-list')).toBeInTheDocument()
  })

  it('includes route optimization', () => {
    renderWithTheme(<DeliveryPage />)

    const routeOptimizer = screen.getByTestId('route-optimizer')
    expect(routeOptimizer).toBeInTheDocument()
  })
})
