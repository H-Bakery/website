import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import DraggableProductionBatch from '../DraggableProductionBatch'
import { ProductionBatch } from '../../../types/production'

// Mock production batch data
const mockBatch: ProductionBatch = {
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
  requiredEquipment: ['Ofen A', 'Kneter 1'],
  estimatedDurationMinutes: 120,
  progress: 0,
  notes: null,
  issues: [],
  isDelayed: false,
  delayMinutes: null,
  createdAt: '2024-01-14T10:00:00Z',
  updatedAt: '2024-01-14T10:00:00Z',
}

const mockHandlers = {
  onMenuClick: jest.fn(),
  onDragStart: jest.fn(),
  onDragEnd: jest.fn(),
}

const theme = createTheme()

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  )
}

describe('DraggableProductionBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders batch information correctly', () => {
    renderWithTheme(
      <DraggableProductionBatch
        batch={mockBatch}
        index={0}
        {...mockHandlers}
      />
    )

    expect(screen.getByText('Croissant Batch')).toBeInTheDocument()
    expect(screen.getByText('50 Stück')).toBeInTheDocument()
    expect(screen.getByText('planned')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
  })

  it('renders different status icons correctly', () => {
    const statuses = ['completed', 'in_progress', 'failed', 'waiting', 'planned']
    
    statuses.forEach(status => {
      const { rerender } = renderWithTheme(
        <DraggableProductionBatch
          batch={{ ...mockBatch, status: status as any }}
          index={0}
          {...mockHandlers}
        />
      )
      
      // Status chip should be rendered
      expect(screen.getByText(status)).toBeInTheDocument()
      
      rerender(<></>)
    })
  })

  it('shows drag handle for draggable statuses', () => {
    renderWithTheme(
      <DraggableProductionBatch
        batch={{ ...mockBatch, status: 'planned' }}
        index={0}
        {...mockHandlers}
      />
    )

    const dragHandle = screen.getByTestId('DragIndicatorIcon')
    expect(dragHandle).toBeInTheDocument()
  })

  it('hides drag handle for non-draggable statuses', () => {
    renderWithTheme(
      <DraggableProductionBatch
        batch={{ ...mockBatch, status: 'in_progress' }}
        index={0}
        {...mockHandlers}
      />
    )

    // Drag handle should not be visible for in_progress status
    const dragHandle = screen.queryByTestId('DragIndicatorIcon')
    expect(dragHandle).toBeNull()
  })

  it('handles drag start event correctly', () => {
    renderWithTheme(
      <DraggableProductionBatch
        batch={mockBatch}
        index={0}
        {...mockHandlers}
      />
    )

    const card = screen.getByRole('article')
    
    // Create a mock dataTransfer object
    const dataTransfer = {
      effectAllowed: '',
      setData: jest.fn(),
      setDragImage: jest.fn(),
    }

    const dragStartEvent = new Event('dragstart', { bubbles: true })
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: dataTransfer,
    })
    Object.defineProperty(dragStartEvent, 'nativeEvent', {
      value: { offsetX: 10, offsetY: 10 },
    })

    fireEvent(card, dragStartEvent)

    expect(dataTransfer.setData).toHaveBeenCalledWith('batchId', '1')
    expect(dataTransfer.setData).toHaveBeenCalledWith('batchIndex', '0')
    expect(dataTransfer.setData).toHaveBeenCalledWith('duration', '120')
    expect(dataTransfer.setData).toHaveBeenCalledWith('batchData', JSON.stringify(mockBatch))
    expect(mockHandlers.onDragStart).toHaveBeenCalledWith(mockBatch, 0)
  })

  it('handles drag end event correctly', () => {
    renderWithTheme(
      <DraggableProductionBatch
        batch={mockBatch}
        index={0}
        {...mockHandlers}
      />
    )

    const card = screen.getByRole('article')
    fireEvent.dragEnd(card)

    expect(mockHandlers.onDragEnd).toHaveBeenCalled()
  })

  it('shows progress bar when progress is greater than 0', () => {
    renderWithTheme(
      <DraggableProductionBatch
        batch={{ ...mockBatch, progress: 45 }}
        index={0}
        {...mockHandlers}
      />
    )

    expect(screen.getByText('45% abgeschlossen')).toBeInTheDocument()
  })

  it('displays delay warning when batch is delayed', () => {
    renderWithTheme(
      <DraggableProductionBatch
        batch={{ ...mockBatch, isDelayed: true, delayMinutes: 30 }}
        index={0}
        {...mockHandlers}
      />
    )

    expect(screen.getByText('30min verzögert')).toBeInTheDocument()
  })

  it('shows additional info on hover', () => {
    renderWithTheme(
      <DraggableProductionBatch
        batch={mockBatch}
        index={0}
        {...mockHandlers}
      />
    )

    const card = screen.getByRole('article')
    fireEvent.mouseEnter(card)

    expect(screen.getByText('Dauer: 120 Minuten')).toBeInTheDocument()
    expect(screen.getByText('Personal: 2 Mitarbeiter')).toBeInTheDocument()
    expect(screen.getByText('Geräte: Ofen A, Kneter 1')).toBeInTheDocument()
  })

  it('handles menu click correctly', () => {
    renderWithTheme(
      <DraggableProductionBatch
        batch={mockBatch}
        index={0}
        {...mockHandlers}
      />
    )

    const menuButton = screen.getByTestId('MoreVertIcon').closest('button')
    fireEvent.click(menuButton!)

    expect(mockHandlers.onMenuClick).toHaveBeenCalledWith(
      expect.any(Object),
      mockBatch
    )
  })

  it('applies correct styling for different batch statuses', () => {
    const { rerender } = renderWithTheme(
      <DraggableProductionBatch
        batch={{ ...mockBatch, status: 'in_progress' }}
        index={0}
        {...mockHandlers}
      />
    )

    let card = screen.getByRole('article')
    expect(card).toHaveStyle({ cursor: 'default' })

    rerender(
      <ThemeProvider theme={theme}>
        <DraggableProductionBatch
          batch={{ ...mockBatch, status: 'planned' }}
          index={0}
          {...mockHandlers}
        />
      </ThemeProvider>
    )

    card = screen.getByRole('article')
    expect(card).toHaveStyle({ cursor: 'move' })
  })

  it('renders correctly when dragging', () => {
    renderWithTheme(
      <DraggableProductionBatch
        batch={mockBatch}
        index={0}
        {...mockHandlers}
        isDragging={true}
      />
    )

    const card = screen.getByRole('article')
    expect(card).toHaveStyle({ opacity: '0.5' })
  })

  it('renders correctly as valid drop target', () => {
    renderWithTheme(
      <DraggableProductionBatch
        batch={mockBatch}
        index={0}
        {...mockHandlers}
        isValidDropTarget={true}
      />
    )

    const card = screen.getByRole('article')
    expect(card).toHaveStyle({ borderStyle: 'dashed' })
  })

  it('does not crash with missing optional data', () => {
    const minimalBatch: ProductionBatch = {
      ...mockBatch,
      assignedStaffIds: [],
      requiredEquipment: [],
      notes: null,
      issues: [],
    }

    renderWithTheme(
      <DraggableProductionBatch
        batch={minimalBatch}
        index={0}
        {...mockHandlers}
      />
    )

    expect(screen.getByText('Croissant Batch')).toBeInTheDocument()
  })
})