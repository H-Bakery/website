import EventEmitter from 'eventemitter3'

/**
 * Singleton Event Bus for API module communication
 *
 * This service provides a centralized event system that allows
 * different API modules to communicate without direct dependencies.
 *
 * Usage:
 * - Publishers: eventBus.emit(eventName, payload)
 * - Subscribers: eventBus.on(eventName, handler)
 */
class EventBusService extends EventEmitter {
  private static instance: EventBusService

  constructor() {
    super()

    // Enable detailed error reporting for event listeners
    this.setMaxListeners(20) // Allow more listeners for complex workflows

    // Log unhandled events in development
    if (process.env.NODE_ENV === 'development') {
      this.onAny((eventName, ...args) => {
        console.debug(
          `[EventBus] Event "${eventName}" emitted with args:`,
          args
        )
      })
    }
  }

  /**
   * Get the singleton instance of the event bus
   */
  public static getInstance(): EventBusService {
    if (!EventBusService.instance) {
      EventBusService.instance = new EventBusService()
    }
    return EventBusService.instance
  }

  /**
   * Safely emit an event with error handling
   */
  public safeEmit(eventName: string, payload: any): boolean {
    try {
      return this.emit(eventName, payload)
    } catch (error) {
      console.error(`[EventBus] Error emitting event "${eventName}":`, error)
      return false
    }
  }

  /**
   * Add a one-time listener with error handling
   */
  public safeOnce(eventName: string, handler: (...args: any[]) => void): this {
    const wrappedHandler = (...args: any[]) => {
      try {
        handler(...args)
      } catch (error) {
        console.error(
          `[EventBus] Error in once handler for "${eventName}":`,
          error
        )
      }
    }
    return this.once(eventName, wrappedHandler)
  }

  /**
   * Add a persistent listener with error handling
   */
  public safeOn(eventName: string, handler: (...args: any[]) => void): this {
    const wrappedHandler = (...args: any[]) => {
      try {
        handler(...args)
      } catch (error) {
        console.error(`[EventBus] Error in handler for "${eventName}":`, error)
      }
    }
    return this.on(eventName, wrappedHandler)
  }

  /**
   * Get diagnostic information about the event bus
   */
  public getDiagnostics(): {
    listenerCount: number
    eventNames: string[]
    maxListeners: number
  } {
    return {
      listenerCount: this.listenerCount('*'),
      eventNames: this.eventNames() as string[],
      maxListeners: this.getMaxListeners(),
    }
  }
}

// Export singleton instance
export const eventBus = EventBusService.getInstance()

// Export class for testing purposes
export { EventBusService }
