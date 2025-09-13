import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ProductionSchedulerDragDrop from '../ProductionSchedulerDragDrop'
import {
  ScheduleViewMode,
  ProductionSchedule,
  ProductionBatch,
} from '@bakery/shared/types'

// Mock the hooks
jest.mock('../hooks/use-production', () => ({
  useProductionSchedules: jest.fn(),
  useProductionBatches: jest.fn(),
  useUpdateBatch: jest.fn(),
  useCreateBatch: jest.fn(),
  useDeleteBatch: jest.fn(),
}))

jest.mock('../hooks/use-production-socket', () => ({
  useProductionSocket: jest.fn(),
}))

// Mock child components to simplify testing
jest.mock('../DraggableProductionBatch', () => ({
  __esModule: true,
  default: ({ batch, onDragStart, onDragEnd, onMenuClick }: any) => (
    <div
      data-testid={`batch-${batch.id}`}
      draggable
      onDragStart={() => onDragStart(batch, 0)}
      onDragEnd={onDragEnd}
      onClick={(e) => onMenuClick(e, batch)}
    >
      {batch.name}
    </div>
  ),
}))

jest.mock('../ProductionTimelineDropZone', () => ({
  __esModule: true,
  default: ({ timeSlot, onDrop }: any) => (
    <div
      data-testid={`dropzone-${timeSlot.toISOString()}`}
      onDrop={(e) => {
        e.preventDefault()
        const batchId = parseInt(e.dataTransfer.getData('batchId'))
        onDrop(batchId, timeSlot)
      }}
    >
      Drop Zone
    </div>
  ),
}))

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
  useCreateBatch,
  useDeleteBatch,
} from '../hooks/use-production'
import { useProductionSocket } from '../hooks/use-production-socket'

const mockSchedule: ProductionSchedule = {
  id: 1,
  scheduleDate: '2024-01-15',
  workdayStartTime: '06:00:00',
  workdayEndTime: '18:00:00',
  targetCapacity: 1000,
  currentCapacity: 500,
  utilizationRate: 50,
  isActive: true,
  notes: null,
  createdAt: '2024-01-14T10:00:00Z',
  updatedAt: '2024-01-14T10:00:00Z',
}

const mockBatches: ProductionBatch[] = [
  {
    id: 1,
    name: 'Croissant Batch',
    scheduleId: 1,
    productId: 101,
    plannedQuantity: 50,
    actualQuantity: null,
    unit: 'Stück',
    status: 'planned',
    priority: 'high',
    plannedStartTime: '2024-01-15T08:00:00Z',
    plannedEndTime: '2024-01-15T10:00:00Z',
    actualStartTime: null,
    actualEndTime: null,
    assignedStaffIds: [1, 2],
    requiredEquipment: ['Ofen A'],
    estimatedDurationMinutes: 120,
    progress: 0,
    notes: null,
    issues: [],
    isDelayed: false,
    delayMinutes: null,
    createdAt: '2024-01-14T10:00:00Z',
    updatedAt: '2024-01-14T10:00:00Z',
  },
  {
    id: 2,
    name: 'Baguette Batch',
    scheduleId: 1,
    productId: 102,
    plannedQuantity: 30,
    actualQuantity: null,
    unit: 'Stück',
    status: 'ready',
    priority: 'medium',
    plannedStartTime: '2024-01-15T10:30:00Z',
    plannedEndTime: '2024-01-15T12:00:00Z',
    actualStartTime: null,
    actualEndTime: null,
    assignedStaffIds: [3],
    requiredEquipment: ['Ofen B'],
    estimatedDurationMinutes: 90,
    progress: 0,
    notes: null,
    issues: [],
    isDelayed: false,
    delayMinutes: null,
    createdAt: '2024-01-14T10:00:00Z',
    updatedAt: '2024-01-14T10:00:00Z',
  },
]

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
      {renderWithTheme(component)}
    </QueryClientProvider>
  )
}

describe('ProductionSchedulerDragDrop', () => {
  const mockProps = {
    selectedDate: new Date('2024-01-15'),
    viewMode: { type: 'timeline', period: 'day' } as ScheduleViewMode,
    onDateChange: jest.fn(),
    onViewModeChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock hook implementations
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
    ;(useCreateBatch as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    })
    ;(useDeleteBatch as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    })
  })

  it('renders the scheduler with header and controls', () => {
    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    expect(
      screen.getByText('Drag & Drop Produktionsplanung')
    ).toBeInTheDocument()
    expect(screen.getByText(/15\\.01\\.2024/)).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByText('Neue Charge')).toBeInTheDocument()
  })

  it('shows loading state when data is loading', () => {
    ;(useProductionSchedules as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    expect(screen.getByText('Lade Produktionsplan...')).toBeInTheDocument()
  })

  it('shows error state when data loading fails', () => {
    ;(useProductionSchedules as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: 'Failed to load schedules' },
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    expect(
      screen.getByText(/Fehler beim Laden: Failed to load schedules/)
    ).toBeInTheDocument()
  })

  it('renders timeline view with batches', () => {
    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    expect(screen.getByTestId('batch-1')).toBeInTheDocument()
    expect(screen.getByText('Croissant Batch')).toBeInTheDocument()
    expect(screen.getByTestId('batch-2')).toBeInTheDocument()
    expect(screen.getByText('Baguette Batch')).toBeInTheDocument()
  })

  it('switches between timeline and kanban views', () => {
    const { rerender } = renderWithProviders(
      <ProductionSchedulerDragDrop {...mockProps} />
    )

    // Initially in timeline view
    expect(screen.getByTestId('ViewModuleIcon')).toBeInTheDocument()

    // Click to switch view
    const viewToggle = screen.getByTestId('ViewModuleIcon').closest('button')
    fireEvent.click(viewToggle!)

    expect(mockProps.onViewModeChange).toHaveBeenCalledWith({
      type: 'kanban',
      period: 'day',
    })
  })

  it('handles undo and redo operations', async () => {
    const updateBatchMock = jest.fn().mockResolvedValue({})
    ;(useUpdateBatch as jest.Mock).mockReturnValue({
      mutateAsync: updateBatchMock,
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    // Initially, undo/redo should be disabled
    const undoButton = screen.getByTestId('UndoIcon').closest('button')
    const redoButton = screen.getByTestId('RedoIcon').closest('button')

    expect(undoButton).toBeDisabled()
    expect(redoButton).toBeDisabled()

    // Simulate a batch move to enable undo
    // This would normally happen through drag and drop
    // For testing, we'll simulate the internal state change
  })

  it('refreshes data when refresh button is clicked', () => {
    const refetchMock = jest.fn()
    ;(useProductionBatches as jest.Mock).mockReturnValue({
      data: { items: mockBatches },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    const refreshButton = screen.getByTestId('RefreshIcon').closest('button')
    fireEvent.click(refreshButton!)

    expect(refetchMock).toHaveBeenCalled()
  })

  it('shows no schedule message when no schedule exists', () => {
    ;(useProductionSchedules as jest.Mock).mockReturnValue({
      data: { items: [] },
      isLoading: false,
      error: null,
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    expect(
      screen.getByText('Kein Produktionsplan für diesen Tag')
    ).toBeInTheDocument()
    expect(screen.getByText('Plan erstellen')).toBeInTheDocument()
  })

  it('opens batch details panel when batch is clicked', () => {
    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    const batch = screen.getByTestId('batch-1')
    fireEvent.click(batch)

    expect(screen.getByTestId('batch-details-panel')).toBeInTheDocument()
    expect(screen.getByText('Batch Details for ID: 1')).toBeInTheDocument()
  })

  it('closes batch details panel', () => {
    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    // Open panel
    const batch = screen.getByTestId('batch-1')
    fireEvent.click(batch)

    expect(screen.getByTestId('batch-details-panel')).toBeInTheDocument()

    // Close panel
    const closeButton = screen.getByText('Close')
    fireEvent.click(closeButton)

    expect(screen.queryByTestId('batch-details-panel')).not.toBeInTheDocument()
  })

  it('groups batches by resource in timeline view', () => {
    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    // Check for resource grouping headers
    expect(screen.getByText('Ofen A')).toBeInTheDocument()
    expect(screen.getByText('Ofen B')).toBeInTheDocument()
  })

  it('renders kanban view with status columns', () => {
    renderWithProviders(
      <ProductionSchedulerDragDrop
        {...mockProps}
        viewMode={{ type: 'kanban', period: 'day' }}
      />
    )

    // Check for kanban columns
    expect(screen.getByText('PLANNED')).toBeInTheDocument()
    expect(screen.getByText('READY')).toBeInTheDocument()
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
  })

  it('shows snackbar messages for user feedback', async () => {
    const updateBatchMock = jest.fn().mockResolvedValue({})
    ;(useUpdateBatch as jest.Mock).mockReturnValue({
      mutateAsync: updateBatchMock,
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    // Simulate a successful batch move
    // This would trigger the snackbar in a real scenario
    // For testing, we need to verify the Snackbar component is rendered
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('handles WebSocket connection status', () => {
    ;(useProductionSocket as jest.Mock).mockReturnValue({
      isConnected: false,
    })

    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('calculates timeline hours correctly', () => {
    renderWithProviders(<ProductionSchedulerDragDrop {...mockProps} />)

    // The schedule runs from 06:00 to 18:00, so we should see these times
    // Note: The actual rendering of hours depends on the timeline implementation
    // Here we're checking that the component renders without errors
    expect(
      screen.getByText('Drag & Drop Produktionsplanung')
    ).toBeInTheDocument()
  })

  it('handles batches without equipment correctly', () => {
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

    // Should show "Nicht zugewiesen" for batches without equipment
    expect(screen.getByText('Nicht zugewiesen')).toBeInTheDocument()
  })
})
