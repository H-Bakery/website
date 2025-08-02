import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import ProductionTimelineDropZone from '../ProductionTimelineDropZone'
import { format, addHours, parseISO } from 'date-fns'

const theme = createTheme()

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  )
}

const mockProps = {
  timeSlot: new Date('2024-01-15T09:00:00'),
  scheduleDate: '2024-01-15',
  scheduleStartTime: new Date('2024-01-15T06:00:00'),
  scheduleEndTime: new Date('2024-01-15T18:00:00'),
  existingBatches: [],
  onDrop: jest.fn(),
  isDraggingOver: false,
  canDropHere: true,
}

const mockExistingBatches = [
  {
    id: 1,
    plannedStartTime: '2024-01-15T10:00:00',
    plannedEndTime: '2024-01-15T12:00:00',
  },
  {
    id: 2,
    plannedStartTime: '2024-01-15T14:00:00',
    plannedEndTime: '2024-01-15T16:00:00',
  },
]

describe('ProductionTimelineDropZone', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with time label', () => {
    renderWithTheme(
      <ProductionTimelineDropZone {...mockProps} />
    )

    // Find the time display using the icon
    const timeIcon = screen.getByTestId('AccessTimeIcon')
    const timeContainer = timeIcon.parentElement
    expect(timeContainer).toHaveTextContent('09:00')
  })

  it('shows empty state icon when no batches and not dragging', () => {
    renderWithTheme(
      <ProductionTimelineDropZone {...mockProps} />
    )

    const addIcon = screen.getByTestId('AddIcon')
    expect(addIcon).toBeInTheDocument()
  })

  it('handles drag over event correctly', () => {
    renderWithTheme(
      <ProductionTimelineDropZone {...mockProps} />
    )

    const dropZone = screen.getByTestId('AccessTimeIcon').closest('div')!.parentElement!
    
    const dataTransfer = {
      dropEffect: '',
      getData: jest.fn((key: string) => {
        if (key === 'duration') return '60'
        return ''
      }),
    }

    const dragOverEvent = new Event('dragover', { bubbles: true })
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer })
    Object.defineProperty(dragOverEvent, 'preventDefault', {
      value: jest.fn(),
    })

    fireEvent(dropZone, dragOverEvent)

    expect(dragOverEvent.preventDefault).toHaveBeenCalled()
    expect(dataTransfer.dropEffect).toBe('move')
  })

  it('prevents drop when canDropHere is false', () => {
    renderWithTheme(
      <ProductionTimelineDropZone {...mockProps} canDropHere={false} />
    )

    const dropZone = screen.getByTestId('AccessTimeIcon').closest('div')!.parentElement!
    
    const dataTransfer = {
      dropEffect: '',
      getData: jest.fn(),
    }

    const dragOverEvent = new Event('dragover', { bubbles: true })
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer })
    Object.defineProperty(dragOverEvent, 'preventDefault', {
      value: jest.fn(),
    })

    fireEvent(dropZone, dragOverEvent)

    expect(dataTransfer.dropEffect).toBe('none')
  })

  it('handles drop event correctly', () => {
    renderWithTheme(
      <ProductionTimelineDropZone {...mockProps} />
    )

    const dropZone = screen.getByTestId('AccessTimeIcon').closest('div')!.parentElement!
    
    const dataTransfer = {
      getData: jest.fn((key: string) => {
        if (key === 'batchId') return '3'
        if (key === 'duration') return '60'
        return ''
      }),
    }

    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer })
    Object.defineProperty(dropEvent, 'preventDefault', {
      value: jest.fn(),
    })

    fireEvent(dropZone, dropEvent)

    expect(dropEvent.preventDefault).toHaveBeenCalled()
    expect(mockProps.onDrop).toHaveBeenCalledWith(3, mockProps.timeSlot)
  })

  it('detects conflicts with existing batches', () => {
    renderWithTheme(
      <ProductionTimelineDropZone
        {...mockProps}
        existingBatches={mockExistingBatches}
      />
    )

    const dropZone = screen.getByTestId('AccessTimeIcon').closest('div')!.parentElement!
    
    // Simulate dragging a 2-hour batch that would overlap with the 10:00-12:00 batch
    const dataTransfer = {
      dropEffect: '',
      getData: jest.fn((key: string) => {
        if (key === 'duration') return '120' // 2 hours
        return ''
      }),
    }

    const dragOverEvent = new Event('dragover', { bubbles: true })
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer })
    Object.defineProperty(dragOverEvent, 'preventDefault', {
      value: jest.fn(),
    })

    fireEvent(dropZone, dragOverEvent)

    // The component should detect the conflict
    // We can't directly test the internal state, but we can test the drop behavior
    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        getData: jest.fn((key: string) => {
          if (key === 'batchId') return '3'
          if (key === 'duration') return '120'
          return ''
        }),
      },
    })
    Object.defineProperty(dropEvent, 'preventDefault', {
      value: jest.fn(),
    })

    fireEvent(dropZone, dropEvent)

    // onDrop should not be called due to conflict
    expect(mockProps.onDrop).not.toHaveBeenCalled()
  })

  it('allows drop when no conflicts exist', () => {
    renderWithTheme(
      <ProductionTimelineDropZone
        {...mockProps}
        existingBatches={mockExistingBatches}
        timeSlot={new Date('2024-01-15T08:00:00')} // Earlier time slot
      />
    )

    const dropZone = screen.getByTestId('AccessTimeIcon').closest('div')!.parentElement!
    
    const dataTransfer = {
      getData: jest.fn((key: string) => {
        if (key === 'batchId') return '3'
        if (key === 'duration') return '60' // 1 hour - won't conflict
        return ''
      }),
    }

    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer })
    Object.defineProperty(dropEvent, 'preventDefault', {
      value: jest.fn(),
    })

    fireEvent(dropZone, dropEvent)

    expect(mockProps.onDrop).toHaveBeenCalledWith(3, new Date('2024-01-15T08:00:00'))
  })

  it('shows correct visual feedback when hovering', () => {
    const { rerender } = renderWithTheme(
      <ProductionTimelineDropZone {...mockProps} />
    )

    const dropZone = screen.getByTestId('AccessTimeIcon').closest('div')!.parentElement!
    
    // Simulate drag over
    const dataTransfer = {
      dropEffect: '',
      getData: jest.fn((key: string) => {
        if (key === 'duration') return '60'
        return ''
      }),
    }

    const dragOverEvent = new Event('dragover', { bubbles: true })
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer })
    Object.defineProperty(dragOverEvent, 'preventDefault', {
      value: jest.fn(),
    })

    fireEvent(dropZone, dragOverEvent)

    // Check for hover state (60 Min should appear)
    expect(screen.getByText('60 Min')).toBeInTheDocument()

    // Simulate drag leave
    fireEvent.dragLeave(dropZone)

    // The hover preview should disappear
    expect(screen.queryByText('60 Min')).not.toBeInTheDocument()
  })

  it('shows conflict indicator on hover when conflict detected', () => {
    renderWithTheme(
      <ProductionTimelineDropZone
        {...mockProps}
        existingBatches={mockExistingBatches}
        timeSlot={new Date('2024-01-15T11:00:00')} // Conflicts with first batch
      />
    )

    const dropZone = screen.getByTestId('AccessTimeIcon').closest('div')!.parentElement!
    
    const dataTransfer = {
      dropEffect: '',
      getData: jest.fn((key: string) => {
        if (key === 'duration') return '60'
        return ''
      }),
    }

    const dragOverEvent = new Event('dragover', { bubbles: true })
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer })
    Object.defineProperty(dragOverEvent, 'preventDefault', {
      value: jest.fn(),
    })

    fireEvent(dropZone, dragOverEvent)

    // Should show conflict message
    expect(screen.getByText('Konflikt!')).toBeInTheDocument()
  })

  it('displays duration preview with start and end times', () => {
    renderWithTheme(
      <ProductionTimelineDropZone {...mockProps} />
    )

    const dropZone = screen.getByTestId('AccessTimeIcon').closest('div')!.parentElement!
    
    const dataTransfer = {
      dropEffect: '',
      getData: jest.fn((key: string) => {
        if (key === 'duration') return '90' // 1.5 hours
        return ''
      }),
    }

    const dragOverEvent = new Event('dragover', { bubbles: true })
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer })
    Object.defineProperty(dragOverEvent, 'preventDefault', {
      value: jest.fn(),
    })

    fireEvent(dropZone, dragOverEvent)

    // Should show the time range - find the specific time range text
    const timeRange = screen.getByText(/09:00 - 10:30/)
    expect(timeRange).toBeInTheDocument()
  })

  it('handles edge cases for conflict detection', () => {
    const edgeCaseBatches = [
      {
        id: 1,
        plannedStartTime: '2024-01-15T09:00:00',
        plannedEndTime: '2024-01-15T10:00:00',
      },
    ]

    renderWithTheme(
      <ProductionTimelineDropZone
        {...mockProps}
        existingBatches={edgeCaseBatches}
        timeSlot={new Date('2024-01-15T08:00:00')}
      />
    )

    const dropZone = screen.getByTestId('AccessTimeIcon').closest('div')!.parentElement!

    // Test edge case: batch ending exactly when existing batch starts
    const dataTransfer = {
      getData: jest.fn((key: string) => {
        if (key === 'batchId') return '2'
        if (key === 'duration') return '60' // Ends at 09:00
        return ''
      }),
    }

    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer })
    Object.defineProperty(dropEvent, 'preventDefault', {
      value: jest.fn(),
    })

    fireEvent(dropZone, dropEvent)

    // Should allow drop as there's no overlap
    expect(mockProps.onDrop).toHaveBeenCalledWith(2, new Date('2024-01-15T08:00:00'))
  })

  it('applies correct styling based on drag state', () => {
    const { rerender } = renderWithTheme(
      <ProductionTimelineDropZone {...mockProps} />
    )

    let dropZone = screen.getByTestId('AccessTimeIcon').closest('div')!.parentElement!
    expect(dropZone).toHaveStyle({ borderColor: 'transparent' })

    // When dragging over
    rerender(
      <ThemeProvider theme={theme}>
        <ProductionTimelineDropZone {...mockProps} isDraggingOver={true} />
      </ThemeProvider>
    )

    dropZone = screen.getByTestId('AccessTimeIcon').closest('div')!.parentElement!
    // The exact color will depend on the theme, but border should not be transparent
    expect(dropZone).not.toHaveStyle({ borderColor: 'transparent' })
  })
})