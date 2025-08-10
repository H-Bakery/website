import { fireEvent } from '@testing-library/react'

/**
 * Creates a mock DataTransfer object for drag and drop testing
 */
export const createMockDataTransfer = () => {
  const data: Record<string, string> = {}

  return {
    effectAllowed: 'none' as DataTransfer['effectAllowed'],
    dropEffect: 'none' as DataTransfer['dropEffect'],
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [] as string[],

    setData: jest.fn((key: string, value: string) => {
      data[key] = value
    }),

    getData: jest.fn((key: string) => data[key] || ''),

    clearData: jest.fn(() => {
      Object.keys(data).forEach((key) => delete data[key])
    }),

    setDragImage: jest.fn(),
  }
}

/**
 * Simulates a drag start event
 */
export const simulateDragStart = (
  element: HTMLElement,
  dataTransfer: ReturnType<typeof createMockDataTransfer>
) => {
  const dragStartEvent = new Event('dragstart', { bubbles: true })
  Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer })
  fireEvent(element, dragStartEvent)
  return dragStartEvent
}

/**
 * Simulates a drag over event
 */
export const simulateDragOver = (
  element: HTMLElement,
  dataTransfer: ReturnType<typeof createMockDataTransfer>
) => {
  const dragOverEvent = new Event('dragover', { bubbles: true })
  Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer })
  Object.defineProperty(dragOverEvent, 'preventDefault', { value: jest.fn() })
  fireEvent(element, dragOverEvent)
  return dragOverEvent
}

/**
 * Simulates a drop event
 */
export const simulateDrop = (
  element: HTMLElement,
  dataTransfer: ReturnType<typeof createMockDataTransfer>
) => {
  const dropEvent = new Event('drop', { bubbles: true })
  Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer })
  Object.defineProperty(dropEvent, 'preventDefault', { value: jest.fn() })
  fireEvent(element, dropEvent)
  return dropEvent
}

/**
 * Simulates a complete drag and drop operation
 */
export const simulateDragAndDrop = (
  dragElement: HTMLElement,
  dropElement: HTMLElement,
  setupDataTransfer?: (dt: ReturnType<typeof createMockDataTransfer>) => void
) => {
  const dataTransfer = createMockDataTransfer()

  if (setupDataTransfer) {
    setupDataTransfer(dataTransfer)
  }

  // Start drag
  simulateDragStart(dragElement, dataTransfer)

  // Drag over drop zone
  simulateDragOver(dropElement, dataTransfer)

  // Drop
  const dropEvent = simulateDrop(dropElement, dataTransfer)

  // End drag
  fireEvent.dragEnd(dragElement)

  return { dataTransfer, dropEvent }
}

/**
 * Mock production batch data generator
 */
export const createMockBatch = (overrides?: Partial<any>) => ({
  id: 1,
  name: 'Test Batch',
  scheduleId: 1,
  productId: 101,
  plannedQuantity: 50,
  actualQuantity: null,
  unit: 'Stück',
  status: 'planned',
  priority: 'medium',
  plannedStartTime: new Date().toISOString(),
  plannedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  actualStartTime: null,
  actualEndTime: null,
  assignedStaffIds: [1, 2],
  requiredEquipment: ['Equipment A'],
  estimatedDurationMinutes: 120,
  progress: 0,
  notes: null,
  issues: [],
  isDelayed: false,
  delayMinutes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

/**
 * Mock schedule data generator
 */
export const createMockSchedule = (overrides?: Partial<any>) => ({
  id: 1,
  scheduleDate: new Date().toISOString().split('T')[0],
  workdayStartTime: '06:00:00',
  workdayEndTime: '18:00:00',
  targetCapacity: 1000,
  currentCapacity: 500,
  utilizationRate: 50,
  isActive: true,
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})
