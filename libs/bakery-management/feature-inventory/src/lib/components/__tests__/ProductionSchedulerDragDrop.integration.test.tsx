import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import ProductionSchedulerDragDrop from '../ProductionSchedulerDragDrop'
import {
  simulateDragAndDrop,
  createMockBatch,
  createMockSchedule,
} from './dragDropTestUtils'
import { ScheduleViewMode } from '../../../types/production'

// Mock the hooks
jest.mock('../../hooks/use-production', () => ({
  useProductionSchedules: jest.fn(),
  useProductionBatches: jest.fn(),
  useUpdateBatch: jest.fn(),
  useCreateBatch: jest.fn(),
  useDeleteBatch: jest.fn(),
}))

jest.mock('../hooks/use-production-socket', () => ({
  useProductionSocket: jest.fn(),
}))

// Mock the BatchDetailsPanel to simplify testing
jest.mock('../BatchDetailsPanel', () => ({
  __esModule: true,
  default: ({ batchId, onClose }: any) => (
    <div data-testid="batch-details-panel">
      Batch Details for ID: {batchId}
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

import {
  useProductionSchedules,
  useProductionBatches,
  useUpdateBatch,
} from '../../hooks/use-production'
import { useProductionSocket } from '../hooks/use-production-socket'

const theme = createTheme()

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{component}</ThemeProvider>
    </QueryClientProvider>
  )
}

describe('ProductionSchedulerDragDrop - Integration Tests', () => {
  const mockProps = {
    selectedDate: new Date('2024-01-15'),
    viewMode: { type: 'timeline', period: 'day' } as ScheduleViewMode,
    onDateChange: jest.fn(),
    onViewModeChange: jest.fn(),
  }

  const mockSchedule = createMockSchedule({
    scheduleDate: '2024-01-15',
  })

  const mockBatches = [
    createMockBatch({
      id: 1,
      name: 'Morning Croissants',
      plannedStartTime: '2024-01-15T08:00:00Z',
      plannedEndTime: '2024-01-15T10:00:00Z',
      requiredEquipment: ['Oven A'],
      status: 'planned',
    }),
    createMockBatch({
      id: 2,
      name: 'Afternoon Baguettes',
      plannedStartTime: '2024-01-15T14:00:00Z',
      plannedEndTime: '2024-01-15T16:00:00Z',
      requiredEquipment: ['Oven B'],
      status: 'planned',
    }),
  ]

  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock implementations
    ;(useProductionSchedules as jest.Mock).mockReturnValue({
      data: { items: [mockSchedule] },
      isLoading: false,
      error: null,
    })
    ;(useProductionBatches as jest.Mock).mockReturnValue({
      data: { items: mockBatches },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    ;(useProductionSocket as jest.Mock).mockReturnValue({
      isConnected: true,
    })
    ;(useUpdateBatch as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    })
  })

  it('renders the scheduler with batches', async () => {
    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    // Wait for component to render
    await waitFor(() => {
      expect(
        screen.getByText('Drag & Drop Produktionsplanung')
      ).toBeInTheDocument()
    })

    expect(screen.getByText('Morning Croissants')).toBeInTheDocument()
    expect(screen.getByText('Afternoon Baguettes')).toBeInTheDocument()
  })

  it('updates UI in real-time with WebSocket events', async () => {
    let socketCallbacks: any = {}

    ;(useProductionSocket as jest.Mock).mockImplementation(
      (options, callbacks) => {
        socketCallbacks = callbacks
        return { isConnected: true }
      }
    )

    const refetchMock = jest.fn()
    ;(useProductionBatches as jest.Mock).mockReturnValue({
      data: { items: mockBatches },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    // Simulate a WebSocket batch update event
    socketCallbacks.onBatchUpdate({
      batchId: 1,
      progress: 50,
      status: 'in_progress',
    })

    // Should trigger a refetch
    expect(refetchMock).toHaveBeenCalled()
  })

  it('handles kanban view rendering', async () => {
    renderWithProviders(
      <ProductionSchedulerDragDrop
        {...mockProps}
        viewMode={{ type: 'kanban', period: 'day' }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PLANNED')).toBeInTheDocument()
    })

    // In kanban view, should see status columns
    expect(screen.getByText('READY')).toBeInTheDocument()
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
  })

  it('displays resource-based organization in timeline view', () => {
    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    // Should group batches by equipment
    expect(screen.getByText('Oven A')).toBeInTheDocument()
    expect(screen.getByText('Oven B')).toBeInTheDocument()
  })

  it('shows feedback messages during operations', async () => {
    const updateBatchMock = jest.fn().mockResolvedValue({})
    ;(useUpdateBatch as jest.Mock).mockReturnValue({
      mutateAsync: updateBatchMock,
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    // The component should be ready to show feedback messages
    // In a real scenario, drag and drop would trigger these messages
    expect(
      screen.getByText('Drag & Drop Produktionsplanung')
    ).toBeInTheDocument()
  })

  it('handles error scenarios gracefully', async () => {
    ;(useProductionSchedules as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: 'Failed to load schedules' },
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    // Should show error message
    await waitFor(() => {
      expect(
        screen.getByText(/Fehler beim Laden: Failed to load schedules/)
      ).toBeInTheDocument()
    })
  })

  it('shows no schedule message when no schedule exists', async () => {
    ;(useProductionSchedules as jest.Mock).mockReturnValue({
      data: { items: [] },
      isLoading: false,
      error: null,
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    await waitFor(() => {
      expect(
        screen.getByText('Kein Produktionsplan für diesen Tag')
      ).toBeInTheDocument()
    })

    expect(screen.getByText('Plan erstellen')).toBeInTheDocument()
  })

  it('handles undo/redo button states correctly', async () => {
    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    await waitFor(() => {
      const undoButton = screen.getByTestId('UndoIcon').closest('button')
      const redoButton = screen.getByTestId('RedoIcon').closest('button')

      // Initially should be disabled
      expect(undoButton).toBeDisabled()
      expect(redoButton).toBeDisabled()
    })
  })

  it('refreshes data when refresh button is clicked', async () => {
    const refetchMock = jest.fn()
    ;(useProductionBatches as jest.Mock).mockReturnValue({
      data: { items: mockBatches },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    await waitFor(() => {
      const refreshButton = screen.getByTestId('RefreshIcon').closest('button')
      expect(refreshButton).toBeInTheDocument()
    })

    const refreshButton = screen.getByTestId('RefreshIcon').closest('button')
    refreshButton!.click()

    expect(refetchMock).toHaveBeenCalled()
  })

  it('toggles between view modes', async () => {
    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    await waitFor(() => {
      const viewToggle = screen.getByTestId('ViewModuleIcon').closest('button')
      expect(viewToggle).toBeInTheDocument()
    })

    const viewToggle = screen.getByTestId('ViewModuleIcon').closest('button')
    viewToggle!.click()

    expect(mockProps.onViewModeChange).toHaveBeenCalledWith({
      type: 'kanban',
      period: 'day',
    })
  })

  it('displays connection status correctly', async () => {
    ;(useProductionSocket as jest.Mock).mockReturnValue({
      isConnected: false,
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument()
    })
  })

  it('handles batches without equipment correctly', async () => {
    const batchesWithoutEquipment = [
      {
        ...mockBatches[0],
        requiredEquipment: [],
      },
    ]

    ;(useProductionBatches as jest.Mock).mockReturnValue({
      data: { items: batchesWithoutEquipment },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    await waitFor(() => {
      // Should show "Nicht zugewiesen" for batches without equipment
      expect(screen.getByText('Nicht zugewiesen')).toBeInTheDocument()
    })
  })
})
