/**
 * Event definitions for API module communication
 * 
 * This module exports all event types, constants, and handler definitions
 * used by the event bus for inter-module communication.
 */

// Order events
export * from './order-events';

// Inventory events  
export * from './inventory-events';

// Re-export all event names for convenience
import { ORDER_EVENTS } from './order-events';
import { INVENTORY_EVENTS } from './inventory-events';

export const ALL_EVENTS = {
  ORDER: ORDER_EVENTS,
  INVENTORY: INVENTORY_EVENTS,
} as const;

// Common event patterns
export interface BaseEvent {
  timestamp?: Date;
  source?: string;
  correlationId?: string;
  version?: string;
}

// Event handler result types
export interface EventHandlerResult {
  success: boolean;
  error?: string;
  data?: any;
}

// Event subscription options
export interface EventSubscriptionOptions {
  once?: boolean;
  priority?: number;
  filter?: (event: any) => boolean;
}