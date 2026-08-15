import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import BakingListPage from './page'

jest.mock('@bakery/shared/data-access', () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock }
}

const mockList = [
  {
    id: 1,
    productId: 'roggenbrot',
    name: 'Roggenbrot',
    category: 'brot',
    quantity: 20,
    unit: 'Stück',
    status: 'planned',
    date: '2026-08-15',
  },
  {
    id: 2,
    productId: 'croissant',
    name: 'Croissant',
    category: 'teilchen',
    quantity: 30,
    unit: 'Stück',
    status: 'planned',
    date: '2026-08-15',
  },
]

describe('AdminBakingListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(window.localStorage.getItem as jest.Mock).mockReturnValue(null)
    apiClient.get.mockResolvedValue({ success: true, data: mockList })
  })

  it('renders heading, loads the list and shows summary', async () => {
    renderWithTheme(<BakingListPage />)
    expect(
      screen.getByRole('heading', { level: 1, name: /Backliste/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()

    expect(await screen.findByText('Roggenbrot')).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/baking-list')
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('0 von 50 Stück fertig')).toBeInTheDocument()
    expect(screen.getAllByText('Offen').length).toBeGreaterThanOrEqual(2)
  })

  it('checks items off and persists progress in localStorage', async () => {
    renderWithTheme(<BakingListPage />)
    await screen.findByText('Roggenbrot')

    fireEvent.click(screen.getByLabelText('Roggenbrot abhaken'))
    await waitFor(() => expect(screen.getByText('40%')).toBeInTheDocument())
    expect(screen.getByText('20 von 50 Stück fertig')).toBeInTheDocument()
    expect(
      screen.getByText('Fertig', { selector: '.MuiChip-label' })
    ).toBeInTheDocument()
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'baking-list-done:2026-08-15',
      JSON.stringify(['1'])
    )

    // "Alle abhaken"
    fireEvent.click(screen.getByLabelText('Alle Positionen abhaken'))
    await waitFor(() => expect(screen.getByText('100%')).toBeInTheDocument())
  })

  it('restores checked state from localStorage', async () => {
    ;(window.localStorage.getItem as jest.Mock).mockReturnValue(
      JSON.stringify(['2'])
    )
    renderWithTheme(<BakingListPage />)
    await screen.findByText('Croissant')
    expect(screen.getByLabelText('Croissant abhaken')).toBeChecked()
    expect(screen.getByLabelText('Roggenbrot abhaken')).not.toBeChecked()
  })

  it('shows empty and error states', async () => {
    apiClient.get.mockResolvedValueOnce({ success: true, data: [] })
    const { unmount } = renderWithTheme(<BakingListPage />)
    expect(
      await screen.findByText('Für heute liegt keine Backliste vor.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Drucken/ })).toBeDisabled()
    unmount()

    apiClient.get.mockRejectedValueOnce(new Error('API down'))
    renderWithTheme(<BakingListPage />)
    expect(await screen.findByText('API down')).toBeInTheDocument()
  })
})
