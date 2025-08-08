// Production WebSocket Service
// Handles real-time production updates and synchronization

import { io, Socket } from 'socket.io-client'
import {
  ProductionBatch,
  ProductionStep,
  ProductionSchedule,
  ProductionStatus,
} from '../types/production'

interface ProductionSocketEvents {
  // Batch events
  'production:batch:update': (
    data: { batchId: number } & Partial<ProductionBatch>
  ) => void
  'production:step:update': (
    data: { batchId: number; stepId: number } & Partial<ProductionStep>
  ) => void

  // Schedule events
  'production:schedule:update': (
    data: { date: string } & Partial<ProductionSchedule>
  ) => void

  // Status events
  'production:status:update': (data: Partial<ProductionStatus>) => void

  // Issue events
  'production:issue:reported': (data: { batchId: number; issue: any }) => void

  // Quality events
  'production:quality:check': (data: {
    batchId: number
    stepId: number
    qualityData: any
  }) => void
}

export type ProductionSocketEventHandler<
  T extends keyof ProductionSocketEvents
> = ProductionSocketEvents[T]

class ProductionSocketService {
  private socket: Socket | null = null
  private eventHandlers: Map<string, Set<Function>> = new Map()
  private reconnectInterval: NodeJS.Timeout | null = null
  private subscribedRooms: Set<string> = new Set()

  constructor() {
    // Initialize on first use
  }

  /**
   * Connect to WebSocket server
   */
  connect(token: string) {
    if (this.socket?.connected) {
      return
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

    this.socket = io(apiUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    this.setupEventHandlers()

    // Re-subscribe to rooms on reconnect
    this.socket.on('connect', () => {
      console.log('Production WebSocket connected')
      this.resubscribeToRooms()
    })

    this.socket.on('disconnect', () => {
      console.log('Production WebSocket disconnected')
    })

    this.socket.on('connect_error', (error) => {
      console.error('Production WebSocket connection error:', error)
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval)
      this.reconnectInterval = null
    }

    this.eventHandlers.clear()
    this.subscribedRooms.clear()
  }

  /**
   * Subscribe to production schedule updates
   */
  subscribeToSchedule(date: string) {
    if (!this.socket?.connected) {
      console.warn('Cannot subscribe: Socket not connected')
      return
    }

    const room = `production-schedule-${date}`
    this.socket.emit('production:subscribe:schedule', date)
    this.subscribedRooms.add(room)
  }

  /**
   * Unsubscribe from production schedule updates
   */
  unsubscribeFromSchedule(date: string) {
    if (!this.socket?.connected) return

    const room = `production-schedule-${date}`
    this.socket.emit('production:unsubscribe:schedule', date)
    this.subscribedRooms.delete(room)
  }

  /**
   * Subscribe to production batch updates
   */
  subscribeToBatch(batchId: number) {
    if (!this.socket?.connected) {
      console.warn('Cannot subscribe: Socket not connected')
      return
    }

    const room = `production-batch-${batchId}`
    this.socket.emit('production:subscribe:batch', batchId)
    this.subscribedRooms.add(room)
  }

  /**
   * Unsubscribe from production batch updates
   */
  unsubscribeFromBatch(batchId: number) {
    if (!this.socket?.connected) return

    const room = `production-batch-${batchId}`
    this.socket.emit('production:unsubscribe:batch', batchId)
    this.subscribedRooms.delete(room)
  }

  /**
   * Subscribe to production status updates
   */
  subscribeToStatus() {
    if (!this.socket?.connected) {
      console.warn('Cannot subscribe: Socket not connected')
      return
    }

    this.socket.emit('production:subscribe:status')
    this.subscribedRooms.add('production-status')
  }

  /**
   * Unsubscribe from production status updates
   */
  unsubscribeFromStatus() {
    if (!this.socket?.connected) return

    this.socket.emit('production:unsubscribe:status')
    this.subscribedRooms.delete('production-status')
  }

  /**
   * Add event handler
   */
  on<T extends keyof ProductionSocketEvents>(
    event: T,
    handler: ProductionSocketEventHandler<T>
  ) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }

    this.eventHandlers.get(event)!.add(handler)

    // If socket is already connected, add the handler
    if (this.socket?.connected) {
      this.socket.on(event, handler as any)
    }
  }

  /**
   * Remove event handler
   */
  off<T extends keyof ProductionSocketEvents>(
    event: T,
    handler: ProductionSocketEventHandler<T>
  ) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)

      if (handlers.size === 0) {
        this.eventHandlers.delete(event)
      }
    }

    // Remove from socket if connected
    if (this.socket?.connected) {
      this.socket.off(event, handler as any)
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers() {
    if (!this.socket) return

    // Re-attach all registered handlers
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        this.socket!.on(event, handler as any)
      })
    })
  }

  /**
   * Re-subscribe to rooms after reconnection
   */
  private resubscribeToRooms() {
    this.subscribedRooms.forEach((room) => {
      if (room.startsWith('production-schedule-')) {
        const date = room.replace('production-schedule-', '')
        this.subscribeToSchedule(date)
      } else if (room.startsWith('production-batch-')) {
        const batchId = parseInt(room.replace('production-batch-', ''))
        this.subscribeToBatch(batchId)
      } else if (room === 'production-status') {
        this.subscribeToStatus()
      }
    })
  }
}

// Export singleton instance
export const productionSocketService = new ProductionSocketService()
export default productionSocketService
